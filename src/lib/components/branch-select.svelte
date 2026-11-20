<script lang="ts">
  import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';

  // Searchable single choice among named groups of branches.
  let { groups, value, onselect, disabled = false, label }: {
    groups: { label?: string; items: string[] }[]; value: string; onselect: (branch: string) => void; disabled?: boolean; label: string;
  } = $props();
  let open = $state(false);

  // Same body-scroll lock as the multi-select: popovers don't prevent the page scrolling behind them.
  $effect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = previous);
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger {disabled}>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm" role="combobox" aria-expanded={open} aria-label={label} {disabled} class="max-w-full justify-between font-mono">
        <GitBranchIcon /><span class="truncate">{value}</span><ChevronsUpDownIcon class="opacity-50" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-64 p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Search branches…" />
      <Command.List class="max-h-64 overscroll-contain">
        <Command.Empty>No branch found.</Command.Empty>
        {#each groups.filter(g => g.items.length) as group (group.label ?? '')}
          <Command.Group heading={group.label}>
            {#each group.items as item (item)}
              <Command.Item value={item} onSelect={() => { open = false; if (item !== value) onselect(item); }}>
                <CheckIcon class={item === value ? '' : 'invisible'} />
                <span class="truncate font-mono">{item}</span>
              </Command.Item>
            {/each}
          </Command.Group>
        {/each}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
