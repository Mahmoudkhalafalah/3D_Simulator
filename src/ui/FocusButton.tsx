import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { runCode, stopCode } from '../sim/run';

/** Full screen for one panel, with a small Run / Stop bar because the top bar is hidden then. */
export function FullscreenButton({ label = true }: { label?: boolean }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [full, setFull] = useState(false);
  const status = useStore((s) => s.status);
  useEffect(() => {
    const update = () => setFull(!!document.fullscreenElement && document.fullscreenElement === btn.current?.closest('.fs-panel'));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggle = () => {
    const panel = btn.current?.closest('.fs-panel') as HTMLElement | null;
    if (!panel) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panel.requestFullscreen?.().catch(() => {});
  };
  return (
    <>
      <button ref={btn} className="fs-btn" onClick={toggle} title={full ? 'Leave full screen (Esc)' : 'Full screen'}>
        {full ? '✕ Exit full screen' : label ? '⛶ Full screen' : '⛶'}
      </button>
      {full && (
        <div className="fs-bar">
          {status === 'running' ? (
            <>
              <button className="run stop" onClick={stopCode}>
                ⏹ Stop
              </button>
              <button className="run restart" onClick={() => void runCode()}>
                ↻ Restart
              </button>
            </>
          ) : (
            <button className="run" disabled={status === 'compiling'} onClick={() => void runCode()}>
              {status === 'compiling' ? '⏳ Building…' : '▶ Run'}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** Enlarges one of the two 3D panels (world or workbench), or shows it full screen. */
export function FocusButton({ panel }: { panel: 'world' | 'bench' }) {
  const focus = useStore((s) => s.focus);
  const active = focus === panel;
  return (
    <div className="panel-buttons">
      <FullscreenButton />
      <button className="focus-btn" onClick={() => useStore.setState({ focus: active ? null : panel })} title={active ? 'Back to normal size' : 'Make this bigger'}>
        {active ? '⤡ Smaller' : '⤢ Bigger'}
      </button>
    </div>
  );
}
