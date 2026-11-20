import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Repo } from './filters';

export type Tool = { id: string; name: string; kind: 'url' | 'command' };

// Shared by the list and the repository page.
export const actions = $state({ tools: [] as Tool[], cloning: {} as Record<string, boolean>, error: '' });

export function loadTools() {
  invoke<Tool[]>('tools').then(t => (actions.tools = t)).catch(() => {});
}

export async function clone(repo: Repo) {
  actions.cloning[repo.full_name] = true;
  actions.error = '';
  try {
    repo.local_path = await invoke<string>('clone_repo', { fullName: repo.full_name });
    repo.icon = await invoke<string | null>('repo_icon', { path: repo.local_path });
  } catch (e) {
    actions.error = `${repo.full_name}: ${e}`;
  } finally {
    actions.cloning[repo.full_name] = false;
  }
}

export async function launch(tool: Tool, path: string) {
  actions.error = '';
  try {
    if (tool.kind === 'url') await openUrl(`claude://code/new?folder=${encodeURIComponent(path)}`);
    else await invoke('open_with', { id: tool.id, path });
  } catch (e) {
    actions.error = String(e);
  }
}
