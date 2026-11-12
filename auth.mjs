import { randomBytes, createHash } from 'node:crypto';

const random = () => randomBytes(32).toString('base64url');
const sessionLifetime = 8 * 60 * 60 * 1000;

export function configuration(env = process.env) {
  const origin = new URL(env.APP_URL || 'http://127.0.0.1:3000');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  const mode = env.AUTH_MODE || 'github';
  if (!['local', 'github'].includes(mode)) throw new Error('AUTH_MODE doit être github ou local.');
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('APP_URL doit être une origine sans chemin.');
  if (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:')) throw new Error('HTTPS est obligatoire hors localhost.');
  if (mode === 'local' && !local) throw new Error('Le mode local ne peut pas être publié. Utilise AUTH_MODE=github.');
  if (mode === 'github' && (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)) throw new Error('Configure GITHUB_CLIENT_ID et GITHUB_CLIENT_SECRET dans .env (voir README), ou AUTH_MODE=local pour GitHub CLI en local.');
  return { mode, origin: origin.origin, clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
}

export function githubApi(token, fetcher = fetch) {
  return async (endpoint, paginate = false) => {
    const result = [];
    for (let page = 1; ; page++) {
      const url = new URL(endpoint, 'https://api.github.com/');
      if (url.origin !== 'https://api.github.com') throw new Error('API origin refused');
      if (paginate) { url.searchParams.set('per_page', '100'); url.searchParams.set('page', String(page)); }
      const response = await fetcher(url, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
      if (!response.ok) {
        const error = new Error('GitHub API unavailable');
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      if (!paginate) return data;
      if (!Array.isArray(data)) throw new Error('Invalid GitHub response');
      result.push(...data);
      if (data.length < 100) return result;
    }
  };
}

export function authentication(config, fetcher = fetch) {
  // shortcut: sessions en mémoire pour une seule instance ; utiliser un stockage partagé avant de multiplier les serveurs.
  const sessions = new Map();
  const flows = new Map();
  const secure = config.origin.startsWith('https:') ? '; Secure' : '';
  const cookie = (name, value, age, path = '/') => `${name}=${value}; HttpOnly; SameSite=Lax; Path=${path}; Max-Age=${age}${secure}`;
  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(item => item.trim().split('=')));
  const prune = map => { for (const [id, entry] of map) if (entry.expires <= Date.now()) map.delete(id); };
  const getSession = req => { prune(sessions); return sessions.get(cookies(req).rr_session); };
  return {
    session: getSession,
    async handle(req, res, url) {
      if (config.mode !== 'github') return false;
      if (url.pathname === '/auth/login' && req.method === 'GET') {
        prune(flows);
        if (flows.size >= 1000) { res.writeHead(503).end('Réessaie dans quelques minutes.'); return true; }
        const state = random();
        const verifier = random();
        flows.set(state, { verifier, expires: Date.now() + 600000 });
        const authorize = new URL('https://github.com/login/oauth/authorize');
        authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${config.origin}/auth/callback`, scope: 'repo', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
        res.writeHead(302, { Location: authorize.href, 'Set-Cookie': cookie('rr_oauth', state, 600, '/auth') }).end();
        return true;
      }
      if (url.pathname === '/auth/callback' && req.method === 'GET') {
        prune(flows);
        const state = url.searchParams.get('state');
        const flow = flows.get(state);
        if (!state || !flow || cookies(req).rr_oauth !== state) { res.writeHead(400).end('Connexion expirée ou invalide. Reviens à l’accueil pour réessayer.'); return true; }
        flows.delete(state);
        res.setHeader('Set-Cookie', cookie('rr_oauth', '', 0, '/auth'));
        if (url.searchParams.has('error') || !url.searchParams.get('code')) { res.writeHead(302, { Location: '/?auth=denied' }).end(); return true; }
        const response = await fetcher('https://github.com/login/oauth/access_token', {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code: url.searchParams.get('code'), redirect_uri: `${config.origin}/auth/callback`, code_verifier: flow.verifier }), signal: AbortSignal.timeout(30000), redirect: 'error',
        });
        const token = await response.json();
        if (!response.ok || typeof token.access_token !== 'string' || token.error) throw new Error('OAuth exchange failed');
        const user = await githubApi(token.access_token, fetcher)('user');
        if (typeof user.login !== 'string') throw new Error('Invalid GitHub identity');
        prune(sessions);
        if (sessions.size >= 1000) { res.writeHead(503).end('Trop de sessions actives. Réessaie plus tard.'); return true; }
        sessions.delete(cookies(req).rr_session);
        const id = random();
        const lifetime = Math.min(sessionLifetime, Number(token.expires_in) > 0 ? Number(token.expires_in) * 1000 : sessionLifetime);
        sessions.set(id, { token: token.access_token, login: user.login, expires: Date.now() + lifetime });
        res.setHeader('Set-Cookie', [cookie('rr_oauth', '', 0, '/auth'), cookie('rr_session', id, Math.floor(lifetime / 1000))]);
        res.writeHead(302, { Location: '/' }).end();
        return true;
      }
      if (url.pathname === '/auth/logout' && req.method === 'POST') {
        sessions.delete(cookies(req).rr_session);
        res.writeHead(204, { 'Set-Cookie': cookie('rr_session', '', 0) }).end();
        return true;
      }
      return false;
    },
  };
}
