import { useRef } from 'react';
import { useMission, useStore, currentProject, projectKey } from '../store';
import { runCode, stopCode } from '../sim/run';
import { setMuted } from '../audio/sound';

export function TopBar() {
  const status = useStore((s) => s.status);
  const speed = useStore((s) => s.simSpeed);
  const muted = useStore((s) => s.muted);
  const set = useStore((s) => s.set);
  const mission = useMission();
  const fileInput = useRef<HTMLInputElement>(null);

  const save = () => {
    const s = useStore.getState();
    const data = { app: 'circuit-world', version: 1, world: s.worldId, mission: s.missionId, project: currentProject() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${mission.title.replace(/[^\w]+/g, '-').toLowerCase()}.circuit.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const open = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'circuit-world' || !data.project) throw new Error('not a Circuit World file');
      const s = useStore.getState();
      stopCode();
      s.openMission(data.mission);
      const key = projectKey(data.world ?? s.worldId, data.mission);
      useStore.setState({ projects: { ...useStore.getState().projects, [key]: data.project } });
    } catch (e) {
      alert(`Could not open that file: ${(e as Error).message}`);
    }
  };

  return (
    <header className="topbar">
      <div className="brand" onClick={() => set({ showWelcome: true })} title="Home">
        <span className="logo">🔌</span>
        <span>
          Circuit <b>World</b>
        </span>
      </div>
      <button className="mission-chip" onClick={() => set({ showMissions: true })}>
        {mission.emoji} {mission.title} <span>▾</span>
      </button>

      <div className="run-group">
        {status === 'running' ? (
          <>
            <button className="run stop" onClick={stopCode}>
              ⏹ Stop
            </button>
            <button className="run restart" onClick={() => void runCode()} title="Upload the code again">
              ↻ Restart
            </button>
            <span className="status running">
              <i /> Running{speed < 0.97 ? ` · ${Math.round(speed * 100)}% speed` : ''}
            </span>
          </>
        ) : (
          <button className="run" onClick={() => void runCode()} disabled={status === 'compiling'}>
            {status === 'compiling' ? '⏳ Building…' : '▶ Run'}
          </button>
        )}
      </div>

      <div className="spacer" />
      <button className="icon-btn" title="Save project to a file" onClick={save}>
        💾
      </button>
      <button className="icon-btn" title="Open a project file" onClick={() => fileInput.current?.click()}>
        📂
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void open(f);
          e.target.value = '';
        }}
      />
      <button
        className="icon-btn"
        title={muted ? 'Sound off' : 'Sound on'}
        onClick={() => {
          setMuted(!muted);
          set({ muted: !muted });
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </header>
  );
}
