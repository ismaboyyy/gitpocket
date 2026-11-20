<script lang="ts">
  import { revealItemInDir, openUrl } from '@tauri-apps/plugin-opener';
  import { ChevronDownIcon, CodeIcon, DownloadIcon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { actions, clone, launch } from '$lib/actions.svelte';
  import type { Repo } from '$lib/filters';

  let { repo, invitation = false, prs = true }: { repo: Repo; invitation?: boolean; prs?: boolean } = $props();

  // Brand logos in static/icons; mono ones are inverted in dark mode. VS Code has no bundled logo.
  const toolIcons: Record<string, { file: string; mono: boolean }> = {
    claude: { file: 'claude', mono: false }, codex: { file: 'codex', mono: false }, cursor: { file: 'cursor', mono: true },
    zed: { file: 'zed', mono: true }, codium: { file: 'codium', mono: true }, idea: { file: 'idea', mono: true },
    webstorm: { file: 'webstorm', mono: true }, pycharm: { file: 'pycharm', mono: true }, rustrover: { file: 'rustrover', mono: true },
    subl: { file: 'subl', mono: true },
  };
  const url = $derived(`https://github.com/${repo.full_name.split('/').map(encodeURIComponent).join('/')}`);
</script>

{#if !invitation}
  {#if repo.local_path}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="default" size="sm">Open <ChevronDownIcon /></Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {#each actions.tools as tool (tool.id)}
          <DropdownMenu.Item onSelect={() => launch(tool, repo.local_path!)}>
            {#if toolIcons[tool.id]}
              <img src="/icons/{toolIcons[tool.id].file}.svg" alt="" class="size-4 {toolIcons[tool.id].mono ? 'dark:invert' : ''}" />
            {:else}
              <CodeIcon />
            {/if}
            {tool.name}
          </DropdownMenu.Item>
        {:else}
          <DropdownMenu.Item disabled>No supported app found</DropdownMenu.Item>
        {/each}
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => revealItemInDir(repo.local_path!)}>Show folder</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {:else}
    <Button variant="outline" size="sm" disabled={actions.cloning[repo.full_name]} onclick={() => clone(repo)}>
      <DownloadIcon /> {actions.cloning[repo.full_name] ? 'Cloning…' : 'Clone'}
    </Button>
  {/if}
{/if}
{#if prs}
  <Button variant="outline" size="sm" onclick={() => openUrl(`${url}/${invitation ? 'invitations' : 'pulls'}`)}>
    {invitation ? 'Invitation' : 'PRs'}{#if !invitation && repo.open_prs != null}<span class="text-muted-foreground">{repo.open_prs}</span>{/if}
  </Button>
{/if}
