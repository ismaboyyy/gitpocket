import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRepos, trackAdditions, type Options } from './filters.ts';

const repos = [
  { id: 1, full_name: 'example-team/sample-app', collaborator: true, private: true, language: 'JavaScript', updated_at: '2026-01-01' },
  { id: 2, full_name: 'org/team', collaborator: false, private: true, updated_at: '2026-02-01' },
  { id: 3, full_name: 'me/own', collaborator: false, private: false, updated_at: '2026-03-01' },
];
const data = { login: 'me', clone_dir: '', repos, invitations: [{ ...repos[0], invited_at: '2026-05-01' }, { ...repos[1], invited_at: '2026-06-01' }] };
const options: Options = { view: 'collaborators', query: '', owners: [], visibility: '', sort: 'added' };

test('latest push sorts independently of metadata updates, with missing dates last', () => {
  const pushData = { ...data, repos: [
    { ...repos[0], pushed_at: '2026-07-01T10:00:00Z' },
    { ...repos[1], pushed_at: '2026-07-01T11:00:00Z' },
    { ...repos[2], pushed_at: null },
  ] };
  assert.deepEqual(filterRepos(pushData, { ...options, view: 'all', sort: 'pushed' }, {}).map(r => r.id), [2, 1, 3]);
  assert.deepEqual(filterRepos(pushData, { ...options, view: 'all', sort: 'updated' }, {}).map(r => r.id), [3, 2, 1]);
  assert.deepEqual(filterRepos(pushData, { ...options, sort: 'pushed' }, {}).map(r => r.id), [1]);
});

test('direct collaborators excludes organization-only access and owned repositories; filters combine', () => {
  assert.deepEqual(filterRepos(data, options, {}).map(r => r.id), [1]);
  assert.deepEqual(filterRepos(data, { ...options, view: 'shared', sort: 'updated' }, {}).map(r => r.id), [2, 1]);
  assert.deepEqual(filterRepos(data, { ...options, view: 'all', visibility: 'public' }, {}).map(r => r.id), [3]);
  assert.equal(filterRepos(data, { ...options, query: 'javascript', owners: ['example-team'], visibility: 'private' }, {}).length, 1);
  assert.equal(filterRepos(data, { ...options, owners: ['org'] }, {}).length, 0);
});

test('initial baseline has no fabricated date; subsequent additions keep their original detection date', () => {
  const baseline = trackAdditions(null, repos.slice(0, 1), '2026-01-01');
  assert.deepEqual(baseline, { 1: null });
  const next = trackAdditions(baseline, repos, '2026-02-01');
  assert.deepEqual(next, { 1: null, 2: '2026-02-01', 3: '2026-02-01' });
  assert.deepEqual(trackAdditions(next, repos, '2026-03-01'), next);
  assert.deepEqual(filterRepos(data, { ...options, view: 'all' }, next).map(r => r.id), [3, 2, 1]);
  assert.deepEqual(filterRepos(data, { ...options, view: 'invitations' }, next).map(r => r.id), [2, 1]);
});
