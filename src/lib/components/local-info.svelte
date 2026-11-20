<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { CircleCheckIcon, CircleAlertIcon, GitBranchIcon, RefreshCwIcon } from '@lucide/svelte';
  import BranchSelect from '$lib/components/branch-select.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { runner } from '$lib/runner.svelte';
  import type { Repo } from '$lib/filters';

  type Git = {
    branch: string; upstream: string | null; ahead: number; behind: number; changed: number; untracked: number; conflicted: number;
    last_commit: { hash: string; subject: string; author: string; date: string } | null; remote: string | null; branches: number; stashes: number;
  };
  let { repo, defaultBranch, viewBranch, onview }: { repo: Repo; defaultBranch?: string; viewBranch?: string; onview: (branch: string) => void } = $props();
  type Branches = { local: string[]; remote: string[] };
  let branches = $state<Branches>({ local: [], remote: [] });
  let switching = $state(false);

  let git = $state<Git | null>(null);
  let error = $state('');
  let busy = $state(false);

  async function call(command: 'git_status' | 'git_fetch') {
    if (!repo.local_path) return;
    busy = true;
    try {
      git = await invoke<Git>(command, { path: repo.local_path });
      error = '';
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }

  async function loadBranches() {
    if (repo.local_path) branches = await invoke<Branches>('git_branches', { path: repo.local_path }).catch(() => ({ local: [], remote: [] }));
  }

  async function switchTo(branch: string) {
    switching = true;
    try {
      git = await invoke<Git>('git_switch', { path: repo.local_path, branch });
      error = '';
      await loadBranches();
    } catch (e) {
      // git's own message explains why (for example local changes that would be overwritten).
      error = String(e);
    } finally {
      switching = false;
    }
  }

  $effect(() => {
    repo.local_path;
    git = null;
    call('git_status');
    loadBranches();
  });
  // A command run from the README may have changed the repository (pull, install, build…).
  $effect(() => {
    if (!runner.running && runner.code !== null) call('git_status');
  });

  const sync = $derived.by(() => {
    if (!git) return null;
    if (!git.upstream) return { label: 'No upstream', tone: 'secondary', ok: false };
    if (git.ahead && git.behind) return { label: `Diverged (↑${git.ahead} ↓${git.behind})`, tone: 'destructive', ok: false };
    if (git.behind) return { label: `Behind by ${git.behind}`, tone: 'destructive', ok: false };
    if (git.ahead) return { label: `Ahead by ${git.ahead}`, tone: 'secondary', ok: false };
    return { label: 'Up to date', tone: 'secondary', ok: true };
  });
  const dirty = $derived(git ? git.changed + git.untracked + git.conflicted : 0);
  const rel = (iso: string) => {
    const s = (Date.parse(iso) - Date.now()) / 1000;
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    const [u, n] = units.find(([, v]) => Math.abs(s) >= v) ?? ['minute', 60];
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(s / n), u);
  };
</script>

<aside class="flex flex-col gap-4 text-sm" aria-label="Repository information">
  {#if repo.local_path}
    <section class="rounded-lg border p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-medium">Local copy</h2>
        <Button variant="ghost" size="icon" class="size-7" onclick={() => call('git_fetch')} disabled={busy} aria-label="Fetch from GitHub" title="Fetch from GitHub to refresh the sync status">
          <RefreshCwIcon class={busy ? 'animate-spin' : ''} />
        </Button>
      </div>
      {#if error}
        <p class="text-destructive mb-3 text-xs break-words whitespace-pre-line" role="alert">{error}</p>
      {/if}
      {#if !git}
        {#if !error}<p class="text-muted-foreground" role="status">Reading…</p>{/if}
      {:else}
        <dl class="grid gap-3">
          <div>
            <dt class="text-muted-foreground mb-1 text-xs">Branch</dt>
            <dd class="flex flex-col items-start gap-2">
              <BranchSelect label="Switch local branch" value={git.branch} disabled={switching || busy}
                groups={[{ label: 'Local', items: branches.local }, { label: 'On origin only', items: branches.remote }]} onselect={switchTo} />
              {#if viewBranch && git.branch !== viewBranch}
                <p class="text-muted-foreground text-xs">Files and README show <code>{viewBranch}</code> from GitHub.
                  <button class="underline" onclick={() => onview(git!.branch)}>Show {git.branch}</button></p>
              {/if}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">Sync{git.upstream ? ` with ${git.upstream}` : ''}</dt>
            <dd>
              <Badge variant={sync?.tone as 'secondary' | 'destructive'}>
                {#if sync?.ok}<CircleCheckIcon />{:else}<CircleAlertIcon />{/if}{sync?.label}
              </Badge>
              <p class="text-muted-foreground mt-1 text-xs">Based on the last fetch. Use ↻ to check GitHub.</p>
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">Working tree</dt>
            <dd>
              {#if dirty === 0}Clean{:else}
                {[git.changed && `${git.changed} modified`, git.untracked && `${git.untracked} untracked`, git.conflicted && `${git.conflicted} conflicted`].filter(Boolean).join(', ')}
              {/if}
            </dd>
          </div>
          {#if git.last_commit}
            <div>
              <dt class="text-muted-foreground text-xs">Last commit</dt>
              <dd><code>{git.last_commit.hash}</code> {git.last_commit.subject}
                <p class="text-muted-foreground text-xs">{git.last_commit.author} · {rel(git.last_commit.date)}</p></dd>
            </div>
          {/if}
          <div>
            <dt class="text-muted-foreground text-xs">Also</dt>
            <dd>{git.branches} local {git.branches === 1 ? 'branch' : 'branches'}{git.stashes ? `, ${git.stashes} stash${git.stashes === 1 ? '' : 'es'}` : ''}</dd>
          </div>
          {#if git.remote}
            <div><dt class="text-muted-foreground text-xs">Remote</dt><dd class="font-mono text-xs break-all">{git.remote}</dd></div>
          {/if}
        </dl>
      {/if}
    </section>
  {:else}
    <section class="text-muted-foreground rounded-lg border p-4">
      <h2 class="text-foreground mb-1 font-medium">Local copy</h2>
      Not cloned yet. Clone it to see its branch and sync status, and to run README commands.
    </section>
  {/if}

  <section class="rounded-lg border p-4">
    <h2 class="mb-3 font-medium">On GitHub</h2>
    <dl class="grid gap-3">
      {#if defaultBranch}<div><dt class="text-muted-foreground text-xs">Default branch</dt><dd class="font-mono">{defaultBranch}</dd></div>{/if}
      {#if repo.pushed_at}<div><dt class="text-muted-foreground text-xs">Last push</dt><dd>{rel(repo.pushed_at)}</dd></div>{/if}
      <div>
        <dt class="text-muted-foreground text-xs">Open pull requests</dt>
        <dd>{repo.open_prs ?? '—'} <Button variant="link" size="sm" class="h-auto p-0" onclick={() => openUrl(`https://github.com/${repo.full_name}/pulls`)}>View</Button></dd>
      </div>
    </dl>
  </section>
</aside>
