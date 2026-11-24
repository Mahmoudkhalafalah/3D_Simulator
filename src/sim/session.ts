// The main loop: advances the world (time of day, people, cars, plants), runs the
// Arduino, checks mission objectives and drives sounds. 3D views read `live` every frame.
import { SimEngine } from './engine';
import { CLOCK_HZ } from './avr-runner';
import { emptyState, type DeviceState, type SenseMap } from '../devices/logic';
import { useStore, currentMission, currentProject, currentBenchDevices, currentInputs, projectKey } from '../store';
import { getWorld } from '../worlds';
import type { WorldSim, WorldSnapshot } from '../worlds/types';
import { MissionChecker } from '../worlds/checker';
import { daylight, pressedNow } from '../worlds/sense';
import { click, playBump, playObjective, playPop, playSuccess, setTone, silenceAll } from '../audio/sound';
import type { Wire } from './circuit';

export { daylight };

export const live = {
  states: {} as Record<string, DeviceState>,
  running: false,
  /** Brightness of each Arduino's built-in "L" LED (pin 13), and its TX light */
  boardL: [0, 0],
  txFlash: [0, 0],
  time: 0,
  /** Seconds the current program has been running (module timestamps such as `ping` use this clock) */
  engineTime: 0,
  /** The world simulation (people, cars, plants...) and which world it belongs to */
  sim: null as WorldSim | null,
  worldId: '',
  /** The world's own values, refreshed every frame (for the UI and 3D scenes) */
  snap: {} as Record<string, unknown>,
  /** What every sensor senses right now (the 3D views use it to show pressed buttons etc.) */
  sense: null as SenseMap | null,
};

let engine: SimEngine | null = null;
let lastHexes: string[] | null = null;
const serialBuffers = ['', ''];
let lastWires: Wire[] | null = null;
const checker = new MissionChecker();
let speedAcc = { wanted: 0, ran: 0, t: 0 };
let cyclesPerMs = 20000;
const relayMemory = new Map<string, boolean>();

// ---------- EEPROM: kept per project, like a real board keeps it between uploads ----------
const eeproms = new Map<string, Uint8Array>();
const eepromKey = (k: string) => `circuit-world-eeprom:${k}`;

function loadEeprom(key: string): Uint8Array | undefined {
  if (eeproms.has(key)) return eeproms.get(key);
  try {
    const raw = localStorage.getItem(eepromKey(key));
    if (!raw) return undefined;
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    eeproms.set(key, bytes);
    return bytes;
  } catch {
    return undefined;
  }
}

const boardKey = (board: number) => {
  const s = useStore.getState();
  return projectKey(s.worldId, s.missionId) + (board ? ':B' : '');
};

function saveEeprom(): void {
  if (!engine) return;
  engine.runners.forEach((_, board) => {
    const key = boardKey(board);
    const bytes = engine!.eeprom(board);
    eeproms.set(key, bytes);
    if (bytes.every((b) => b === 0xff)) return;
    try {
      localStorage.setItem(eepromKey(key), btoa(String.fromCharCode(...bytes)));
    } catch {
      /* storage full or blocked: keep it in memory only */
    }
  });
}

// ---------- the world ----------
export function resetWorld(): void {
  const s = useStore.getState();
  const world = getWorld(s.worldId);
  live.sim = world.createSim(currentMission().setup ?? {});
  live.worldId = world.id;
  live.snap = live.sim.snapshot();
  live.sense = live.sim.sense(currentInputs());
}

export function worldAction(name: string, arg?: number): void {
  live.sim?.action(name, arg);
}

function sense(): SenseMap {
  return live.sim!.sense(currentInputs());
}

// ---------- the program ----------
/** Start the compiled program(s): one hex per Arduino. */
export function startProgram(hexes: string[]): void {
  lastHexes = hexes;
  const project = currentProject();
  const previous = live.states;
  if (engine) saveEeprom();
  const roms = hexes.map((_, b) => loadEeprom(boardKey(b)));
  engine = new SimEngine(hexes, currentBenchDevices(), project.wires, sense, roms);
  for (const [id, st] of Object.entries(engine.states)) st.angle = previous[id]?.angle ?? 0;
  engine.onSerial = (byte, board) => {
    serialBuffers[board] += String.fromCharCode(byte);
    live.txFlash[board] = 1;
  };
  lastWires = project.wires;
  checker.reset();
  live.sim?.onStart?.();
  live.running = true;
  live.states = engine.states;
  useStore.setState({ status: 'running', runningCode: runningKey(project), serial: '', serial2: '' });
}

/** What is running, to warn when the editor has changed since Run */
export const runningKey = (p: { code: string; code2?: string }) => p.code + (p.code2 !== undefined ? '\u0000' + p.code2 : '');

export function stopProgram(): void {
  saveEeprom();
  engine = null;
  live.running = false;
  const off: Record<string, DeviceState> = {};
  for (const [id, st] of Object.entries(live.states)) off[id] = { ...emptyState(), angle: st.angle };
  live.states = off;
  live.boardL = [0, 0];
  silenceAll();
  useStore.setState({ status: 'stopped', runningCode: null });
}

export function serialSend(text: string, board = 0): void {
  engine?.runners[board]?.serialWrite(text);
}

function updateWorld(dt: number): void {
  const s = useStore.getState();
  if (s.autoTime) useStore.setState({ hour: (s.hour + dt * (24 / 90)) % 24 });
  if (!live.sim || live.worldId !== s.worldId) resetWorld();
  const inputs = currentInputs();
  live.sim!.step(dt, inputs, live.states);
  live.sense = live.sim!.sense(inputs);
  live.snap = live.sim!.snapshot();
  for (const e of live.sim!.drainEvents?.() ?? []) {
    if (e === 'bump') playBump();
    else if (e === 'pop') playPop();
    else if (e === 'power' && engine && lastHexes) {
      // Switch the board off and on: the program starts again, EEPROM keeps its contents
      click();
      startProgram(lastHexes);
    }
  }
}

function snapshot(): WorldSnapshot {
  const s = useStore.getState();
  const link = engine ? { ...engine.link } : { bytes: 0, garbled: 0, cleanStreak: 0 };
  const inputs = currentInputs();
  const pressed = pressedNow(getWorld(s.worldId).devices, inputs, live.sense);
  return { ...inputs, pressed, daylight: daylight(s.hour), serial: s.serial, serial2: s.serial2, link, ...live.snap };
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
    if (d.type === 'motor') setTone(`${d.id}:motor`, st.speed ? 90 + Math.abs(st.speed) * 80 : 0, 0.01, 'sawtooth');
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
  // While a program runs, the world moves by the Arduino's own clock. On a slow computer
  // the chip may run below real time; the world then slows down with it, so a robot that
  // turns for delay(300) turns the same angle on every computer.
  let ran = 0;
  if (engine) {
    const wires = currentProject().wires;
    if (wires !== lastWires) {
      engine.rewire(wires);
      lastWires = wires;
    }
    const budget = 12 * cyclesPerMs;
    const t0 = performance.now();
    ran = engine.step(dt, Math.max(50000, budget));
    const ms = performance.now() - t0;
    if (ms > 0.5) cyclesPerMs = cyclesPerMs * 0.9 + (ran / ms) * 0.1;
  }
  const worldDt = engine ? ran / CLOCK_HZ : dt;
  updateWorld(worldDt);

  if (engine) {
    const wanted = dt * CLOCK_HZ;
    speedAcc.wanted += wanted;
    speedAcc.ran += ran;
    speedAcc.t += dt;
    if (speedAcc.t > 0.5) {
      const speed = Math.min(1, speedAcc.ran / speedAcc.wanted);
      if (Math.abs(speed - useStore.getState().simSpeed) > 0.02) useStore.setState({ simSpeed: speed });
      speedAcc = { wanted: 0, ran: 0, t: 0 };
    }
    live.states = engine.states;
    live.engineTime = engine.time;
    live.boardL = engine.runners.map((_, b) => engine!.pin(b * 20 + 13).duty);
    serialBuffers.forEach((text, b) => {
      if (!text) return;
      useStore.getState().appendSerial(text, b);
      serialBuffers[b] = '';
    });
    checkMission(worldDt);
  }
  live.txFlash = live.txFlash.map((v) => Math.max(0, v - dt * 8));
  updateSounds();
}

let started = false;
export function startLoop(): void {
  if (started) return;
  started = true;
  resetWorld();
  // A new mission (or the same one opened again) gets a fresh world.
  useStore.subscribe((s, prev) => {
    if (s.epoch !== prev.epoch || s.worldId !== prev.worldId) resetWorld();
  });
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
