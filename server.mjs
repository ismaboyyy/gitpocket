import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { authentication, configuration, githubApi } from './auth.mjs';

const exec = promisify(execFile);
async function github(endpoint, paginate = false) {
  const args = ['api', '--hostname', 'github.com', endpoint];
  if (paginate) args.push('--paginate', '--slurp');
  const { stdout } = await exec('gh', args, { timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
  const data = JSON.parse(stdout);
  return paginate ? data.flat() : data;
}

function repository(repo) {
  return Object.fromEntries(['id', 'full_name', 'description', 'private', 'language', 'updated_at', 'pushed_at', 'archived'].map(key => [key, repo[key]]));
}

export function app(localApi = github, config = { mode: 'local', origin: 'http://127.0.0.1:3000' }, fetcher = fetch) {
  const auth = authentication(config, fetcher);
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const host = req.headers.host;
    const isLocal = config.mode === 'local';
    const origin = isLocal ? `http://${host}` : config.origin;
    const pathname = req.url.split('?')[0];
    const oauthNavigation = req.method === 'GET' && ['/auth/login', '/auth/callback'].includes(pathname);
    if ((isLocal ? !/^(localhost|127\.0\.0\.1):\d+$/.test(host || '') : host !== new URL(config.origin).host) ||
        (req.headers.origin && req.headers.origin !== origin) ||
        (!oauthNavigation && req.headers['sec-fetch-site'] === 'cross-site') ||
        (req.method === 'POST' && req.headers.origin !== origin)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const url = new URL(req.url, origin);
      if (await auth.handle(req, res, url)) return;
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      const session = isLocal ? null : auth.session(req);
      if (url.pathname === '/api/session') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ mode: config.mode, authenticated: isLocal || !!session, login: session?.login }));
        return;
      }
      if (req.url === '/api/repos') {
        if (!isLocal && !session) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: 'Connecte-toi avec GitHub pour voir tes dépôts.' }));
          return;
        }
        const api = isLocal ? localApi : githubApi(session.token, fetcher);
        const [user, repos, collaborators, invitations] = await Promise.all([
          api('user'),
          api('user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100', true),
          api('user/repos?affiliation=collaborator&per_page=100', true),
          api('user/repository_invitations?per_page=100', true).then(data => ({ data })).catch(() => ({ data: [], warning: 'Les invitations n’ont pas pu être chargées. Vérifie les permissions GitHub puis réessaie.' })),
        ]);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        const collaboratorIds = new Set(collaborators.map(repo => repo.id));
        res.end(JSON.stringify({ login: user.login, repos: repos.map(repo => ({ ...repository(repo), collaborator: collaboratorIds.has(repo.id) })), invitations: invitations.data.map(i => ({ ...repository(i.repository), invited_at: i.created_at })), warning: invitations.warning }));
        return;
      }
      const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/filters.js': ['filters.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
      const file = files[url.pathname];
      if (!file) { res.writeHead(404).end(); return; }
      const body = await readFile(new URL(`./public/${file[0]}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` });
      res.end(body);
    } catch (error) {
      res.writeHead(error.status === 401 ? 401 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: isLocal ? 'Impossible de charger GitHub. Vérifie ta connexion Internet et lance « gh auth login --hostname github.com ». Vérifie aussi les autorisations et le SSO de ton organisation.' : 'Connexion GitHub indisponible ou expirée. Reviens à l’accueil et reconnecte-toi. Pour un dépôt manquant, vérifie les autorisations et le SSO de ton organisation.' }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = configuration();
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT invalide.');
    app(undefined, config).listen(port, '127.0.0.1', () => console.log(`GitPocket : ${config.origin} (${config.mode})`));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
