import { useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { useMission, useStore, useWorld } from '../store';
import { UPCOMING_WORLDS, WORLDS } from '../worlds';
import { stopCode } from '../sim/run';
import { unlockAudio } from '../audio/sound';

export function Welcome() {
  const show = useStore((s) => s.showWelcome);
  const set = useStore((s) => s.set);
  if (!show) return null;
  const start = (worldId: string) => {
    unlockAudio();
    set({ worldId, showWelcome: false, welcomeSeen: true });
    useStore.getState().openMission(useStore.getState().missionId);
  };
  return (
    <div className="overlay">
      <div className="modal welcome">
        <div className="welcome-hero">
          <div className="big-logo">🔌</div>
          <h1>
            Circuit <b>World</b>
          </h1>
          <p>Build real Arduino gadgets and watch them come alive in a 3D world.</p>
        </div>
        <div className="how">
          <div>
            <span>🔌</span>
            <b>Wire it</b>
            <small>Connect real modules to the Arduino</small>
          </div>
          <div>
            <span>💻</span>
            <b>Code it</b>
            <small>Write real Arduino C++</small>
          </div>
          <div>
            <span>✨</span>
            <b>Watch it work</b>
            <small>Your house, garden or robot reacts</small>
          </div>
        </div>
        <h3>Choose a world</h3>
        <div className="world-cards">
          {WORLDS.map((w) => (
            <button key={w.id} className="world-card" onClick={() => start(w.id)}>
              <span className="emoji">{w.emoji}</span>
              <b>{w.title}</b>
              <small>{w.tagline}</small>
              <span className="go">Let's go! ▶</span>
            </button>
          ))}
          {UPCOMING_WORLDS.map((w) => (
            <div key={w.title} className="world-card soon">
              <span className="emoji">{w.emoji}</span>
              <b>{w.title}</b>
              <small>{w.tagline}</small>
              <span className="go">Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MissionMap() {
  const show = useStore((s) => s.showMissions);
  const completed = useStore((s) => s.completed);
  const current = useStore((s) => s.missionId);
  const world = useWorld();
  if (!show) return null;
  return (
    <div className="overlay" onClick={() => useStore.setState({ showMissions: false })}>
      <div className="modal missions" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            {world.emoji} {world.title} missions
          </h2>
          <button className="ghost" onClick={() => useStore.setState({ showMissions: false })}>
            ✕
          </button>
        </div>
        <div className="mission-grid">
          {world.missions.map((m, i) => {
            const done = completed[`${world.id}/${m.id}`];
            return (
              <button
                key={m.id}
                className={`mission-tile ${m.id === current ? 'current' : ''} ${done ? 'done' : ''}`}
                onClick={() => {
                  stopCode();
                  useStore.getState().openMission(m.id);
                }}
              >
                <span className="emoji">{m.emoji}</span>
                <small>{m.objectives.length ? `Mission ${i + 1}` : 'Sandbox'}</small>
                <b>{m.title}</b>
                {done && <span className="star">⭐ Done</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SolutionModal() {
  const show = useStore((s) => s.showSolution);
  const mission = useMission();
  const setCode = useStore((s) => s.setCode);
  if (!show) return null;
  const close = () => useStore.setState({ showSolution: false });
  return (
    <div className="overlay" onClick={close}>
      <div className="modal solution" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>👀 One way to solve it</h2>
          <button className="ghost" onClick={close}>
            ✕
          </button>
        </div>
        <p>Try to understand each line before you use it. There is more than one right answer!</p>
        <div className="solution-code">
          <CodeMirror value={mission.solutionCode} editable={false} extensions={[cpp()]} basicSetup={{ foldGutter: false }} />
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={close}>
            Back to my code
          </button>
          <button
            className="primary"
            onClick={() => {
              if (confirm('Replace your code with this solution?')) {
                setCode(mission.solutionCode);
                close();
              }
            }}
          >
            Use this code
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const colors = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#06b6d4'];
    const parts = Array.from({ length: 180 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * 200,
      y: c.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      s: 6 + Math.random() * 8,
    }));
    let raf = 0;
    const tick = () => {
      g.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.vy += 0.45;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.color;
        g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      if (parts.some((p) => p.y < c.height + 20)) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className="confetti" />;
}

export function Celebration() {
  const show = useStore((s) => s.celebrate);
  const world = useWorld();
  const mission = useMission();
  if (!show) return null;
  const i = world.missions.findIndex((m) => m.id === mission.id);
  const next = world.missions[i + 1];
  return (
    <div className="overlay light">
      <Confetti />
      <div className="modal celebrate">
        <div className="trophy">🏆</div>
        <h2>Mission complete!</h2>
        <p>
          <b>{mission.title}</b> works! You just built something real: the same wiring and code would work on a real Arduino.
        </p>
        <div className="modal-actions">
          <button className="ghost" onClick={() => useStore.setState({ celebrate: false })}>
            Keep playing
          </button>
          {next && (
            <button
              className="primary"
              onClick={() => {
                stopCode();
                useStore.getState().openMission(next.id);
              }}
            >
              Next: {next.emoji} {next.title} ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ToolchainBanner() {
  const toolchain = useStore((s) => s.toolchain);
  if (toolchain === 'ready' || toolchain === 'unknown') return null;
  return (
    <div className={`banner ${toolchain}`}>
      {toolchain === 'missing' ? (
        <>
          🛠️ The Arduino compiler isn't installed yet. Close this window and run <code>npm run setup</code> (or double-click <code>start.bat</code>) once. You
          can still wire things up in the meantime!
        </>
      ) : (
        <>⚠️ The Circuit World helper isn't running, so code can't be built. Start it with <code>start.bat</code> or <code>npm run dev</code>.</>
      )}
    </div>
  );
}
