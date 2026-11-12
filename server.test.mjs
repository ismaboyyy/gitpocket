import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { app } from './server.mjs';

test('local server serves UI, paginates GitHub data and rejects foreign requests', async t => {
  const calls = [];
  const repo = { id: 1, full_name: 'example-team/sample-app', private: true, pushed_at: '2026-11-11T12:00:00Z', temp_clone_token: 'secret' };
  const server = app(async (endpoint, paginate) => {
    calls.push([endpoint, paginate]);
    if (endpoint === 'user') return { login: 'example-user' };
    if (endpoint.includes('invitations')) throw new Error('Forbidden');
    return [repo];
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base)).status, 200);
  const response = await fetch(`${base}/api/repos`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.equal(result.repos[0].full_name, 'example-team/sample-app');
  assert.equal(result.repos[0].collaborator, true);
  assert.equal(result.repos[0].pushed_at, repo.pushed_at);
  assert.equal(result.repos[0].temp_clone_token, undefined);
  assert.ok(result.warning);
  assert.equal(calls.find(([url]) => url.startsWith('user/repos'))[1], true);
  assert.ok(calls.some(([url, paginate]) => url.includes('affiliation=collaborator&') && paginate));
  assert.equal((await fetch(`${base}/api/repos`, { headers: { Origin: 'https://example.com' } })).status, 403);
  const foreignHostStatus = await new Promise(resolve => {
    request(`${base}/api/repos`, { headers: { Host: 'example.com' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await fetch(`${base}/api/repos`, { method: 'POST', headers: { Origin: base } })).status, 405);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
});

test('GitHub failure returns a useful error without exposing process output', async t => {
  const server = app(async () => { throw new Error('sensitive output'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/repos`);
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /gh auth login/);
  assert.ok(!body.includes('sensitive output'));
});
