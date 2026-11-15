// The main loop: advances the world (time of day, visitor, car), runs the Arduino,
// checks mission objectives and drives sounds. 3D views read `live` every frame.
import { SimEngine } from './engine';
import { CLOCK_HZ } from './avr-runner';
import { emptyState, type DeviceState, type WorldSense } from '../devices/logic';
import { useStore, currentMission, currentProject, missionDevices } from '../store';
import { getWorld } from '../worlds';
import type { WorldSnapshot } from '../worlds/types';
import { MissionChecker } from '../worlds/checker';
import { newVisitor, sendVisitor as send, stepVisitor, visitorMotion } from '../worlds/smartHome/actors';
import { click, playBump, playObjective, playSuccess, setTone, silenceAll } from '../audio/sound';
import type { Wire } from './circuit';

export { DOOR_X } from '../worlds/smartHome/actors';

export const live = {
  states: {} as Record<string, DeviceState>,
  running: false,
  /** Brightness of the Arduino's built-in "L" LED (pin 13) */
  boardL: 0,
  txFlash: 0,
  visitor: newVisitor(),
  carDrive: 0,
  crashedAt: -10,
  crashed: false,
  time: 0,
};

export { daylight } from '../worlds/smartHome/actors';
import { daylight } from '../worlds/smartHome/actors';

let engine: SimEngine | null = null;
let serialBuffer = '';
let lastWires: Wire[] | null = null;
const checker = new MissionChecker();
let speedAcc = { wanted: 0, ran: 0, t: 0 };
let cyclesPerMs = 20000;
const relayMemory = new Map<string, boolean>();

function effectivePressed(): Record<string, boolean> {
  const pressed = { ...useStore.getState().pressed };
  if (live.visitor.ringing) pressed.doorbell = true;
  return pressed;
}

function sense(): Omit<WorldSense, 'time'> {
  const s = useStore.getState();
  const pressed = effectivePressed();
  return {
    daylight: daylight(s.hour),
    temperature: s.temperature,
    knob: s.knob,
    motion: visitorMotion(live.visitor),
    distanceCm: s.carDistance,
    pressed: (id) => !!pressed[id],
  };
}

export function sendVisitor(): void {
  send(live.visitor);
}

export function startProgram(hex: string): void {
  const s = useStore.getState();
  const world = getWorld(s.worldId);
  const mission = currentMission();
  const project = currentProject();
  const previous = live.states;
  engine = new SimEngine(hex, missionDevices(world, mission), project.wires, sense);
  for (const [id, st] of Object.entries(engine.states)) st.angle = previous[id]?.angle ?? 0;
  engine.onSerial = (b) => {
    serialBuffer += String.fromCharCode(b);
    live.txFlash = 1;
  };
  lastWires = project.wires;
  checker.reset();
  live.running = true;
  live.states = engine.states;
  useStore.setState({ status: 'running', runningCode: project.code, serial: '' });
}

export function stopProgram(): void {
  engine = null;
  live.running = false;
  const off: Record<string, DeviceState> = {};
  for (const [id, st] of Object.entries(live.states)) off[id] = { ...emptyState(), angle: st.angle };
  live.states = off;
  live.boardL = 0;
  silenceAll();
  useStore.setState({ status: 'stopped', runningCode: null });
}

export function serialSend(text: string): void {
  engine?.runner.serialWrite(text);
}

function updateWorld(dt: number): void {
  const s = useStore.getState();
  const patch: Partial<ReturnType<typeof useStore.getState>> = {};

  if (s.autoTime) patch.hour = (s.hour + dt * (24 / 90)) % 24;

  // Car: hold the drive buttons to move it
  if (live.carDrive !== 0) {
    let d = s.carDistance - live.carDrive * 70 * dt;
    if (d <= 3) {
      d = 3;
      if (!live.crashed) {
        live.crashed = true;
        live.crashedAt = live.time;
        playBump();
      }
    }
    patch.carDistance = Math.min(400, d);
  }
  if (live.crashed && (patch.carDistance ?? s.carDistance) > 12) live.crashed = false;

  // Visitor walking up to the front door
  stepVisitor(live.visitor, dt, live.states.door?.angle ?? 0);

  if (Object.keys(patch).length) useStore.setState(patch);
}

function snapshot(): WorldSnapshot {
  const s = useStore.getState();
  return {
    hour: s.hour,
    daylight: daylight(s.hour),
    temperature: s.temperature,
    knob: s.knob,
    carDistance: s.carDistance,
    crashed: live.crashed,
    visitor: live.visitor.phase,
    pressed: effectivePressed(),
    serial: s.serial,
  };
}

function checkMission(dt: number): void {
  const s = useStore.getState();
  const mission = currentMission();
  if (!mission.objectives.length) return;
  const done = s.objectivesDone.length === mission.objectives.length ? s.objectivesDone : mission.objectives.map(() => false);
  const index = checker.step(mission, done, live.states, snapshot(), dt);
  if (index < 0) return;
  const next = [...done];
  next[index] = true;
  const all = next.every(Boolean);
  useStore.setState({
    objectivesDone: next,
    ...(all ? { celebrate: true, completed: { ...s.completed, [`${s.worldId}/${mission.id}`]: true } } : {}),
  });
  if (all) playSuccess();
  else playObjective();
}

function updateSounds(): void {
  if (!live.running) return;
  const world = getWorld(useStore.getState().worldId);
  for (const d of world.devices) {
    const st = live.states[d.id];
    if (!st) continue;
    if (d.type === 'buzzer') setTone(d.id, st.freq, 0.04);
    if (d.type === 'servo') setTone(`${d.id}:motor`, st.on ? 150 : 0, 0.012, 'sawtooth');
    if (d.type === 'relay') {
      if (relayMemory.get(d.id) !== st.on) {
        if (relayMemory.has(d.id)) click();
        relayMemory.set(d.id, st.on);
      }
    }
  }
}

function frame(dt: number): void {
  live.time += dt;
  updateWorld(dt);

  if (engine) {
    const wires = currentProject().wires;
    if (wires !== lastWires) {
      engine.rewire(wires);
      lastWires = wires;
    }
    const wanted = dt * CLOCK_HZ;
    const budget = 12 * cyclesPerMs;
    const t0 = performance.now();
    const ran = engine.step(dt, Math.max(50000, budget));
    const ms = performance.now() - t0;
    if (ms > 0.5) cyclesPerMs = cyclesPerMs * 0.9 + (ran / ms) * 0.1;
    speedAcc.wanted += wanted;
    speedAcc.ran += ran;
    speedAcc.t += dt;
    if (speedAcc.t > 0.5) {
      const speed = Math.min(1, speedAcc.ran / speedAcc.wanted);
      if (Math.abs(speed - useStore.getState().simSpeed) > 0.02) useStore.setState({ simSpeed: speed });
      speedAcc = { wanted: 0, ran: 0, t: 0 };
    }
    live.states = engine.states;
    live.boardL = engine.pin(13).duty;
    if (serialBuffer) {
      useStore.getState().appendSerial(serialBuffer);
      serialBuffer = '';
    }
    checkMission(dt);
  }
  live.txFlash = Math.max(0, live.txFlash - dt * 8);
  updateSounds();
}

let started = false;
export function startLoop(): void {
  if (started) return;
  started = true;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      frame(dt);
    } catch (err) {
      console.error(err);
      stopProgram();
      useStore.setState({ compileOutput: `Simulation stopped: ${String(err)}`, bottomTab: 'errors' });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
