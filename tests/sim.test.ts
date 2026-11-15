// End-to-end tests: compile every mission with the real Arduino compiler, run it on the
// emulated ATmega328P with the mission's wiring, play a scripted scenario and check
// that the solution completes every objective (and the starter code does not).
import { compileSketch, toolchainReady } from '../server/compiler.mjs';
import { SimEngine } from '../src/sim/engine';
import { analyzeCircuit, type Wire } from '../src/sim/circuit';
import { SMART_HOME } from '../src/worlds/smartHome';
import { MissionChecker } from '../src/worlds/checker';
import { daylight, newVisitor, sendVisitor, stepVisitor, visitorMotion, type VisitorState } from '../src/worlds/smartHome/actors';
import type { Mission, WorldSnapshot } from '../src/worlds/types';
import { explain } from '../src/ui/friendly';

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? `  (${detail})` : ''}`);
}

interface World {
  hour: number;
  temperature: number;
  knob: number;
  carDistance: number;
  pressed: Record<string, boolean>;
}

type Script = (t: number, w: World, v: VisitorState) => void;

const wiresOf = (m: Mission): Wire[] => m.solutionWires.map(([a, b], i) => ({ id: `w${i}`, a, b, color: '#000' }));

async function runMission(mission: Mission, code: string, duration: number, script: Script) {
  const res = await compileSketch(code, 'uno');
  if (!res.ok || !res.hex) {
    return { compiled: false, done: [] as boolean[], serial: '', output: res.output };
  }
  const devices = SMART_HOME.devices.filter((d) => mission.devices.includes(d.id));
  const w: World = { hour: 12, temperature: 24, knob: 0.5, carDistance: 350, pressed: {}, ...(mission.setup ?? {}) };
  const visitor = newVisitor();
  const engine = new SimEngine(hex(res.hex), devices, wiresOf(mission), () => ({
    daylight: daylight(w.hour),
    temperature: w.temperature,
    knob: w.knob,
    motion: visitorMotion(visitor),
    distanceCm: w.carDistance,
    pressed: (id) => !!(w.pressed[id] || (id === 'doorbell' && visitor.ringing)),
  }));
  let serial = '';
  engine.onSerial = (b) => (serial += String.fromCharCode(b));
  const checker = new MissionChecker();
  const done = mission.objectives.map(() => false);
  const dt = 1 / 60;
  for (let t = 0; t < duration; t += dt) {
    script(t, w, visitor);
    stepVisitor(visitor, dt, engine.states.door?.angle ?? 0);
    engine.step(dt);
    const world: WorldSnapshot = {
      hour: w.hour,
      daylight: daylight(w.hour),
      temperature: w.temperature,
      knob: w.knob,
      carDistance: w.carDistance,
      crashed: false,
      visitor: visitor.phase,
      pressed: { ...w.pressed, ...(visitor.ringing ? { doorbell: true } : {}) },
      serial,
    };
    const idx = checker.step(mission, done, engine.states, world, dt);
    if (idx >= 0) done[idx] = true;
  }
  return { compiled: true, done, serial, output: res.output };
}
const hex = (h: string) => h;

const between = (t: number, a: number, b: number) => t >= a && t < b;

const SCENARIOS: Record<string, { duration: number; script: Script }> = {
  blink: { duration: 7, script: () => {} },
  doorbell: {
    duration: 6,
    script: (t, w) => {
      w.pressed.doorbell = between(t, 1, 1.3);
    },
  },
  nightlight: {
    duration: 6,
    script: (t, w) => {
      w.hour = t < 3 ? 22 : 12;
    },
  },
  dimmer: {
    duration: 6,
    script: (t, w) => {
      w.knob = t < 2 ? 0.5 : t < 4 ? 1 : 0;
    },
  },
  welcome: {
    duration: 16,
    script: (t, _w, v) => {
      if (between(t, 0.5, 0.52)) sendVisitor(v);
    },
  },
  fan: {
    duration: 8,
    script: (t, w) => {
      w.temperature = t < 1 ? 22 : t < 4 ? 31 : 23;
    },
  },
  lampswitch: {
    duration: 6,
    script: (t, w) => {
      w.pressed.lightSwitch = between(t, 1, 1.25) || between(t, 3.2, 3.45);
    },
  },
  parking: {
    duration: 10,
    script: (t, w) => {
      if (t < 2) w.carDistance = 350 - t * 135; // drive in to 80 cm
      else if (t < 3) w.carDistance = 80;
      else if (t < 6) w.carDistance = 260; // back up, far away
      else w.carDistance = 20; // park
    },
  },
};

async function missionTests() {
  for (const mission of SMART_HOME.missions) {
    console.log(`\n${mission.emoji}  ${mission.title}`);
    const starter = await compileSketch(mission.starterCode, 'uno');
    check('starter code compiles', starter.ok, starter.ok ? '' : starter.output.split('\n').find((l) => l.includes('error')) ?? '');

    const analysis = analyzeCircuit(SMART_HOME.devices.filter((d) => mission.devices.includes(d.id)), wiresOf(mission));
    const problems = analysis.issues.filter((i) => i.level !== 'info');
    if (mission.solutionWires.length && mission.objectives.length) {
      check('solution wiring has no problems', problems.length === 0, problems.map((p) => p.text).join(' | '));
    }

    const scenario = SCENARIOS[mission.id];
    if (!scenario) {
      const sol = await compileSketch(mission.solutionCode, 'uno');
      check('example code compiles', sol.ok);
      continue;
    }
    const t0 = Date.now();
    const sol = await runMission(mission, mission.solutionCode, scenario.duration, scenario.script);
    check('solution compiles', sol.compiled, sol.compiled ? '' : sol.output);
    mission.objectives.forEach((o, i) => check(`solution: ${o.text}`, sol.done[i]));
    const sample = sol.serial.trim().split('\n').slice(-2).join(' / ');
    if (sample) console.log(`     serial: ${sample.slice(0, 90)}`);
    console.log(`     simulated ${scenario.duration}s in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const st = await runMission(mission, mission.starterCode, scenario.duration, scenario.script);
    check('starter code does not already finish the mission', !st.done.every(Boolean));
  }
}

async function circuitTests() {
  console.log('\n🤖 Circuit Helper');
  const led = SMART_HOME.devices.filter((d) => d.id === 'porchLight' || d.id === 'door');
  const w = (a: string, b: string, i = 0): Wire => ({ id: `t${i}`, a, b, color: '' });

  let a = analyzeCircuit(led, [w('uno:5V', 'uno:GND1')]);
  check('detects a short circuit', a.shorted && a.issues.some((i) => i.text.includes('Short circuit')));

  a = analyzeCircuit(led, [w('door:VCC', 'uno:GND1', 1), w('door:GND', 'uno:5V', 2)]);
  check('detects reversed power', a.issues.some((i) => i.text.includes('backwards')));

  a = analyzeCircuit(led, [w('porchLight:SIG', 'uno:D13')]);
  check('LED without GND needs ground', a.issues.some((i) => i.text.includes('needs ground')) && !a.devices.porchLight.powerOk);

  a = analyzeCircuit(led, [w('door:VCC', 'rail:P3', 1), w('door:GND', 'uno:GND2', 2), w('door:SIG', 'uno:D9', 3)]);
  check('explains unpowered rail', a.issues.some((i) => i.text.includes('red + rail is not connected')));

  a = analyzeCircuit(led, [w('uno:5V', 'rail:P0', 1), w('door:VCC', 'rail:P7', 2), w('door:GND', 'uno:GND2', 3), w('door:SIG', 'uno:D9', 4)]);
  check('power through the rail works', a.devices.door.powerOk && a.devices.door.supply === 5);

  a = analyzeCircuit(led, [w('porchLight:SIG', 'uno:D1'), w('porchLight:GND', 'uno:GND1', 2)]);
  check('warns about Serial pins 0/1', a.issues.some((i) => i.text.includes('Serial')));
}

async function friendlyTests() {
  console.log('\n🐞 Friendly errors');
  const res = await compileSketch('void setup() {\n  pinmode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH)\n  delay(100);\n}\n', 'uno');
  check('broken code fails to compile', !res.ok);
  const msgs = res.diagnostics.map((d) => explain(d));
  check('suggests pinMode for pinmode', msgs.some((m) => m.includes('Did you mean "pinMode"')), msgs.join(' | '));
  check('explains the missing semicolon', msgs.some((m) => m.includes('semicolon')), msgs.join(' | '));
}

async function speedTest() {
  console.log('\n⚡ Speed');
  const res = await compileSketch('void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,HIGH);delay(1);digitalWrite(13,LOW);delay(1);}', 'uno');
  const engine = new SimEngine(res.hex!, [], [], () => ({ daylight: 1, temperature: 20, knob: 0, motion: false, distanceCm: 100, pressed: () => false }));
  const t0 = performance.now();
  for (let i = 0; i < 120; i++) engine.step(1 / 60);
  const ms = performance.now() - t0;
  const ratio = 2000 / ms;
  console.log(`     2 s of Arduino time took ${ms.toFixed(0)} ms (${ratio.toFixed(1)}x real time)`);
  check('runs at least real time', ratio >= 1);
}

async function main() {
  if (!toolchainReady()) {
    console.error('arduino-cli is not installed. Run "npm run setup" first.');
    process.exit(1);
  }
  await circuitTests();
  await friendlyTests();
  await speedTest();
  await missionTests();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

void main();
