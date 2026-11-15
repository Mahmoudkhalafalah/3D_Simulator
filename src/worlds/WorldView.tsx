import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useState } from 'react';
import { useMission, useStore, useWorld } from '../store';
import { SkyAndLights, Garden } from './smartHome/Environment';
import { House } from './smartHome/House';
import { live, sendVisitor, daylight } from '../sim/session';
import { FocusButton } from '../ui/FocusButton';

function fmtHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function VisitorButton() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setBusy(live.visitor.phase !== 'away'), 200);
    return () => clearInterval(t);
  }, []);
  return (
    <button className="ctrl-btn" disabled={busy} onClick={sendVisitor}>
      🚶 {busy ? 'Visitor is here…' : 'Send a visitor'}
    </button>
  );
}

function HoldButton({ dir, children }: { dir: number; children: React.ReactNode }) {
  const start = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    live.carDrive = dir;
  };
  const stop = () => (live.carDrive = 0);
  return (
    <button className="ctrl-btn" onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
      {children}
    </button>
  );
}

function WorldControls() {
  const mission = useMission();
  const s = useStore();
  const c = new Set(mission.controls);
  const night = daylight(s.hour) < 0.15;
  return (
    <div className="world-controls">
      {c.has('time') && (
        <div className="ctrl">
          <span className="ctrl-icon">{night ? '🌙' : '☀️'}</span>
          <input type="range" min={0} max={23.99} step={0.05} value={s.hour} onChange={(e) => s.set({ hour: Number(e.target.value), autoTime: false })} />
          <span className="ctrl-val">{fmtHour(s.hour)}</span>
          <button className="ctrl-mini" title="Play the day" onClick={() => s.set({ autoTime: !s.autoTime })}>
            {s.autoTime ? '⏸' : '▶'}
          </button>
        </div>
      )}
      {c.has('temperature') && (
        <div className="ctrl">
          <span className="ctrl-icon">🌡️</span>
          <input type="range" min={10} max={40} step={0.5} value={s.temperature} onChange={(e) => s.set({ temperature: Number(e.target.value) })} />
          <span className="ctrl-val">{s.temperature.toFixed(1)} °C</span>
        </div>
      )}
      {c.has('knob') && (
        <div className="ctrl">
          <span className="ctrl-icon">🎛️</span>
          <input type="range" min={0} max={1} step={0.01} value={s.knob} onChange={(e) => s.set({ knob: Number(e.target.value) })} />
          <span className="ctrl-val">{Math.round(s.knob * 100)}%</span>
        </div>
      )}
      {c.has('car') && (
        <div className="ctrl">
          <span className="ctrl-icon">🚗</span>
          <HoldButton dir={1}>⬆ Drive in</HoldButton>
          <HoldButton dir={-1}>⬇ Back up</HoldButton>
          <span className="ctrl-val">{Math.round(s.carDistance)} cm</span>
        </div>
      )}
      {c.has('visitor') && (
        <div className="ctrl">
          <VisitorButton />
        </div>
      )}
    </div>
  );
}

export function WorldView() {
  const world = useWorld();
  return (
    <div className="world">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [2.5, 11, 13.5], fov: 40, near: 0.1, far: 300 }}>
        <SkyAndLights />
        <Garden />
        <House />
        <OrbitControls makeDefault target={[0, 0.6, -0.3]} maxPolarAngle={1.42} minDistance={4} maxDistance={40} enableDamping dampingFactor={0.12} />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.2} />
        </EffectComposer>
      </Canvas>
      <div className="panel-title">
        <span>
          {world.emoji} {world.title}
        </span>
        <small>Click the doorbell or light switch to press them. Drag to look around.</small>
      </div>
      <FocusButton panel="world" />
      <WorldControls />
    </div>
  );
}
