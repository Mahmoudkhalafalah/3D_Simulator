// End-to-end tests: compile every mission with the real Arduino compiler, run it on the
// emulated ATmega328P with the mission's wiring, play a scripted scenario and check
// that the solution completes every objective (and the starter code does not).
import { compileSketch, toolchainReady } from '../server/compiler.mjs';
import { SimEngine } from '../src/sim/engine';
import { analyzeCircuit, type Wire } from '../src/sim/circuit';
import { WORLDS } from '../src/worlds';
import { SCENARIOS } from '../src/worlds/scenarios';
import { MissionChecker } from '../src/worlds/checker';
import { daylight } from '../src/worlds/sense';
import { SandboxSim } from '../src/worlds/sandbox';
import type { Scenario } from '../src/worlds/scenario';
import { defaultInputs, type Mission, type WorldDef, type WorldInputs, type WorldSim, type WorldSnapshot } from '../src/worlds/types';
import type { DeviceInstance } from '../src/devices/specs';
import type { DeviceState } from '../src/devices/logic';
import { explain } from '../src/ui/friendly';
import { generateFromJson } from '../src/blocks/arduino';
import { BLINK_BLOCKS, EVERYTHING_BLOCKS } from './blocks';

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? `  (${detail})` : ''}`);
}

const toWires = (pairs: [string, string][]): Wire[] => pairs.map(([a, b], i) => ({ id: `w${i}`, a, b, color: '#000' }));

interface RunResult {
  compiled: boolean;
  output: string;
  serial: string;
  /** Arduino B's Serial output (two-Arduino runs) */
  serial2: string;
  done: boolean[];
  states: Record<string, DeviceState>;
  /** Device states sampled every simulated second */
  history: Record<string, DeviceState>[];
}

/** Run a sketch with some modules in a world for a while, playing a scenario. */
async function runSketch(opts: {
  /** One sketch, or one per Arduino */
  code: string | string[];
  devices: DeviceInstance[];
  wires: [string, string][];
  scenario: Scenario;
  sim?: WorldSim;
  inputs?: WorldInputs;
  mission?: Mission;
}): Promise<RunResult> {
  const codes = Array.isArray(opts.code) ? opts.code : [opts.code];
  const hexes: string[] = [];
  for (const code of codes) {
    const res = await compileSketch(code, 'uno');
    if (!res.ok || !res.hex) return { compiled: false, output: res.output, serial: '', serial2: '', done: [], states: {}, history: [] };
    hexes.push(res.hex);
  }
  const inputs = opts.inputs ?? defaultInputs();
  const sim: WorldSim = opts.sim ?? new SandboxSim();
  const { scenario, mission } = opts;
  const out = ['', ''];
  const boot = (eeproms?: Uint8Array[]) => {
    const e = new SimEngine(hexes, opts.devices, toWires(opts.wires), () => sim.sense(inputs), eeproms);
    e.onSerial = (b, board) => (out[board] += String.fromCharCode(b));
    return e;
  };
  const roms = (e: SimEngine) => e.runners.map((_, b) => e.eeprom(b));
  let engine = boot();
  const checker = new MissionChecker();
  const done = mission ? mission.objectives.map(() => false) : [];
  const typed = [...(scenario.serial ?? [])];
  const cycles = [...(scenario.powerCycles ?? [])];
  const history: Record<string, DeviceState>[] = [];
  const dt = 1 / 60;
  let nextSample = 1;
  for (let t = 0; t < scenario.duration; t += dt) {
    scenario.script?.(t, inputs, sim);
    while (typed.length && typed[0][0] <= t) engine.runner.serialWrite(typed.shift()![1]);
    if (cycles.length && cycles[0] <= t) {
      cycles.shift();
      engine = boot(roms(engine));
    }
    sim.step(dt, inputs, engine.states);
    for (const e of sim.drainEvents?.() ?? []) if (e === 'power') engine = boot(roms(engine));
    engine.step(dt);
    if (t >= nextSample) {
      nextSample += 1;
      history.push(JSON.parse(JSON.stringify(engine.states)));
    }
    if (mission) {
      const world: WorldSnapshot = { ...inputs, daylight: daylight(inputs.hour), serial: out[0], serial2: out[1], link: { ...engine.link }, ...sim.snapshot() };
      const idx = checker.step(mission, done, engine.states, world, dt);
      if (idx >= 0) done[idx] = true;
    }
  }
  return { compiled: true, output: '', serial: out[0], serial2: out[1], done, states: engine.states, history };
}

function missionInputs(mission: Mission): WorldInputs {
  const { values, ...setup } = mission.setup ?? {};
  const base = defaultInputs();
  return {
    ...base,
    hour: typeof setup.hour === 'number' ? setup.hour : base.hour,
    temperature: typeof setup.temperature === 'number' ? setup.temperature : base.temperature,
    humidity: typeof setup.humidity === 'number' ? setup.humidity : base.humidity,
    values: { ...(values ?? {}) },
  };
}

function runMission(world: WorldDef, mission: Mission, code: string | string[], scenario: Scenario) {
  return runSketch({
    code,
    devices: world.devices.filter((d) => mission.devices.includes(d.id)),
    wires: mission.solutionWires,
    scenario,
    sim: world.createSim(mission.setup ?? {}),
    inputs: missionInputs(mission),
    mission,
  });
}

async function missionTests(world: WorldDef) {
  console.log(`\n========== ${world.emoji}  ${world.title} ==========`);
  for (const mission of world.missions) {
    console.log(`\n${mission.emoji}  ${mission.title}`);
    const two = mission.boards === 2;
    const starterCodes = two ? [mission.starterCode, mission.starterCode2 ?? ''] : mission.starterCode;
    const solutionCodes = two ? [mission.solutionCode, mission.solutionCode2 ?? ''] : mission.solutionCode;
    for (const [i, code] of (two ? [mission.starterCode, mission.starterCode2 ?? ''] : [mission.starterCode]).entries()) {
      const starter = await compileSketch(code, 'uno');
      check(`starter code compiles${two ? ` (Arduino ${'AB'[i]})` : ''}`, starter.ok, starter.ok ? '' : starter.output.split('\n').find((l) => l.includes('error')) ?? '');
    }

    const analysis = analyzeCircuit(world.devices.filter((d) => mission.devices.includes(d.id)), toWires(mission.solutionWires), mission.boards ?? 1);
    const problems = analysis.issues.filter((i) => i.level !== 'info');
    if (mission.solutionWires.length && mission.objectives.length) {
      check('solution wiring has no problems', problems.length === 0, problems.map((p) => p.text).join(' | '));
    }
    const unknown = mission.controls.filter((c) => !world.controls[c]);
    check('mission controls exist', unknown.length === 0, unknown.join(', '));

    const scenario = SCENARIOS[world.id]?.[mission.id];
    if (!scenario) {
      const sol = await compileSketch(mission.solutionCode, 'uno');
      check('example code compiles', sol.ok, sol.ok ? '' : sol.output.split('\n').find((l) => l.includes('error')) ?? '');
      continue;
    }
    const t0 = Date.now();
    const sol = await runMission(world, mission, solutionCodes, scenario);
    check('solution compiles', sol.compiled, sol.compiled ? '' : sol.output.split('\n').find((l) => l.includes('error')) ?? sol.output);
    mission.objectives.forEach((o, i) => check(`solution: ${o.text}`, sol.done[i]));
    const sample = (sol.serial2 || sol.serial).trim().split('\n').slice(-2).join(' / ');
    if (sample) console.log(`     serial: ${sample.slice(0, 90)}`);
    console.log(`     simulated ${scenario.duration}s in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const st = await runMission(world, mission, starterCodes, scenario);
    check('starter code does not already finish the mission', !st.done.every(Boolean));
  }
}

// ---------------------------------------------------------------------------------
// Hardware tests for the modules with their own protocols

const dev = (id: string, type: DeviceInstance['type']): DeviceInstance => ({ id, type, name: id, emoji: '' });
const POWER = (id: string): [string, string][] => [
  [`${id}:GND`, 'uno:GND1'],
  [`${id}:VCC`, 'uno:5V'],
];

async function hardwareTests() {
  console.log('\n🔧 Modules with their own protocols');

  // LCD 16x2 on D12/D11/D5-D2 with the LiquidCrystal library
  let r = await runSketch({
    code: `#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void setup() { lcd.begin(16, 2); lcd.print("Hello, world!"); lcd.setCursor(0, 1); lcd.print(42); }
void loop() {}`,
    devices: [dev('lcd', 'lcd')],
    wires: [...POWER('lcd'), ['lcd:RS', 'uno:D12'], ['lcd:E', 'uno:D11'], ['lcd:D4', 'uno:D5'], ['lcd:D5', 'uno:D4'], ['lcd:D6', 'uno:D3'], ['lcd:D7', 'uno:D2']],
    scenario: { duration: 1 },
  });
  check('LCD (LiquidCrystal) shows text', r.states.lcd?.lines[0].startsWith('Hello, world!') && r.states.lcd.lines[1].startsWith('42'), JSON.stringify(r.states.lcd?.lines));

  // LCD with I2C backpack at 0x27 (LiquidCrystal_I2C, Wire on A4/A5)
  r = await runSketch({
    code: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup() { lcd.init(); lcd.backlight(); lcd.print("I2C works"); lcd.setCursor(3, 1); lcd.print("Temp 25C"); }
void loop() {}`,
    devices: [dev('screen', 'lcdI2c')],
    wires: [...POWER('screen'), ['screen:SDA', 'uno:A4'], ['screen:SCL', 'uno:A5']],
    scenario: { duration: 2.5 },
  });
  check('I2C LCD shows text', r.states.screen?.lines[0].startsWith('I2C works') && r.states.screen.lines[1] === '   Temp 25C     ', JSON.stringify(r.states.screen?.lines));
  check('I2C LCD backlight is on', !!r.states.screen?.display?.backlight);

  // DHT11 with the Adafruit DHT library
  const weather = defaultInputs();
  weather.temperature = 23.5;
  weather.humidity = 61;
  r = await runSketch({
    code: `#include <DHT.h>
DHT dht(7, DHT11);
void setup() { Serial.begin(9600); dht.begin(); }
void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) Serial.println("fail");
  else { Serial.print("T="); Serial.print(t); Serial.print(" H="); Serial.println(h); }
  delay(2000);
}`,
    devices: [dev('dht', 'dht')],
    wires: [['dht:GND', 'uno:GND1'], ['dht:VCC', 'uno:5V'], ['dht:DATA', 'uno:D7']],
    scenario: { duration: 4.5 },
    inputs: weather,
  });
  check('DHT11 reads temperature and humidity', r.serial.includes('T=23.50 H=61.00') && !r.serial.includes('fail'), r.serial.trim().replace(/\r?\n/g, ' | '));

  // 4x4 keypad with the Keypad library
  r = await runSketch({
    code: `#include <Keypad.h>
char keys[4][4] = {{'1','2','3','A'},{'4','5','6','B'},{'7','8','9','C'},{'*','0','#','D'}};
byte rowPins[4] = {9, 8, 7, 6};
byte colPins[4] = {5, 4, 3, 2};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, 4, 4);
void setup() { Serial.begin(9600); }
void loop() { char k = keypad.getKey(); if (k) Serial.print(k); }`,
    devices: [dev('pad', 'keypad')],
    wires: [
      ['pad:R1', 'uno:D9'], ['pad:R2', 'uno:D8'], ['pad:R3', 'uno:D7'], ['pad:R4', 'uno:D6'],
      ['pad:C1', 'uno:D5'], ['pad:C2', 'uno:D4'], ['pad:C3', 'uno:D3'], ['pad:C4', 'uno:D2'],
    ],
    scenario: {
      duration: 2,
      script: (t, w) => {
        w.keys.pad = t > 0.3 && t < 0.5 ? '5' : t > 0.8 && t < 1.0 ? '#' : t > 1.3 && t < 1.5 ? 'D' : null;
      },
    },
  });
  check('Keypad library reads keys 5, #, D', r.serial === '5#D', JSON.stringify(r.serial));

  // External interrupt on pin 2 works even during a long delay()
  r = await runSketch({
    code: `volatile int presses = 0;
void onPress() { presses++; digitalWrite(13, HIGH); }
void setup() { Serial.begin(9600); pinMode(13, OUTPUT); pinMode(2, INPUT); attachInterrupt(digitalPinToInterrupt(2), onPress, RISING); }
void loop() { delay(5000); Serial.println(presses); }`,
    devices: [dev('btn', 'button'), dev('led', 'led')],
    wires: [...POWER('btn'), ['btn:SIG', 'uno:D2'], ['led:GND', 'uno:GND2'], ['led:SIG', 'uno:D13']],
    scenario: {
      duration: 5.6,
      script: (t, w) => {
        w.pressed.btn = (t > 1 && t < 1.2) || (t > 2 && t < 2.2);
      },
    },
  });
  check('Interrupt reacts during delay()', (r.history[1]?.led?.brightness ?? 0) > 0.5, `LED at 2 s: ${r.history[1]?.led?.brightness}`);
  check('Interrupt counts 2 presses', r.serial.trim() === '2', JSON.stringify(r.serial));

  // EEPROM keeps a counter across power cycles
  r = await runSketch({
    code: `#include <EEPROM.h>
void setup() { Serial.begin(9600); byte n = EEPROM.read(0); if (n == 255) n = 0; n++; EEPROM.write(0, n); Serial.println(n); }
void loop() {}`,
    devices: [],
    wires: [],
    scenario: { duration: 1.5, powerCycles: [0.5, 1.0] },
  });
  check('EEPROM survives power cycles', r.serial.replace(/\r/g, '').trim() === '1\n2\n3', JSON.stringify(r.serial));

  // ----- two Arduinos -----
  const sender = `void setup() { Serial.begin(9600); }
void loop() { Serial.println("hi"); delay(100); }`;
  const echo = (baud: number) => `void setup() { Serial.begin(${baud}); }
void loop() { if (Serial.available()) Serial.write(Serial.read()); }`;
  const link: [string, string][] = [['uno:D1', 'uno2:D0'], ['uno:GND1', 'uno2:GND1']];
  r = await runSketch({ code: [sender, echo(9600)], devices: [], wires: link, scenario: { duration: 1 } });
  check('Serial TX -> RX between two Arduinos', r.serial2.includes('hi\r\nhi'), JSON.stringify(r.serial2.slice(0, 40)));

  r = await runSketch({ code: [sender, echo(4800)], devices: [], wires: link, scenario: { duration: 1 } });
  check('Different baud rates give gibberish', r.serial2.length > 0 && !r.serial2.includes('hi'), JSON.stringify(r.serial2.slice(0, 20)));

  r = await runSketch({ code: [sender, echo(9600)], devices: [], wires: [['uno:D1', 'uno2:D0']], scenario: { duration: 1 } });
  check('No shared GND: the message does not arrive', r.serial2 === '', JSON.stringify(r.serial2.slice(0, 20)));

  r = await runSketch({
    code: [
      `#include <SoftwareSerial.h>
SoftwareSerial link(10, 11);
void setup() { link.begin(9600); }
void loop() { link.println("soft"); delay(100); }`,
      `#include <SoftwareSerial.h>
SoftwareSerial link(10, 11);
void setup() { Serial.begin(9600); link.begin(9600); }
void loop() { if (link.available()) Serial.write(link.read()); }`,
    ],
    devices: [],
    wires: [['uno:D11', 'uno2:D10'], ['uno:GND1', 'uno2:GND1']],
    scenario: { duration: 1 },
  });
  check('SoftwareSerial between two Arduinos (bit by bit)', r.serial2.includes('soft\r\nsoft'), JSON.stringify(r.serial2.slice(0, 40)));
}

async function blocksTests() {
  console.log('\n🧩 Block coding');
  const home = WORLDS.find((w) => w.id === 'smartHome')!;
  const blink = home.missions.find((m) => m.id === 'blink')!;
  const code = generateFromJson(BLINK_BLOCKS);
  const r = await runMission(home, blink, code, { duration: 7 });
  check('blink blocks compile', r.compiled, r.compiled ? '' : r.output);
  check('blink blocks finish "Hello, Porch Light!"', r.done.every(Boolean), JSON.stringify(r.done));
  const all = await compileSketch(generateFromJson(EVERYTHING_BLOCKS), 'uno');
  check('every kind of block compiles', all.ok, all.ok ? '' : all.output.split('\n').filter((l) => l.includes('error')).slice(0, 3).join(' | '));
}

async function circuitTests() {
  console.log('\n🤖 Circuit Helper');
  const home = WORLDS[0];
  const led = home.devices.filter((d) => d.id === 'porchLight' || d.id === 'door');
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

  const screen = [dev('screen', 'lcdI2c')];
  a = analyzeCircuit(screen, [w('screen:SDA', 'uno:A5', 1), w('screen:SCL', 'uno:A4', 2)]);
  check('spots swapped SDA/SCL', a.issues.some((i) => i.text.includes('swapped')));

  a = analyzeCircuit([dev('knob', 'pot')], [w('knob:SIG', 'uno:D7', 1)]);
  check('explains analog sensors need A0-A5', a.issues.some((i) => i.text.includes('analog pin (A0-A5)')));

  a = analyzeCircuit([dev('pad', 'keypad')], [w('pad:R1', 'uno:D9', 1)]);
  check('keypad needs no power pins', a.devices.pad.powerOk);
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
  const sim = new SandboxSim();
  const inputs = defaultInputs();
  const engine = new SimEngine(res.hex!, [], [], () => sim.sense(inputs));
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
  const only = process.argv[2];
  if (!only || only === 'core') {
    await circuitTests();
    await friendlyTests();
    await speedTest();
    await hardwareTests();
    await blocksTests();
  }
  for (const world of WORLDS) if (!only || only === world.id) await missionTests(world);
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

void main();
