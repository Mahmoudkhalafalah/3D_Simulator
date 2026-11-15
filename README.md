# Circuit World

A 3D Arduino simulator for kids, built around real-life uses. Kids wire real sensor
modules to an Arduino Uno on a 3D workbench, write real Arduino C++, and watch a 3D world
react. In the Smart House world, the porch light turns on at night, the door opens for a
visitor, and the parking sensor beeps as the car gets close.

Everything runs locally on one computer. There is no server to pay for and no account,
and it works offline after the one-time setup.

## Running it

**Windows:** double-click `start.bat`. The first run installs everything (about 250 MB,
one time only) and opens http://localhost:3210.

**Any OS, by hand:**

```bash
npm install
npm run setup     # downloads arduino-cli + the Arduino AVR core into ./tools (once)
npm run dev       # development: http://localhost:5173 with hot reload
# or
npm run build && npm start   # production: http://localhost:3210
```

You need Node.js 18 or newer.

## Sharing with friends

```bash
npm run pack
```

This makes `release/CircuitWorld-Windows.zip` (about 125 MB). It contains the app, the
Arduino compiler and a private copy of Node.js. Friends unzip it and double-click
`Start Circuit World.bat`. They don't install anything and don't need internet, and it
runs on their own PC. It works on Windows 10/11, 64-bit.

Windows' avr-gcc can't handle file paths longer than 260 characters. If the folder is
unzipped deep inside other folders, the server reaches gcc through a short junction in
`%LOCALAPPDATA%\CircuitWorld` (see `shortCompilerDir()` in `server/arduino-paths.mjs`).

## How it works

```
Browser (React + Three.js)
 ├─ 3D world (Smart House)  ← reads module states every frame
 ├─ 3D workbench            ← jumper wires form electrical nets
 ├─ Code editor             → POST /api/compile
 └─ Simulation loop
      ├─ avr8js: a real ATmega328P emulator running the compiled .hex
      ├─ module logic: LED, button, PIR, servo, HC-SR04, relay, ...
      └─ mission checker: objectives ticked off automatically

Local helper (server/index.mjs, 127.0.0.1 only)
 └─ arduino-cli (official, free) compiles the sketch to .hex, with results cached
```

The simulator runs the actual machine code avr-gcc produces, so `millis()`, `tone()`,
`Servo`, `pulseIn()`, PWM and `Serial` behave as they do on a real Uno. Code that works
here works on a real board with the same wiring.

## Project layout

| Path | What it does |
|---|---|
| `src/sim/avr-runner.ts` | Wraps avr8js and measures every pin (level, PWM duty, pulse width, frequency) |
| `src/sim/circuit.ts` | Turns wires into nets and finds mistakes (shorts, reversed power, no ground) in kid-friendly words |
| `src/sim/engine.ts` | Connects modules ↔ nets ↔ chip, including cycle-accurate sensors such as the HC-SR04 |
| `src/devices/` | Module definitions (pins) and behaviour |
| `src/worlds/smartHome/` | The Smart House: 3D scene, visitor, and 9 missions |
| `src/bench/` | 3D workbench: Uno, power rail, modules, wires |
| `src/ui/` | Panels, mission map, friendly compiler errors |
| `server/` | Local compile helper |
| `tests/sim.test.ts` | Compiles every mission and checks that the solutions pass and the starters don't |

Run the tests with `npm test`. They need `npm run setup` first.

## Adding a new world

1. Create `src/worlds/<name>/` with an `index.ts` that exports a `WorldDef` (devices + missions).
2. Build its 3D scene. Each gadget reads `live.states[deviceId]` inside `useFrame`.
3. Register it in `src/worlds/index.ts`.

Missions are plain data: story, steps, starter code, solution code, solution wiring and
objectives. Objectives are small functions such as
`c.held(c.dev('fan').speed > 0.5, 1.5)`.

## Roadmap

- **Next:** block coding (Blockly → Arduino C++) for younger kids; Traffic Town and Smart Garden worlds; LCD, NeoPixel and DHT modules; run the emulator in a Web Worker for low-end laptops
- **Later:** ESP32 with Wi-Fi so a phone on the same Wi-Fi can control the simulated house through a QR code; upload to a real board over USB (WebSerial); Robot Arena with physics; a desktop installer
