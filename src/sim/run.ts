// Compile the current sketch on the local server and start the simulation.
import { useStore, currentProject, currentMission } from '../store';
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
  const project = currentProject();
  const codes = currentMission().boards === 2 ? [project.code, project.code2 ?? ''] : [project.code];
  useStore.setState({ status: 'compiling', diagnostics: [], compileOutput: '' });

  const hexes: string[] = [];
  let data: CompileResponse = { ok: false, diagnostics: [], output: '' };
  let board = 0;
  try {
    for (; board < codes.length; board++) {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codes[board], board: 'uno' }),
      });
      data = await res.json();
      if (!data.ok || !data.hex) break;
      hexes.push(data.hex);
    }
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

  const diagnostics = friendly(data.diagnostics ?? []).map((d) => ({ ...d, board }));
  if (hexes.length < codes.length) {
    const missing = data.diagnostics?.some((d) => d.message === 'TOOLCHAIN_MISSING');
    useStore.setState({
      status: 'stopped',
      diagnostics,
      compileOutput: data.output ?? '',
      bottomTab: 'errors',
      ...(codes.length > 1 ? { codeBoard: board as 0 | 1 } : {}),
      ...(missing ? { toolchain: 'missing' as const } : {}),
    });
    return;
  }
  useStore.setState({ diagnostics: diagnostics.map((d) => ({ ...d, board: codes.length - 1 })), compileOutput: data.output ?? '', toolchain: 'ready' });
  startProgram(hexes);
  useStore.setState({ bottomTab: useStore.getState().bottomTab === 'errors' ? 'helper' : useStore.getState().bottomTab });
}

export function stopCode(): void {
  stopProgram();
}
