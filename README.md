# Circuit World

A 3D Arduino simulator for kids, built around real-life uses. Kids wire real sensor
modules to an Arduino Uno on a 3D workbench, write real Arduino C++, and watch a 3D world
react: the porch light turns on at night, cars stop at the traffic light, the garden
pump waters a thirsty plant, and the vault opens when the right code is typed.

Everything runs locally on one computer. There is no server to pay for and no account,
and it works offline after the one-time setup.

## Worlds

| World | Missions | Highlights |
|---|---|---|
| 🏠 Smart House | 8 + free play | porch light, doorbell, night light, dimmer, automatic door, fan, relay lamp, parking sensor |
| 🚦 Traffic Town | 9 + free play | railway lamps, traffic light, beeping crossing, push-to-cross, 7-segment countdown, IR railway barrier, ultrasonic car park gate, PWM street lights, interrupt emergency stop |
| 🌱 Smart Garden | 9 + free play | soil moisture %, moisture traffic light, automatic watering, DHT11 weather log, LCD and I2C LCD screens, RGB heat alert, L293D greenhouse roof, purple grow light |
| 🔬 Secret Lab | 14 + graduation project | C++ basics on the lab computer (float maths, if/else, loops, arrays, ASCII/binary), binary counter, Catch the Thief, clap lights, theremin, robot arm, keypad vault, EEPROM code, joystick security camera, two-Arduino UART walkie-talkie and SPI |

Every mission is tagged with the lessons of the Arduino course (Levels 1-3) it
practises. The **📘 Course map** (on the welcome screen and in the mission list) shows
all 30 lessons and opens the matching missions.

## For kids and teachers

- **🧩 Blocks or 💻 Code:** every mission can be solved with drag-and-drop blocks (like the
  early course lessons) or typed C++. The blocks generate real Arduino C++, and
  "Show the C++" peeks at it.
- **🧰 Pick the parts myself:** instead of ready-made parts, kids choose from the world's
  parts box which modules a mission needs, and drag them anywhere on the bench.
- **Two Arduinos:** some Level 3 missions put Arduino A and Arduino B side by side, each
  with its own code and Serial Monitor, talking over UART or hand-made SPI.
- **⛶ Full screen** for the world, the workbench and the code/blocks panel.

## Running it

**Windows:** double-click `start.bat`. The first run installs everything (about 250 MB,
one time only) and opens http://localhost:3210.

**Any OS, by hand:**

```bash
npm install
npm run setup     # downloads arduino-cli, the Arduino AVR core and the libraries into ./tools (once)
npm run dev       # development: http://localhost:5173 with hot reload
# or
npm run build && npm start   # production: http://localhost:3210
```

You need Node.js 18 or newer. The setup installs these Arduino libraries: Servo,
LiquidCrystal, LiquidCrystal I2C, DHT sensor library (with Adafruit Unified Sensor) and
Keypad. Wire, EEPROM and SoftwareSerial come with the Arduino core.

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
 ├─ 3D world (one scene per world)  ← reads module states and the world simulation every frame
 ├─ 3D workbench                    ← jumper wires form electrical nets
 ├─ Code editor                     → POST /api/compile
 └─ Simulation loop
      ├─ world simulation: cars, trains, visitors, soil, thieves ... (pure logic, also used by the tests)
      ├─ avr8js: real ATmega328P emulators (one or two) running the compiled .hex
      │    timers, PWM, ADC, USART, I2C (TWI), EEPROM and external interrupts;
      │    two boards run in lockstep so signals cross between them on time
      ├─ module logic: LEDs, sensors, servo, HC-SR04, DHT11 one-wire, HD44780 LCD,
      │    PCF8574 I2C backpack, keypad matrix, L293D, ...
      └─ mission checker: objectives ticked off automatically

Local helper (server/index.mjs, 127.0.0.1 only)
 └─ arduino-cli (official, free) compiles the sketch to .hex, with results cached
```

The simulator runs the actual machine code avr-gcc produces, so `millis()`, `tone()`,
`Servo`, `pulseIn()`, PWM, `Serial`, `Wire`, `EEPROM` and `attachInterrupt()` behave as
they do on a real Uno, and the real libraries (LiquidCrystal, DHT, Keypad ...) work
unchanged. Code that works here works on a real board with the same wiring.

## Project layout

| Path | What it does |
|---|---|
| `src/sim/avr-runner.ts` | Wraps avr8js and measures every pin (level, PWM duty, pulse width, frequency) |
| `src/sim/circuit.ts` | Turns wires into nets and finds mistakes (shorts, reversed power, no ground, swapped SDA/SCL) in kid-friendly words |
| `src/sim/engine.ts` | Connects modules ↔ nets ↔ chip, including cycle-accurate protocols (HC-SR04, DHT11) and the I2C bus |
| `src/sim/session.ts` | The main loop: world simulation, chip, objectives, sounds, EEPROM kept between runs |
| `src/devices/` | Module definitions (pins), behaviour, and the HD44780 LCD controller |
| `src/worlds/<world>/` | Each world: `index.ts` (devices, controls), `sim.ts` (actors), `missions.ts`, `scenarios.ts` (test play-throughs), `Scene.tsx` (3D) |
| `src/worlds/course.ts` | The Arduino course lessons that missions are tagged with |
| `src/bench/` | 3D workbench: Uno boards, power rail, modules (draggable), wires, LCD screens, parts box |
| `src/blocks/` | Block coding: Arduino blocks, the C++ generator, and the Blockly editor (loaded on demand) |
| `src/ui/` | Panels, mission map, course map, friendly compiler errors |
| `server/` | Local compile helper |
| `tests/sim.test.ts` | Hardware tests, then compiles every mission and checks that the solutions pass and the starters don't |

Run the tests with `npm test` (or `npx tsx tests/sim.test.ts trafficTown` for one world).
They need `npm run setup` first.

## Adding a new world

1. Create `src/worlds/<name>/` with `index.ts` exporting a `WorldDef` (devices, missions,
   controls, `createSim`) and a `sim.ts` that moves the world's actors and feeds its sensors.
2. Build its 3D scene in `Scene.tsx`. Gadgets read `live.states[deviceId]` and the world
   simulation (`live.sim`) inside `useFrame`.
3. Register it in `src/worlds/index.ts`, `src/worlds/scenes.tsx` and `src/worlds/scenarios.ts`.

Missions are plain data: story, steps, starter code, solution code, solution wiring,
course lessons and objectives. Objectives are small functions such as
`c.held(c.dev('fan').speed > 0.5, 1.5)`.

## Roadmap

- **Next:** run the emulators in a Web Worker for low-end laptops; starter blocks for the first missions
- **Later:** Robot Arena with physics; ESP32 with Wi-Fi so a phone on the same Wi-Fi can control the simulated house through a QR code; upload to a real board over USB (WebSerial); a desktop installer
