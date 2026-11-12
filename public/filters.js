export function trackAdditions(previous, repos, now) {
  const seen = { ...previous };
  for (const repo of repos) {
    if (!Object.hasOwn(seen, repo.id)) seen[repo.id] = previous === null ? null : now;
  }
  return seen;
}

export function filterRepos(data, { view, query, owner, visibility, sort }, seen) {
  const source = view === 'invitations' ? data.invitations : data.repos;
  return source.filter(repo => {
    const repoOwner = repo.full_name.split('/')[0];
    return (view !== 'collaborators' || repo.collaborator) &&
      (view !== 'shared' || repoOwner.toLowerCase() !== data.login.toLowerCase()) &&
      (!owner || repoOwner === owner) &&
      (!visibility || (visibility === 'private') === repo.private) &&
      `${repo.full_name} ${repo.description || ''} ${repo.language || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }).sort((a, b) => {
    if (sort === 'name') return a.full_name.localeCompare(b.full_name);
    const date = repo => {
      if (sort === 'added') return view === 'invitations' ? repo.invited_at : seen[repo.id];
      return sort === 'pushed' ? repo.pushed_at : repo.updated_at;
    };
    return (Date.parse(date(b)) || 0) - (Date.parse(date(a)) || 0) || a.full_name.localeCompare(b.full_name);
  });
}
