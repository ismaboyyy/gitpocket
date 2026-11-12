import { filterRepos, trackAdditions } from './filters.js';

const $ = selector => document.querySelector(selector);
let data = null;
let view = 'all';
let seen = {};
let storageWarning = '';

function signedOut(message = '') {
  data = null;
  seen = {};
  $('#repos').replaceChildren();
  $('#account').textContent = '';
  $('#dashboard').hidden = true;
  $('#logout').hidden = true;
  $('#login').hidden = false;
  $('#auth-status').textContent = message;
}

function render() {
  if (!data) return;
  const repos = filterRepos(data, { view, query: $('#search').value, owner: $('#owner').value, visibility: $('#visibility').value, sort: $('#sort').value }, seen);
  $('#repos').replaceChildren();
  $('#count').textContent = `${repos.length} dépôt${repos.length === 1 ? '' : 's'}`;
  $('#account').textContent = `@${data.login}`;
  $('#status').textContent = [data.warning, storageWarning, repos.length ? '' : 'Aucun dépôt à afficher avec ces filtres.'].filter(Boolean).join(' ');
  for (const repo of repos) {
    const card = document.createElement('article');
    const heading = document.createElement('h2');
    const link = document.createElement('a');
    const url = `https://github.com/${repo.full_name.split('/').map(encodeURIComponent).join('/')}`;
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = repo.full_name;
    heading.append(link);
    const badge = document.createElement('span');
    badge.className = 'badge'; badge.textContent = repo.private ? 'Privé' : 'Public';
    const description = document.createElement('p');
    description.textContent = repo.description || 'Aucune description pour ce dépôt.';
    const meta = document.createElement('div'); meta.className = 'meta';
    const addedAt = view === 'invitations' ? repo.invited_at : seen[repo.id];
    meta.textContent = [repo.language, repo.archived ? 'Archivé' : '', addedAt ? `${view === 'invitations' ? 'Invité' : 'Détecté'} le ${new Date(addedAt).toLocaleDateString('fr-CH')}` : '', repo.pushed_at ? `Dernier push : ${new Date(repo.pushed_at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}` : '', $('#sort').value === 'updated' && repo.updated_at ? `Mis à jour le ${new Date(repo.updated_at).toLocaleDateString('fr-CH')}` : ''].filter(Boolean).join(' · ');
    const pulls = document.createElement('a');
    pulls.href = `${url}/${view === 'invitations' ? 'invitations' : 'pulls'}`;
    pulls.target = '_blank'; pulls.rel = 'noopener noreferrer'; pulls.className = 'pulls';
    pulls.textContent = view === 'invitations' ? 'Voir l’invitation ↗' : 'Pull requests ↗';
    card.append(heading, badge, description, meta, pulls);
    $('#repos').append(card);
  }
}

async function load() {
  $('#refresh').disabled = true;
  $('#status').textContent = 'Chargement depuis GitHub…';
  try {
    const response = await fetch('/api/repos');
    const result = await response.json();
    if (response.status === 401) { signedOut('Ta session a expiré. Reconnecte-toi pour continuer.'); return; }
    if (!response.ok) throw new Error(result.error || 'GitHub est indisponible.');
    data = result;
    storageWarning = '';
    try {
      const key = `repo-local:seen:${data.login}`;
      const saved = localStorage.getItem(key);
      const previous = saved === null ? null : JSON.parse(saved);
      if (previous !== null && (typeof previous !== 'object' || Array.isArray(previous))) throw new Error('Invalid history');
      seen = trackAdditions(previous, data.repos, new Date().toISOString());
      localStorage.setItem(key, JSON.stringify(seen));
    } catch {
      seen = {};
      storageWarning = 'Le suivi des nouveaux ajouts est indisponible : le stockage local du navigateur n’est pas accessible.';
    }
    const selectedOwner = $('#owner').value;
    $('#owner').replaceChildren(new Option('Tous les propriétaires', ''));
    const owners = [...new Set([...data.repos, ...data.invitations].map(repo => repo.full_name.split('/')[0]))].sort((a, b) => a.localeCompare(b));
    for (const owner of owners) $('#owner').append(new Option(owner, owner));
    $('#owner').value = owners.includes(selectedOwner) ? selectedOwner : '';
    render();
  } catch (error) {
    $('#status').textContent = error.message;
    if (!data) $('#count').textContent = 'Connexion à vérifier';
  } finally { $('#refresh').disabled = false; }
}
$('#search').addEventListener('input', render);
for (const selector of ['#owner', '#visibility', '#sort']) $(selector).addEventListener('change', render);
$('#refresh').addEventListener('click', load);
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  view = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));
$('#logout').addEventListener('click', async () => {
  $('#logout').disabled = true;
  try {
    const response = await fetch('/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('La déconnexion a échoué. Réessaie.');
    location.replace('/');
  } catch (error) {
    $('#auth-status').textContent = error.message;
    $('#logout').disabled = false;
  }
});

async function start() {
  try {
    const response = await fetch('/api/session');
    if (!response.ok) throw new Error('Impossible de vérifier la connexion. Recharge la page.');
    const session = await response.json();
    if (!session.authenticated) {
      const denied = new URLSearchParams(location.search).get('auth') === 'denied';
      signedOut(denied ? 'Autorisation GitHub annulée. Tu peux réessayer.' : '');
      return;
    }
    $('#auth-status').textContent = '';
    $('#dashboard').hidden = false;
    $('#logout').hidden = session.mode !== 'github';
    await load();
  } catch (error) { $('#auth-status').textContent = error.message; }
}
start();
