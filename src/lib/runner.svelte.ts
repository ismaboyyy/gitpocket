import { Channel, invoke } from '@tauri-apps/api/core';

type Output = { event: 'line'; data: { stream: 'out' | 'err'; text: string } } | { event: 'done'; data: { code: number | null } };

// One command at a time, streamed from the Rust side.
export const runner = $state({
  open: false, command: '', cwd: '', lines: [] as { stream: string; text: string }[],
  height: 224, running: false, id: null as number | null, code: null as number | null, error: '',
});

const ansi = /\x1b\[[0-9;?]*[A-Za-z]/g;
const maxLines = 5000;

export async function run(path: string, command: string) {
  Object.assign(runner, { open: true, command, cwd: path, lines: [], running: true, id: null, code: null, error: '' });
  const channel = new Channel<Output>();
  channel.onmessage = message => {
    if (message.event === 'done') {
      runner.running = false;
      runner.code = message.data.code;
      return;
    }
    runner.lines.push({ stream: message.data.stream, text: message.data.text.replace(ansi, '') });
    if (runner.lines.length > maxLines) runner.lines.splice(0, runner.lines.length - maxLines);
  };
  try {
    runner.id = await invoke<number>('run_command', { path, command, onEvent: channel });
  } catch (e) {
    runner.running = false;
    runner.error = String(e);
  }
}

export const stop = () => runner.id !== null && invoke('stop_command', { id: runner.id });
