<script lang="ts">
  import { SquareIcon, XIcon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { runner, stop } from '$lib/runner.svelte';

  const min = 80;
  const max = () => Math.round(window.innerHeight * 0.8);
  const clamp = (h: number) => Math.min(max(), Math.max(min, h));
  try { runner.height = clamp(Number(localStorage.getItem('gitpocket:terminal-height')) || runner.height); } catch {}
  const save = () => { try { localStorage.setItem('gitpocket:terminal-height', String(runner.height)); } catch {} };

  // Dragging the top edge: the panel is anchored to the bottom, so moving up makes it taller.
  function drag(e: PointerEvent) {
    const startY = e.clientY, startHeight = runner.height;
    const move = (m: PointerEvent) => (runner.height = clamp(startHeight + startY - m.clientY));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); save(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  }
  function key(e: KeyboardEvent) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    runner.height = clamp(runner.height + (e.key === 'ArrowUp' ? 24 : -24));
    save();
    e.preventDefault();
  }

  let box: HTMLElement | undefined = $state();
  // Follow the output unless the user scrolled up.
  $effect(() => {
    runner.lines.length;
    if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 80) box.scrollTop = box.scrollHeight;
  });
</script>

{#if runner.open}
  <section class="bg-card fixed inset-x-0 bottom-0 z-20 border-t shadow-lg" aria-label="Command output">
    <!-- A focusable separator is an interactive widget in ARIA (window splitter pattern). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div role="separator" aria-orientation="horizontal" aria-label="Resize the terminal" aria-valuenow={runner.height} aria-valuemin={min} aria-valuemax={max()}
      tabindex="0" class="hover:bg-primary/30 focus-visible:bg-primary/30 absolute inset-x-0 -top-1 h-2 cursor-row-resize touch-none" onpointerdown={drag} onkeydown={key}></div>
    <div class="mx-auto max-w-6xl px-6 py-2">
      <div class="flex items-center gap-2 text-sm">
        <code class="flex-1 truncate font-medium" title={runner.command}>$ {runner.command.split('\n')[0]}{runner.command.includes('\n') ? ' …' : ''}</code>
        {#if runner.running}
          <span class="text-muted-foreground text-xs">Running…</span>
          <Button variant="outline" size="sm" onclick={stop}><SquareIcon /> Stop</Button>
        {:else if runner.code !== null}
          <span class="text-xs {runner.code === 0 ? 'text-emerald-500' : 'text-destructive'}">Exit code {runner.code}</span>
        {:else if !runner.error}
          <span class="text-muted-foreground text-xs">Stopped</span>
        {/if}
        <Button variant="ghost" size="icon" onclick={() => (runner.open = false)} aria-label="Close output" disabled={runner.running}><XIcon /></Button>
      </div>
      <p class="text-muted-foreground truncate text-xs">in {runner.cwd}</p>
      {#if runner.error}<p class="text-destructive py-2 text-sm" role="alert">{runner.error}</p>{/if}
      <pre bind:this={box} style="height:{runner.height}px" class="bg-muted mt-2 overflow-auto rounded-md p-3 font-mono text-xs leading-5">{#each runner.lines as line}<span class={line.stream === 'err' ? 'text-amber-600 dark:text-amber-400' : ''}>{line.text}</span>
{/each}</pre>
    </div>
  </section>
{/if}
