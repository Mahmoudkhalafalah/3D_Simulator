// Compile the current sketch on the local server and start the simulation.
import { useStore, currentProject } from '../store';
import { friendly, type Diagnostic } from '../ui/friendly';
import { startProgram, stopProgram } from './session';
import { unlockAudio } from '../audio/sound';

interface CompileResponse {
  ok: boolean;
  hex?: string;
  diagnostics: Diagnostic[];
  output: string;
}

export async function checkServer(): Promise<void> {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    useStore.setState({ toolchain: data.toolchain ? 'ready' : 'missing' });
  } catch {
    useStore.setState({ toolchain: 'offline' });
  }
}

export async function runCode(): Promise<void> {
  unlockAudio();
  if (useStore.getState().status === 'compiling') return;
  stopProgram();
  const code = currentProject().code;
  useStore.setState({ status: 'compiling', diagnostics: [], compileOutput: '' });

  let data: CompileResponse;
  try {
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, board: 'uno' }),
    });
    data = await res.json();
  } catch {
    useStore.setState({
      status: 'stopped',
      toolchain: 'offline',
      bottomTab: 'errors',
      diagnostics: [],
      compileOutput:
        'Cannot reach the Circuit World helper that compiles your code.\nMake sure start.bat (or "npm run dev") is still running, then press Run again.',
    });
    return;
  }

  const diagnostics = friendly(data.diagnostics ?? []);
  if (!data.ok || !data.hex) {
    const missing = data.diagnostics?.some((d) => d.message === 'TOOLCHAIN_MISSING');
    useStore.setState({
      status: 'stopped',
      diagnostics,
      compileOutput: data.output ?? '',
      bottomTab: 'errors',
      ...(missing ? { toolchain: 'missing' as const } : {}),
    });
    return;
  }
  useStore.setState({ diagnostics, compileOutput: data.output ?? '', toolchain: 'ready' });
  startProgram(data.hex);
  useStore.setState({ bottomTab: useStore.getState().bottomTab === 'errors' ? 'helper' : useStore.getState().bottomTab });
}

export function stopCode(): void {
  stopProgram();
}
