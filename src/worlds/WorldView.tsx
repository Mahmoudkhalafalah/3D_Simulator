import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useRef, useState } from 'react';
import { useMission, useStore, useWorld } from '../store';
import { live, worldAction } from '../sim/session';
import { daylight } from './sense';
import { FocusButton } from '../ui/FocusButton';
import { KEYPAD_KEYS } from '../devices/specs';
import type { ControlDef } from './types';
import { SCENES } from './scenes';

function fmtHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Re-render a few times per second with a value computed from the live world. */
function useLive<T>(get: () => T, ms = 150): T {
  const [value, setValue] = useState(get);
  const ref = useRef(get);
  ref.current = get;
  useEffect(() => {
    const t = setInterval(() => setValue(ref.current()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return value;
}

function ActionButton({ def }: { def: Extract<ControlDef, { type: 'action' }> }) {
  const busy = useLive(() => def.busy?.(live.snap) ?? null);
  return (
    <button className="ctrl-btn" disabled={!!busy} onClick={() => worldAction(def.action, def.arg)}>
      {def.emoji} {busy ?? def.label}
    </button>
  );
}

function HoldButton({ action, arg, children }: { action: string; arg: number; children: React.ReactNode }) {
  const start = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    worldAction(action, arg);
  };
  const stop = () => worldAction(action, 0);
  return (
    <button className="ctrl-btn" onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
      {children}
    </button>
  );
}

function Readout({ get }: { get: () => string }) {
  const text = useLive(get);
  return <span className="ctrl-val">{text}</span>;
}

function Joystick({ device }: { device: string }) {
  const x = useStore((s) => s.values[`${device}.x`] ?? 0.5);
  const y = useStore((s) => s.values[`${device}.y`] ?? 0.5);
  const setValue = useStore((s) => s.setValue);
  const setPressed = useStore((s) => s.setPressed);
  const pad = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (!pad.current || e.buttons === 0) return;
    const r = pad.current.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const ny = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    setValue(`${device}.x`, Math.round(nx * 100) / 100);
    setValue(`${device}.y`, Math.round(ny * 100) / 100);
  };
  const release = () => {
    setValue(`${device}.x`, 0.5);
    setValue(`${device}.y`, 0.5);
  };
  return (
    <div className="joy">
      <div
        ref={pad}
        className="joy-pad"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="joy-knob" style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }} />
      </div>
      <button
        className="ctrl-btn"
        onPointerDown={() => setPressed(device, true)}
        onPointerUp={() => setPressed(device, false)}
        onPointerLeave={() => setPressed(device, false)}
      >
        Push
      </button>
    </div>
  );
}

function Keypad({ device }: { device: string }) {
  const setKey = useStore((s) => s.setKey);
  const held = useStore((s) => s.keys[device]);
  return (
    <div className="keypad-ui">
      {KEYPAD_KEYS.join('')
        .split('')
        .map((k) => (
          <button
            key={k}
            className={`key ${held === k ? 'down' : ''} ${/[A-D]/.test(k) ? 'letter' : ''}`}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              setKey(device, k);
            }}
            onPointerUp={() => setKey(device, null)}
            onPointerCancel={() => setKey(device, null)}
          >
            {k}
          </button>
        ))}
    </div>
  );
}

function Control({ def }: { def: ControlDef }) {
  const s = useStore();
  switch (def.type) {
    case 'time': {
      const night = daylight(s.hour) < 0.15;
      return (
        <div className="ctrl">
          <span className="ctrl-icon">{night ? '🌙' : '☀️'}</span>
          <input type="range" min={0} max={23.99} step={0.05} value={s.hour} onChange={(e) => s.set({ hour: Number(e.target.value), autoTime: false })} />
          <span className="ctrl-val">{fmtHour(s.hour)}</span>
          <button className="ctrl-mini" title="Play the day" onClick={() => s.set({ autoTime: !s.autoTime })}>
            {s.autoTime ? '⏸' : '▶'}
          </button>
        </div>
      );
    }
    case 'slider': {
      const value = def.key === 'temperature' ? s.temperature : def.key === 'humidity' ? s.humidity : (s.values[def.key] ?? (def.min + def.max) / 2);
      return (
        <div className="ctrl" title={def.title}>
          <span className="ctrl-icon">{def.emoji}</span>
          <input type="range" min={def.min} max={def.max} step={def.step} value={value} onChange={(e) => s.setValue(def.key, Number(e.target.value))} />
          <span className="ctrl-val">{def.format(value)}</span>
        </div>
      );
    }
    case 'action':
      return (
        <div className="ctrl">
          <ActionButton def={def} />
        </div>
      );
    case 'hold':
      return (
        <div className="ctrl" title={def.title}>
          <span className="ctrl-icon">{def.emoji}</span>
          {def.buttons.map((b) => (
            <HoldButton key={b.label} action={b.action} arg={b.arg}>
              {b.label}
            </HoldButton>
          ))}
          {def.readout && <Readout get={() => def.readout!(live.snap)} />}
        </div>
      );
    case 'joystick':
      return (
        <div className="ctrl tall" title={def.title}>
          <span className="ctrl-icon">🕹️</span>
          <Joystick device={def.device} />
        </div>
      );
    case 'keypad':
      return (
        <div className="ctrl tall" title={def.title}>
          <Keypad device={def.device} />
        </div>
      );
  }
}

function WorldControls() {
  const world = useWorld();
  const mission = useMission();
  return (
    <div className="world-controls">
      {mission.controls.map((id) => {
        const def = world.controls[id];
        return def ? <Control key={id} def={def} /> : null;
      })}
    </div>
  );
}

/** When a mission opens, look at the gadget it is about (applied on the next frame, after the controls settle). */
function MissionCamera() {
  const world = useWorld();
  const mission = useMission();
  const pending = useRef<{ position: [number, number, number]; target: [number, number, number] } | null>(null);
  useEffect(() => {
    pending.current = mission.view ?? world.camera;
  }, [mission.id, world.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ camera, controls }) => {
    const v = pending.current;
    if (!v) return;
    pending.current = null;
    camera.position.set(...v.position);
    const c = controls as unknown as { target?: { set(x: number, y: number, z: number): void }; update?(): void } | null;
    if (c?.target && c.update) {
      c.target.set(...v.target);
      c.update();
    } else camera.lookAt(...v.target);
  });
  return null;
}

export function WorldView() {
  const world = useWorld();
  const Scene = SCENES[world.id];
  return (
    <div className="world">
      <Canvas shadows dpr={[1, 2]} camera={{ position: world.camera.position, fov: 40, near: 0.1, far: 300 }}>
        {Scene && <Scene />}
        <OrbitControls makeDefault maxPolarAngle={1.42} minDistance={4} maxDistance={45} enableDamping dampingFactor={0.12} />
        <MissionCamera />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.2} />
        </EffectComposer>
      </Canvas>
      <div className="panel-title">
        <span>
          {world.emoji} {world.title}
        </span>
        <small>{world.help}</small>
      </div>
      <FocusButton panel="world" />
      <WorldControls />
    </div>
  );
}
