export type Repo = {
  id: number; full_name: string; description?: string | null; private: boolean; language?: string | null;
  updated_at?: string | null; pushed_at?: string | null; archived?: boolean; collaborator?: boolean; invited_at?: string | null; open_prs?: number | null; local_path?: string | null; avatar_url?: string | null; icon?: string | null;
};
export type Overview = { login: string; clone_dir: string; repos: Repo[]; invitations: Repo[]; warning?: string | null };
export type View = 'all' | 'collaborators' | 'shared' | 'invitations';
export type Seen = Record<string, string | null>;
export type Options = { view: View; query: string; owners: string[]; visibility: string; sort: string };

export function trackAdditions(previous: Seen | null, repos: Pick<Repo, 'id'>[], now: string): Seen {
  const seen: Seen = { ...previous };
  for (const repo of repos) {
    if (!Object.hasOwn(seen, repo.id)) seen[repo.id] = previous === null ? null : now;
  }
  return seen;
}

export function filterRepos(data: Overview, { view, query, owners, visibility, sort }: Options, seen: Seen): Repo[] {
  const source = view === 'invitations' ? data.invitations : data.repos;
  return source.filter(repo => {
    const repoOwner = repo.full_name.split('/')[0];
    return (view !== 'collaborators' || repo.collaborator) &&
      (view !== 'shared' || repoOwner.toLowerCase() !== data.login.toLowerCase()) &&
      (!owners.length || owners.includes(repoOwner)) &&
      (!visibility || (visibility === 'private') === repo.private) &&
      `${repo.full_name} ${repo.description || ''} ${repo.language || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }).sort((a, b) => {
    if (sort === 'name') return a.full_name.localeCompare(b.full_name);
    const date = (repo: Repo) => {
      if (sort === 'added') return view === 'invitations' ? repo.invited_at : seen[repo.id];
      return sort === 'pushed' ? repo.pushed_at : repo.updated_at;
    };
    return (Date.parse(date(b) ?? '') || 0) - (Date.parse(date(a) ?? '') || 0) || a.full_name.localeCompare(b.full_name);
  });
}
