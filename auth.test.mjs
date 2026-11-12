import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { configuration, githubApi } from './auth.mjs';
import { app } from './server.mjs';

test('configuration refuses insecure hosted origins, missing credentials and hosted CLI mode', () => {
  const env = { AUTH_MODE: 'github', APP_URL: 'https://radar.example', GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret' };
  assert.equal(configuration(env).origin, 'https://radar.example');
  assert.throws(() => configuration({ ...env, GITHUB_CLIENT_SECRET: '' }), /GITHUB_CLIENT/);
  assert.throws(() => configuration({ ...env, APP_URL: 'http://radar.example' }), /HTTPS/);
  assert.throws(() => configuration({ ...env, AUTH_MODE: 'local' }), /mode local/);
  assert.throws(() => configuration({ ...env, APP_URL: 'https://radar.example/path' }), /origine/);
  assert.equal(configuration({ AUTH_MODE: 'local' }).mode, 'local');
});

test('OAuth binds state to browser, uses PKCE, isolates users, expires sessions and protects logout', async t => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  let exchanges = 0;
  const verifiers = [];
  const fetcher = async (url, options) => {
    url = new URL(url);
    if (url.pathname === '/login/oauth/access_token') {
      exchanges++;
      assert.equal(options.body.get('client_secret'), 'test-secret');
      verifiers.push(options.body.get('code_verifier'));
      return Response.json({ access_token: `token-${options.body.get('code')}` });
    }
    const login = options.headers.Authorization.replace('Bearer token-', '');
    assert.ok(['alice', 'bob'].includes(login));
    if (url.pathname === '/user') return Response.json({ login });
    if (url.pathname.includes('invitations')) return Response.json([]);
    return Response.json([{ id: login === 'alice' ? 1 : 2, full_name: `${login}/private`, private: true }]);
  };
  const config = { mode: 'github', origin: 'https://radar.example', clientId: 'test-client', clientSecret: 'test-secret' };
  const server = app(() => { throw new Error('CLI must never be used in OAuth mode'); }, config, fetcher);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = (path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers: { Host: 'radar.example', ...headers } }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject); req.end();
  });
  assert.equal((await call('/')).status, 200);
  assert.equal((await call('/api/repos')).status, 401);
  assert.equal(JSON.parse((await call('/api/session')).body).authenticated, false);
  const login = async name => {
    const start = await call('/auth/login', { 'Sec-Fetch-Site': 'cross-site' });
    assert.equal(start.status, 302);
    const authorize = new URL(start.headers.location);
    assert.equal(authorize.origin, 'https://github.com');
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
    const flowCookie = start.headers['set-cookie'][0].split(';')[0];
    assert.match(start.headers['set-cookie'][0], /HttpOnly; SameSite=Lax; Path=\/auth; Max-Age=600; Secure/);
    const callback = `/auth/callback?state=${authorize.searchParams.get('state')}&code=${name}`;
    assert.equal((await call(callback)).status, 400);
    const completed = await call(callback, { Cookie: flowCookie, 'Sec-Fetch-Site': 'cross-site' });
    assert.equal(completed.status, 302);
    assert.equal(createHash('sha256').update(verifiers.at(-1)).digest('base64url'), authorize.searchParams.get('code_challenge'));
    assert.equal((await call(callback, { Cookie: flowCookie })).status, 400);
    const sessionCookie = completed.headers['set-cookie'].find(c => c.startsWith('rr_session='));
    assert.match(sessionCookie, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=28800; Secure/);
    assert.ok(!sessionCookie.includes('token-'));
    return sessionCookie.split(';')[0];
  };
  const alice = await login('alice');
  const bob = await login('bob');
  assert.equal(exchanges, 2);
  for (const [cookie, name] of [[alice, 'alice'], [bob, 'bob']]) {
    const repos = await call('/api/repos', { Cookie: cookie });
    assert.equal(repos.status, 200);
    assert.equal(JSON.parse(repos.body).repos[0].full_name, `${name}/private`);
    assert.ok(!repos.body.includes('token-'));
    assert.equal(JSON.parse((await call('/api/session', { Cookie: cookie })).body).login, name);
  }
  assert.equal((await call('/api/repos', { Cookie: alice, Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('/auth/logout', { Cookie: alice }, 'POST')).status, 403);
  assert.equal((await call('/auth/logout', { Cookie: alice, Origin: config.origin }, 'POST')).status, 204);
  assert.equal((await call('/api/repos', { Cookie: alice })).status, 401);
  assert.equal((await call('/api/repos', { Cookie: bob })).status, 200);
  now += 8 * 60 * 60 * 1000 + 1;
  assert.equal((await call('/api/repos', { Cookie: bob })).status, 401);
  const expiredFlow = await call('/auth/login');
  now += 600001;
  const state = new URL(expiredFlow.headers.location).searchParams.get('state');
  assert.equal((await call(`/auth/callback?state=${state}&code=alice`, { Cookie: expiredFlow.headers['set-cookie'][0].split(';')[0] })).status, 400);
});

test('API pagination uses only GitHub with the current user token', async () => {
  const calls = [];
  const api = githubApi('user-token', async (url, options) => {
    calls.push(String(url));
    assert.equal(options.headers.Authorization, 'Bearer user-token');
    return Response.json(url.searchParams.get('page') === '1' ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: 100 }]);
  });
  assert.equal((await api('user/repos?affiliation=collaborator', true)).length, 101);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /page=2/);
  await assert.rejects(api('https://evil.example/'), /origin refused/);
});
