<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  let { children } = $props();

  // Follow the system theme live.
  onMount(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', query.matches);
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  });
</script>

{@render children()}
