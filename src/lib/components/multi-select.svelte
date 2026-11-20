<script lang="ts">
  import { CheckIcon, ChevronsUpDownIcon, XIcon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';

  let { options, selected = $bindable([]), all, noun, label, class: className = '' }: {
    options: string[]; selected: string[]; all: string; noun: string; label: string; class?: string;
  } = $props();

  let open = $state(false);
  // Popovers don't lock scrolling: without this the page scrolls behind the open list.
  $effect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = previous);
  });
  const toggle = (value: string) => (selected = selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  const summary = $derived(selected.length === 0 ? all : selected.length === 1 ? selected[0] : `${selected.length} ${noun}`);
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" role="combobox" aria-expanded={open} aria-label={label}
        class={cn('w-48 justify-between font-normal', selected.length && 'border-primary/50', className)}>
        <span class="truncate">{summary}</span>
        <ChevronsUpDownIcon class="opacity-50" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-64 p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Search {noun}…" />
      <Command.List class="max-h-64 overscroll-contain">
        <Command.Empty>No {noun} found.</Command.Empty>
        <Command.Group>
          {#each options as option (option)}
            <Command.Item value={option} onSelect={() => toggle(option)}>
              <CheckIcon class={selected.includes(option) ? '' : 'invisible'} />
              <span class="truncate">{option}</span>
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
      <div class="border-t p-1">
        <Button variant="ghost" size="sm" class="w-full justify-start" disabled={!selected.length} onclick={() => (selected = [])}>
          <XIcon /> Clear selection
        </Button>
      </div>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
