<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { open as pickFolder } from '@tauri-apps/plugin-dialog';
  import { onMount, tick } from 'svelte';
  import { FolderIcon, LayoutGridIcon, ListIcon, LockIcon, RefreshCwIcon, SearchIcon, XIcon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as Tabs from '$lib/components/ui/tabs';
  import RepoActions from '$lib/components/repo-actions.svelte';
  import RepoDetail from '$lib/components/repo-detail.svelte';
  import { actions, loadTools } from '$lib/actions.svelte';
  import MultiSelect from '$lib/components/multi-select.svelte';
  import { languageColor } from '$lib/languages';
  import * as Select from '$lib/components/ui/select';
  import { filterRepos, trackAdditions, type Overview, type Repo, type Seen, type View } from '$lib/filters';

  const sorts = { pushed: 'Last push', added: 'Recently detected', updated: 'Last update', name: 'Name' };
  const visibilities = { '': 'Public and private', private: 'Private', public: 'Public' };

  let data = $state<Overview | null>(null);
  let seen = $state<Seen>({});
  let view = $state<View>('all');
  let query = $state('');
  let selectedOwners = $state<string[]>([]);
  let visibility = $state('');
  let sort = $state('pushed');
  let loading = $state(false);
  let error = $state('');
  let storageWarning = $state('');
  let layout = $state<'list' | 'cards'>('list');
  try { if (localStorage.getItem('gitpocket:layout') === 'cards') layout = 'cards'; } catch {}
  $effect(() => { try { localStorage.setItem('gitpocket:layout', layout); } catch {} });
  let search: HTMLInputElement | null = $state(null);

  const repos = $derived(data ? filterRepos(data, { view, query, owners: selectedOwners, visibility, sort }, seen) : []);
  const owners = $derived(data ? [...new Set([...data.repos, ...data.invitations].map(r => r.full_name.split('/')[0]))].sort((a, b) => a.localeCompare(b)) : []);
  const counts = $derived<Record<View, number>>({
    all: data?.repos.length ?? 0,
    collaborators: data?.repos.filter(r => r.collaborator).length ?? 0,
    shared: data?.repos.filter(r => r.full_name.split('/')[0].toLowerCase() !== data!.login.toLowerCase()).length ?? 0,
    invitations: data?.invitations.length ?? 0,
  });
  const tabs: [View, string][] = [['all', 'All'], ['collaborators', 'Collaborations'], ['shared', 'Shared'], ['invitations', 'Invitations']];
  const filtered = $derived(!!query || !!selectedOwners.length || !!visibility);
  const notices = $derived([data?.warning, storageWarning, actions.error].filter(Boolean));

  const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  function ago(iso?: string | null) {
    if (!iso) return '';
    const seconds = (Date.parse(iso) - Date.now()) / 1000;
    const [unit, size] = units.find(([, s]) => Math.abs(seconds) >= s) ?? ['minute', 60];
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / size), unit);
  }

  function reset() {
    query = visibility = '';
    selectedOwners = [];
  }

  async function load() {
    loading = true;
    error = '';
    try {
      data = await invoke<Overview>('overview');
      storageWarning = '';
      try {
        const key = `gitpocket:seen:${data.login}`;
        const saved = localStorage.getItem(key);
        const previous = saved === null ? null : JSON.parse(saved);
        if (previous !== null && (typeof previous !== 'object' || Array.isArray(previous))) throw new Error('Invalid history');
        seen = trackAdditions(previous, data.repos, new Date().toISOString());
        localStorage.setItem(key, JSON.stringify(seen));
      } catch {
        seen = {};
        storageWarning = 'Tracking of new additions is unavailable: local storage is not accessible.';
      }
      selectedOwners = selectedOwners.filter(o => owners.includes(o));
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }
  onMount(() => {
    load();
    loadTools();
  });

  async function chooseFolder() {
    const dir = await pickFolder({ directory: true, defaultPath: data?.clone_dir });
    if (typeof dir !== 'string') return;
    await invoke('set_clone_dir', { dir });
    await load();
  }

  // Detail view replaces the list in place, so filters and loaded data survive going back.
  let detail = $state<Repo | null>(null);
  let scrollY = 0;
  function openRepo(repo: Repo) {
    scrollY = window.scrollY;
    detail = repo;
    window.scrollTo(0, 0);
  }
  async function closeRepo() {
    detail = null;
    await tick();
    window.scrollTo(0, scrollY);
  }

  const repoUrl = (name: string) => `https://github.com/${name.split('/').map(encodeURIComponent).join('/')}`;
</script>

<svelte:window onkeydown={e => { if (!detail && e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); search?.focus(); } }} />

{#if detail}
  <RepoDetail repo={detail} onback={closeRepo} />
{:else}

<div class="bg-background/90 sticky top-0 z-10 border-b backdrop-blur">
  <div class="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-4">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-lg font-semibold">GitPocket</h1>
      <div class="flex items-center gap-2">
        {#if data}
          <Button variant="ghost" size="sm" onclick={chooseFolder} title="Folder where repositories are cloned">
            <FolderIcon /> <span class="max-w-48 truncate">{data.clone_dir}</span>
          </Button>
          <span class="text-muted-foreground text-sm">@{data.login}</span>
        {/if}
        <Button variant="outline" size="icon" onclick={load} disabled={loading} aria-label="Refresh" title="Refresh">
          <RefreshCwIcon class={loading ? 'animate-spin' : ''} />
        </Button>
      </div>
    </div>

    <div class="relative">
      <SearchIcon class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input bind:ref={search} type="search" bind:value={query} class="pl-9" placeholder="Search repositories…  ( / )" aria-label="Search repositories" />
    </div>

    <Tabs.Root bind:value={view as string}>
      <Tabs.List class="w-full">
        {#each tabs as [value, label]}
          <Tabs.Trigger {value}>{label} <span class="text-muted-foreground text-xs">{counts[value]}</span></Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>

    <div class="flex flex-wrap items-center gap-2">
      <MultiSelect options={owners} bind:selected={selectedOwners} all="All owners" noun="owners" label="Owners" />
      <Select.Root type="single" bind:value={visibility}>
        <Select.Trigger class="w-44" aria-label="Visibility">{visibilities[visibility as keyof typeof visibilities]}</Select.Trigger>
        <Select.Content>
          {#each Object.entries(visibilities) as [v, label]}<Select.Item value={v}>{label}</Select.Item>{/each}
        </Select.Content>
      </Select.Root>
      <Select.Root type="single" bind:value={sort}>
        <Select.Trigger class="w-44" aria-label="Sort by">Sort: {sorts[sort as keyof typeof sorts]}</Select.Trigger>
        <Select.Content>
          {#each Object.entries(sorts) as [v, label]}<Select.Item value={v}>{label}</Select.Item>{/each}
        </Select.Content>
      </Select.Root>
      {#if filtered}
        <Button variant="ghost" size="sm" onclick={reset}><XIcon /> Clear filters</Button>
      {/if}
      <span class="text-muted-foreground ml-auto text-sm">{repos.length} {repos.length === 1 ? 'repository' : 'repositories'}</span>
      <div class="flex gap-1" role="group" aria-label="Layout">
        <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon" onclick={() => (layout = 'list')} aria-label="List view" aria-pressed={layout === 'list'} title="List"><ListIcon /></Button>
        <Button variant={layout === 'cards' ? 'secondary' : 'ghost'} size="icon" onclick={() => (layout = 'cards')} aria-label="Card view" aria-pressed={layout === 'cards'} title="Cards"><LayoutGridIcon /></Button>
      </div>
    </div>
  </div>
</div>

<main class="mx-auto px-6 py-4 {layout === 'cards' ? 'max-w-6xl' : 'max-w-4xl'}">
  {#each notices as notice}
    <p class="text-muted-foreground mb-3 text-sm" role="status">{notice}</p>
  {/each}

  {#if error}
    <div class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p class="text-destructive max-w-md text-sm">{error}</p>
      <Button variant="outline" onclick={load}>Try again</Button>
    </div>
  {:else if !data}
    <p class="text-muted-foreground py-16 text-center text-sm" role="status">Loading from GitHub…</p>
  {:else if !repos.length}
    <div class="flex flex-col items-center gap-3 py-16 text-center">
      <p class="text-muted-foreground text-sm">No repositories match.</p>
      {#if filtered}<Button variant="outline" size="sm" onclick={reset}>Clear filters</Button>{/if}
    </div>
  {:else}
    <ul class={layout === 'cards' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'divide-y rounded-lg border'} aria-label="Repositories">
      {#each repos as repo (repo.id)}
        {@const url = repoUrl(repo.full_name)}
        {@const added = view === 'invitations' ? repo.invited_at : seen[repo.id]}
        <li class={layout === 'cards' ? 'hover:bg-accent/50 bg-card flex flex-col gap-3 rounded-lg border p-4' : 'hover:bg-accent/50 flex items-center gap-3 px-4 py-3'}>
          <div class="flex min-w-0 flex-1 items-center gap-3">
          {#if repo.icon ?? repo.avatar_url}
            <img src={repo.icon ?? repo.avatar_url} alt="" loading="lazy" class="bg-muted size-9 shrink-0 rounded-md object-contain" onerror={e => ((e.currentTarget as HTMLElement).style.visibility = 'hidden')} />
          {/if}
          <button class="min-w-0 flex-1 text-left" onclick={() => (view === 'invitations' ? openUrl(url) : openRepo(repo))} title={view === 'invitations' ? 'Open on GitHub' : 'Open repository'}>
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">{repo.full_name}</span>
              {#if repo.private}<Badge variant="secondary"><LockIcon /> Private</Badge>{/if}
              {#if repo.archived}<Badge variant="outline">Archived</Badge>{/if}
            </div>
            <p class="text-muted-foreground text-sm {layout === 'cards' ? 'line-clamp-2' : 'truncate'}">{repo.description || 'No description.'}</p>
          </button>
          </div>
          <div class="text-muted-foreground shrink-0 text-xs {layout === 'cards' ? 'flex gap-2' : 'hidden text-right sm:block'}">
            {#if repo.language}
              <Badge variant="outline" class="text-foreground">
                <span class="size-2 rounded-full" style="background:{languageColor(repo.language)}"></span>{repo.language}
              </Badge>
            {/if}
            <div title={repo.pushed_at ?? ''}>
              {#if view === 'invitations' && added}Invited {ago(added)}
              {:else if repo.pushed_at}Pushed {ago(repo.pushed_at)}{/if}
            </div>
          </div>
          <div class="flex shrink-0 gap-2"><RepoActions {repo} invitation={view === 'invitations'} /></div>
        </li>
      {/each}
    </ul>
  {/if}
</main>
{/if}
