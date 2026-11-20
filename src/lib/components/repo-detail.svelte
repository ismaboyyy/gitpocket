<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { onMount } from 'svelte';
  import { ArrowLeftIcon, ExternalLinkIcon, FolderIcon, HardDriveIcon, LockIcon } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import BranchSelect from '$lib/components/branch-select.svelte';
  import FileIcon from '$lib/components/file-icon.svelte';
  import FileViewer from '$lib/components/file-viewer.svelte';
  import LocalInfo from '$lib/components/local-info.svelte';
  import RunPanel from '$lib/components/run-panel.svelte';
  import { run, runner } from '$lib/runner.svelte';
  import RepoActions from '$lib/components/repo-actions.svelte';
  import { actions } from '$lib/actions.svelte';
  import type { Repo } from '$lib/filters';
  import { languageColor } from '$lib/languages';
  import { renderReadme } from '$lib/markdown';

  type Entry = { name: string; path: string; type: string; size: number };
  type Detail = { default_branch: string; readme: string | null; readme_path: string | null };

  let { repo, onback }: { repo: Repo; onback: () => void } = $props();

  let detail = $state<Detail | null>(null);
  let entries = $state<Entry[]>([]);
  let path = $state('');
  let error = $state('');
  let filesLoading = $state(true);
  let viewing = $state<string | null>(null);
  // Branch browsed on GitHub (files, README); independent from the local checkout.
  let branch = $state('');
  let remoteBranches = $state<string[]>([]);
  let pending = $state<string | null>(null);
  let readmeEl: HTMLElement | undefined = $state();

  const url = $derived(`https://github.com/${repo.full_name}`);
  const html = $derived(detail?.readme ? renderReadme(detail.readme, repo.full_name, branch || detail.default_branch, detail.readme_path ?? 'README.md') : '');
  const crumbs = $derived(path ? path.split('/') : []);
  const size = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

  async function go(next: string) {
    filesLoading = true;
    try {
      entries = await invoke<Entry[]>('repo_files', { fullName: repo.full_name, path: next, branch: branch || undefined });
      path = next;
      error = '';
    } catch (e) {
      error = String(e);
    } finally {
      filesLoading = false;
    }
  }

  async function loadDetail() {
    try {
      detail = await invoke<Detail>('repo_detail', { fullName: repo.full_name, branch: branch || undefined });
      branch ||= detail.default_branch;
    } catch (e) {
      error = String(e);
    }
  }

  async function switchRemote(next: string) {
    branch = next;
    viewing = null;
    await Promise.all([loadDetail(), go('')]);
  }

  function viewLocalBranch(name: string) {
    if (remoteBranches.includes(name)) switchRemote(name);
    else error = `Branch “${name}” is not on GitHub yet.`;
  }

  onMount(async () => {
    invoke<string[]>('repo_branches', { fullName: repo.full_name }).then(b => (remoteBranches = b)).catch(() => {});
    await loadDetail();
    await go('');
  });

  function open(entry: Entry) {
    if (entry.type === 'dir') go(entry.path);
    else if (entry.type === 'file') viewing = entry.path;
    else openUrl(`${url}/blob/${branch || 'HEAD'}/${entry.path.split('/').map(encodeURIComponent).join('/')}`);
  }

  // Adds a "Run" button to shell code blocks, only when the repository is cloned.
  const shellLangs = new Set(['sh', 'bash', 'shell', 'zsh', 'console', 'shell-session']);
  $effect(() => {
    html;
    const local = repo.local_path;
    if (!readmeEl) return;
    readmeEl.querySelectorAll('.run-btn').forEach(b => b.remove());
    if (!local) return;
    for (const code of readmeEl.querySelectorAll('pre > code')) {
      const lang = [...code.classList].find(c => c.startsWith('language-'))?.slice(9) ?? '';
      if (!shellLangs.has(lang)) continue;
      let text = code.textContent ?? '';
      // In console transcripts only "$ " lines are commands.
      if (lang === 'console' || lang === 'shell-session') text = text.split('\n').filter(l => l.startsWith('$ ')).map(l => l.slice(2)).join('\n');
      text = text.trim();
      if (!text) continue;
      const button = document.createElement('button');
      button.className = 'run-btn absolute top-2 right-2 rounded border border-white/20 bg-black/40 px-2 py-0.5 text-xs text-white hover:bg-black/60';
      button.textContent = '▶ Run';
      button.title = `Run in ${local}`;
      button.onclick = () => (pending = text);
      code.parentElement!.classList.add('relative');
      code.parentElement!.append(button);
    }
  });

  // README links open in the system browser; in-page anchors are ignored.
  function readmeClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') ?? '';
    if (/^https?:/i.test(href)) openUrl(href);
  }
</script>

<svelte:window onkeydown={e => { if (e.key === 'Escape' && !document.querySelector('[role=dialog],[role=alertdialog]')) onback(); }} />

<div class="bg-background/90 sticky top-0 z-10 border-b backdrop-blur">
  <div class="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" onclick={onback} aria-label="Back to repositories" title="Back (Esc)"><ArrowLeftIcon /></Button>
      {#if repo.icon ?? repo.avatar_url}
        <img src={repo.icon ?? repo.avatar_url} alt="" class="bg-muted size-10 shrink-0 rounded-md object-contain" onerror={e => ((e.currentTarget as HTMLElement).style.visibility = 'hidden')} />
      {/if}
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-lg font-semibold">{repo.full_name}</h1>
          {#if repo.private}<Badge variant="secondary"><LockIcon /> Private</Badge>{/if}
          {#if repo.archived}<Badge variant="outline">Archived</Badge>{/if}
          {#if repo.language}
            <Badge variant="outline" class="text-foreground">
              <span class="size-2 rounded-full" style="background:{languageColor(repo.language)}"></span>{repo.language}
            </Badge>
          {/if}
        </div>
        <p class="text-muted-foreground truncate text-sm">{repo.description || 'No description.'}</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <RepoActions {repo} />
        <Button variant="outline" size="sm" onclick={() => openUrl(url)}>GitHub <ExternalLinkIcon /></Button>
      </div>
    </div>
    <p class="text-muted-foreground flex items-center gap-2 text-xs">
      <HardDriveIcon class="size-3.5" />
      {#if repo.local_path}
        Stored locally in <code class="truncate">{repo.local_path}</code>
      {:else}
        Not stored locally yet
      {/if}
    </p>
  </div>
</div>

<main class="mx-auto grid max-w-6xl gap-6 px-6 py-4 lg:grid-cols-[18rem_minmax(0,1fr)]" style:padding-bottom={runner.open ? `${runner.height + 120}px` : undefined}>
  <LocalInfo {repo} defaultBranch={detail?.default_branch} viewBranch={branch} onview={viewLocalBranch} />
  <div class="flex min-w-0 flex-col gap-6">
  {#if actions.error}<p class="text-destructive text-sm" role="alert">{actions.error}</p>{/if}
  {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}

  <section aria-label="Files">
    <nav class="mb-2 flex flex-wrap items-center gap-1 text-sm" aria-label="Path">
      <button class="hover:underline {crumbs.length ? 'text-muted-foreground' : 'font-medium'}" onclick={() => go('')}>{repo.full_name.split('/')[1]}</button>
      {#each crumbs as crumb, i}
        <span class="text-muted-foreground">/</span>
        <button class="hover:underline {i === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'}" onclick={() => go(crumbs.slice(0, i + 1).join('/'))}>{crumb}</button>
      {/each}
      {#if branch}
        <span class="ml-2">
          <BranchSelect label="Browse a GitHub branch" value={branch} groups={[{ items: remoteBranches.length ? remoteBranches : [branch] }]} onselect={switchRemote} />
        </span>
      {/if}
    </nav>
    {#if filesLoading && !entries.length}
      <p class="text-muted-foreground py-6 text-center text-sm" role="status">Loading files…</p>
    {:else}
      <ul class="divide-y rounded-lg border {filesLoading ? 'opacity-60' : ''}">
        {#if path}
          <li><button class="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-2 text-left text-sm" onclick={() => go(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')}><FolderIcon class="size-4" /> ..</button></li>
        {/if}
        {#each entries as entry (entry.path)}
          <li>
            <button class="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-2 text-left text-sm" onclick={() => open(entry)}>
              <FileIcon name={entry.name} dir={entry.type === 'dir' || entry.type === 'submodule'} />
              <span class="flex-1 truncate">{entry.name}</span>
              {#if entry.type === 'file'}<span class="text-muted-foreground text-xs">{size(entry.size)}</span>{/if}
            </button>
          </li>
        {:else}
          <li class="text-muted-foreground px-4 py-6 text-center text-sm">This folder is empty.</li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if html}
    <section aria-label="README" class="rounded-lg border">
      <h2 class="border-b px-4 py-2 text-sm font-medium">{detail?.readme_path}</h2>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div bind:this={readmeEl} class="prose prose-sm dark:prose-invert max-w-none p-4" onclick={readmeClick} role="presentation">{@html html}</div>
    </section>
  {:else if detail}
    <p class="text-muted-foreground text-center text-sm">This repository has no README.</p>
  {/if}
  </div>
</main>

<FileViewer fullName={repo.full_name} branch={branch || 'HEAD'} bind:path={viewing} />
<RunPanel />

<AlertDialog.Root open={pending !== null} onOpenChange={open => { if (!open) pending = null; }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Run this command?</AlertDialog.Title>
      <AlertDialog.Description>It runs on your computer, in <code>{repo.local_path}</code>, with your permissions. Only run commands you trust.</AlertDialog.Description>
    </AlertDialog.Header>
    <pre class="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs">{pending}</pre>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={() => { if (pending && repo.local_path) run(repo.local_path, pending); pending = null; }} disabled={runner.running}>Run</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
