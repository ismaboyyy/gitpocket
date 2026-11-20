<script lang="ts">
  import { fileIconUrl } from '$lib/file-icons';

  let { name, dir = false, class: className = 'size-4' }: { name: string; dir?: boolean; class?: string } = $props();
</script>

<img src={fileIconUrl(name, dir)} alt="" class="shrink-0 {className}" />
