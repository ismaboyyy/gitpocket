<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { ExternalLinkIcon } from '@lucide/svelte';
  import hljs from 'highlight.js/lib/common';
  import FileIcon from '$lib/components/file-icon.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Sheet from '$lib/components/ui/sheet';

  type FileContent = { kind: 'text' | 'image' | 'binary' | 'large'; text: string | null; data_url: string | null; size: number };
  let { fullName, branch, path = $bindable(null) }: { fullName: string; branch: string; path: string | null } = $props();

  let file = $state<FileContent | null>(null);
  let error = $state('');
  let loading = $state(false);

  const url = $derived(path ? `https://github.com/${fullName}/blob/${branch}/${path.split('/').map(encodeURIComponent).join('/')}` : '');
  const lang = $derived.by(() => {
    const ext = path?.split('.').pop()?.toLowerCase() ?? '';
    const alias: Record<string, string> = { svelte: 'xml', vue: 'xml', toml: 'ini', mjs: 'javascript', cjs: 'javascript', tsx: 'typescript' };
    const name = alias[ext] ?? ext;
    return hljs.getLanguage(name) ? name : null;
  });
  // highlight.js escapes the source, so its output is safe to inject.
  const html = $derived(file?.text != null && lang ? hljs.highlight(file.text, { language: lang }).value : null);

  const lineNumbers = $derived(file?.text != null ? Array.from({ length: file.text.replace(/\n$/, '').split('\n').length }, (_, i) => i + 1).join('\n') : '');

  $effect(() => {
    const current = path;
    file = null;
    error = '';
    if (!current) return;
    loading = true;
    invoke<FileContent>('repo_file', { fullName, path: current, branch })
      .then(f => { if (path === current) file = f; })
      .catch(e => { if (path === current) error = String(e); })
      .finally(() => { if (path === current) loading = false; });
  });
</script>

<Sheet.Root open={path !== null} onOpenChange={open => { if (!open) path = null; }}>
  <Sheet.Content side="right" class="w-full data-[side=right]:sm:max-w-4xl">
    <Sheet.Header class="border-b pr-12">
      <Sheet.Title class="flex items-center gap-2 truncate font-mono text-sm">{#if path}<FileIcon name={path.split('/').pop()!} />{/if}{path}</Sheet.Title>
      <Sheet.Description class="flex items-center gap-2">
        <span>{branch}{file ? ` · ${file.size.toLocaleString()} bytes` : ''}</span>
        <Button variant="link" size="sm" class="h-auto p-0" onclick={() => openUrl(url)}>GitHub <ExternalLinkIcon /></Button>
      </Sheet.Description>
    </Sheet.Header>
    <div class="min-h-0 flex-1 overflow-auto px-4 pb-4">
      {#if loading}
        <p class="text-muted-foreground py-8 text-center text-sm" role="status">Loading…</p>
      {:else if error}
        <p class="text-destructive text-sm" role="alert">{error}</p>
      {:else if file?.kind === 'image'}
        <img src={file.data_url} alt={path} class="mx-auto max-w-full rounded border" />
      {:else if file?.kind === 'binary'}
        <p class="text-muted-foreground py-8 text-center text-sm">Binary file, no preview.</p>
      {:else if file?.kind === 'large'}
        <p class="text-muted-foreground py-8 text-center text-sm">This file is too large to preview here (over 1 MB).</p>
      {:else if file}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="flex font-mono text-xs leading-5">
          <!-- Line numbers: lines never wrap (white-space: pre), so the two columns stay aligned. -->
          <pre aria-hidden="true" class="bg-popover text-muted-foreground sticky left-0 pr-4 text-right select-none">{lineNumbers}</pre>
          <pre class="hljs"><code>{#if html}{@html html}{:else}{file.text}{/if}</code></pre>
        </div>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
