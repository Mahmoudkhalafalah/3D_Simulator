import type { DeviceState } from '../../devices/logic';
import type { CheckApi, Mission } from '../types';

const RAIL_POWER: [string, string][] = [
  ['uno:5V', 'rail:P0'],
  ['uno:GND1', 'rail:N0'],
];

const light = (c: CheckApi, id = 'carLight') => {
  const [r = 0, y = 0, g = 0] = c.dev(id).levels;
  return { red: r > 0.5, yellow: y > 0.5, green: g > 0.5 };
};
const only = (c: CheckApi, colour: 'red' | 'yellow' | 'green') => {
  const l = light(c);
  return l[colour] && (['red', 'yellow', 'green'] as const).every((k) => k === colour || !l[k]);
};

/** Segment patterns a-g (accepting the common variants of 6, 7 and 9). */
const DIGIT_PATTERNS: Record<string, number> = {
  '1111110': 0,
  '0110000': 1,
  '1101101': 2,
  '1111001': 3,
  '0110011': 4,
  '1011011': 5,
  '1011111': 6,
  '0011111': 6,
  '1110000': 7,
  '1110010': 7,
  '1111111': 8,
  '1111011': 9,
  '1110011': 9,
};
/** Which digit a 7-segment display shows: null = blank, -1 = not a digit. */
export function digitOf(st: DeviceState): number | null {
  const bits = Array.from({ length: 7 }, (_, i) => ((st.levels[i] ?? 0) > 0.5 ? '1' : '0')).join('');
  if (bits === '0000000') return null;
  return DIGIT_PATTERNS[bits] ?? -1;
}

const TRAFFIC_LIGHT_WIRES: [string, string][] = [
  ['carLight:RED', 'uno:D12'],
  ['carLight:YEL', 'uno:D11'],
  ['carLight:GRN', 'uno:D10'],
  ['carLight:GND', 'uno:GND1'],
];

const CROSSING_VIEW = { position: [-5, 8.5, 13] as [number, number, number], target: [0, 0.5, 0.8] as [number, number, number] };

export const TRAFFIC_TOWN_MISSIONS: Mission[] = [
  {
    id: 'railLights',
    title: 'Railway Warning Lamps',
    emoji: '🚨',
    course: ['L1S3'],
    story: 'At the railway crossing, two red lamps must flash in turn - left, right, left, right - so every driver notices them from far away.',
    steps: [
      'Wire the left lamp: G → GND, S → pin 8.',
      'Wire the right lamp: G → another GND, S → pin 9.',
      'The code already flashes the left lamp. Make the right lamp light up while the left one is off.',
      'Press ▶ Run and look at the railway crossing!',
    ],
    devices: ['railLampL', 'railLampR'],
    controls: ['time', 'train'],
    setup: { hour: 19 },
    view: { position: [5, 7, 10], target: [12, 1, 2] },
    starterCode: `// Railway warning lamps: flash left and right in turn.
// The left lamp is on pin 8, the right lamp on pin 9.

const int LEFT = 8;
const int RIGHT = 9;

void setup() {
  pinMode(LEFT, OUTPUT);
  // TODO: set the RIGHT pin as an OUTPUT too
}

void loop() {
  digitalWrite(LEFT, HIGH);   // left ON
  delay(500);
  digitalWrite(LEFT, LOW);    // left OFF
  delay(500);

  // TODO: the right lamp should be ON while the left lamp is OFF.
  // Hint: you need digitalWrite(RIGHT, HIGH) and digitalWrite(RIGHT, LOW)
}
`,
    solutionCode: `// Railway warning lamps: flash left and right in turn.

const int LEFT = 8;
const int RIGHT = 9;

void setup() {
  pinMode(LEFT, OUTPUT);
  pinMode(RIGHT, OUTPUT);
}

void loop() {
  digitalWrite(LEFT, HIGH);   // left ON, right OFF
  digitalWrite(RIGHT, LOW);
  delay(500);

  digitalWrite(LEFT, LOW);    // left OFF, right ON
  digitalWrite(RIGHT, HIGH);
  delay(500);
}
`,
    solutionWires: [
      ['railLampL:GND', 'uno:GND1'],
      ['railLampL:SIG', 'uno:D8'],
      ['railLampR:GND', 'uno:GND2'],
      ['railLampR:SIG', 'uno:D9'],
    ],
    hints: [
      'Each lamp needs its own pin and a GND. The Arduino has three GND pins you can use.',
      'Taking turns means: when one lamp turns ON, the other turns OFF at the same moment.',
      'Did you remember pinMode(RIGHT, OUTPUT) in setup()? Without it the pin stays an input.',
    ],
    objectives: [
      { text: 'The left lamp flashes', check: (c) => c.count(c.dev('railLampL').brightness > 0.5) >= 2 },
      { text: 'Left and right take turns', check: (c) => c.count(c.dev('railLampR').brightness > 0.5 && c.dev('railLampL').brightness < 0.5) >= 3 },
      { text: 'They are never both on at once', check: (c) => c.held(!(c.dev('railLampL').brightness > 0.5 && c.dev('railLampR').brightness > 0.5) && c.dev('railLampR').brightness + c.dev('railLampL').brightness > 0.3, 3) },
    ],
  },
  {
    id: 'trafficLight',
    title: 'The Traffic Light',
    emoji: '🚦',
    course: ['L1S3', 'L1S8'],
    story: 'Cars are zooming through the crossing and nobody can cross the street! Build a traffic light: red, then green, then yellow, again and again.',
    steps: [
      'Wire the traffic light module: R → pin 12, Y → pin 11, G → pin 10, − → GND.',
      'The code already shows red and green. Add the yellow light (1 second) after green.',
      'Run it and watch the cars stop on red and go on green.',
    ],
    devices: ['carLight'],
    controls: ['time'],
    view: CROSSING_VIEW,
    starterCode: `// Traffic light: red -> green -> yellow -> red ...

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  // Red: cars stop
  digitalWrite(RED, HIGH);
  delay(3000);
  digitalWrite(RED, LOW);

  // Green: cars go
  digitalWrite(GREEN, HIGH);
  delay(3000);
  digitalWrite(GREEN, LOW);

  // TODO: Yellow for 1 second, so drivers know that red is coming
}
`,
    solutionCode: `// Traffic light: red -> green -> yellow -> red ...

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  digitalWrite(RED, HIGH);      // Red: cars stop
  delay(3000);
  digitalWrite(RED, LOW);

  digitalWrite(GREEN, HIGH);    // Green: cars go
  delay(3000);
  digitalWrite(GREEN, LOW);

  digitalWrite(YELLOW, HIGH);   // Yellow: get ready to stop
  delay(1000);
  digitalWrite(YELLOW, LOW);
}
`,
    solutionWires: TRAFFIC_LIGHT_WIRES,
    hints: [
      'A traffic light module has one pin for each colour and one − pin for ground.',
      'Copy the three lines that make green light up, and change GREEN to YELLOW and 3000 to 1000.',
      'Only one colour should be on at a time: turn each colour OFF before the next one turns ON.',
    ],
    objectives: [
      { text: 'Red light: the cars stop', check: (c) => c.held(only(c, 'red'), 2) },
      { text: 'Green light: the cars go', check: (c) => c.held(only(c, 'green'), 2) },
      { text: 'Yellow light: get ready to stop', check: (c) => c.held(only(c, 'yellow'), 0.5) },
      { text: 'Red again: the cycle repeats', check: (c) => c.held(only(c, 'red'), 1) },
    ],
  },
  {
    id: 'beepingCrossing',
    title: 'The Beeping Crossing',
    emoji: '🔊',
    course: ['L1S5'],
    story: 'People who cannot see well need to HEAR when it is safe to cross. Make the crossing beep quickly while the cars have red, and stay quiet while they have green.',
    steps: [
      'Wire the traffic light: R → 12, Y → 11, G → 10, − → GND.',
      'Wire the crossing beeper: G → GND, S → pin 8.',
      'While the light is red, play short beeps with tone(8, 1800) and noTone(8).',
      'Run it, then send a pedestrian across!',
    ],
    devices: ['carLight', 'crossBeeper'],
    controls: ['walker', 'time'],
    view: CROSSING_VIEW,
    starterCode: `// The beeping crossing: beep while pedestrians may walk (cars have red).

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;
const int BEEPER = 8;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  digitalWrite(RED, HIGH);
  delay(4000);              // TODO: beep here instead of just waiting
  digitalWrite(RED, LOW);

  digitalWrite(GREEN, HIGH);
  delay(4000);              // green: stay quiet
  digitalWrite(GREEN, LOW);

  digitalWrite(YELLOW, HIGH);
  delay(1000);
  digitalWrite(YELLOW, LOW);
}
`,
    solutionCode: `// The beeping crossing: beep while pedestrians may walk (cars have red).

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;
const int BEEPER = 8;

// Fast beeps for a number of seconds: "walk now!"
void beepFor(int seconds) {
  for (int i = 0; i < seconds * 4; i++) {
    tone(BEEPER, 1800);   // 1800 Hz: a high, clear beep
    delay(120);
    noTone(BEEPER);
    delay(130);
  }
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  digitalWrite(RED, HIGH);
  beepFor(4);               // pedestrians walk while the cars wait
  digitalWrite(RED, LOW);

  digitalWrite(GREEN, HIGH);
  delay(4000);              // green: stay quiet
  digitalWrite(GREEN, LOW);

  digitalWrite(YELLOW, HIGH);
  delay(1000);
  digitalWrite(YELLOW, LOW);
}
`,
    solutionWires: [...TRAFFIC_LIGHT_WIRES, ['crossBeeper:GND', 'uno:GND2'], ['crossBeeper:SIG', 'uno:D8']],
    hints: [
      'tone(8, 1800) starts a beep on pin 8 and noTone(8) stops it. Higher numbers make higher sounds.',
      'One beep = tone, short delay, noTone, short delay. Repeat it with a for loop to fill the red time.',
      'Four beeps of 250 ms make one second, so 16 beeps fill 4 seconds of red.',
    ],
    objectives: [
      { text: 'It beeps while the cars have red', check: (c) => c.count(light(c).red && c.dev('crossBeeper').freq > 0) >= 3 },
      { text: 'It is quiet while the cars have green', check: (c) => c.held(light(c).green && c.dev('crossBeeper').freq === 0, 2) },
      { text: 'A pedestrian crosses safely', check: (c) => c.world.safeCrossings >= 1 && c.world.unsafeCrossings === 0 },
    ],
  },
  {
    id: 'pushToCross',
    title: 'Push to Cross',
    emoji: '🚶',
    course: ['L1S6', 'L1S8', 'L1S10'],
    story: 'The light should stay green for cars until someone wants to cross. When a pedestrian presses the button, stop the cars and show the green walking man.',
    steps: [
      'Traffic light: R → 12, Y → 11, G → 10, − → GND1.',
      'Walk light: G → GND2, S → pin 7.',
      'Crossing button: G → GND3, V → 5V, S → pin 2.',
      'When digitalRead(2) is HIGH: yellow, then red, then turn on the walk light for 5 seconds.',
      'Run it and send a pedestrian!',
    ],
    devices: ['carLight', 'walkLamp', 'crossButton'],
    controls: ['walker', 'time'],
    view: CROSSING_VIEW,
    starterCode: `// Push to cross: green for cars until someone presses the button.

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;
const int WALK = 7;     // the green walking-man light
const int BUTTON = 2;   // the crossing button

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(WALK, OUTPUT);
  pinMode(BUTTON, INPUT);
  digitalWrite(GREEN, HIGH);   // cars start with green
}

void loop() {
  // TODO: if the button reads HIGH, someone wants to cross:
  //   1. green OFF, yellow ON for 1.5 seconds
  //   2. yellow OFF, red ON
  //   3. walk light ON for 5 seconds, then OFF
  //   4. red OFF, green ON again
}
`,
    solutionCode: `// Push to cross: green for cars until someone presses the button.

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;
const int WALK = 7;
const int BUTTON = 2;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(WALK, OUTPUT);
  pinMode(BUTTON, INPUT);
  digitalWrite(GREEN, HIGH);   // cars start with green
}

void loop() {
  if (digitalRead(BUTTON) == HIGH) {   // someone wants to cross
    delay(1000);
    digitalWrite(GREEN, LOW);
    digitalWrite(YELLOW, HIGH);
    delay(1500);
    digitalWrite(YELLOW, LOW);
    digitalWrite(RED, HIGH);           // cars stop
    delay(500);
    digitalWrite(WALK, HIGH);          // walk!
    delay(5000);
    digitalWrite(WALK, LOW);
    delay(1000);                       // let the last people finish
    digitalWrite(RED, LOW);
    digitalWrite(GREEN, HIGH);         // cars go again
  }
}
`,
    solutionWires: [
      ['carLight:RED', 'uno:D12'],
      ['carLight:YEL', 'uno:D11'],
      ['carLight:GRN', 'uno:D10'],
      ['carLight:GND', 'uno:GND1'],
      ['walkLamp:GND', 'uno:GND2'],
      ['walkLamp:SIG', 'uno:D7'],
      ['crossButton:GND', 'uno:GND3'],
      ['crossButton:VCC', 'uno:5V'],
      ['crossButton:SIG', 'uno:D2'],
    ],
    hints: [
      'digitalRead(BUTTON) gives HIGH while the button is pressed. Put your steps inside if (digitalRead(BUTTON) == HIGH) { ... }',
      'Never turn the walk light on while cars have green or yellow. Red first, then walk!',
      'After the walk light goes off, wait a moment before green, so slow walkers can finish crossing.',
    ],
    objectives: [
      { text: 'Cars have green while nobody is waiting', check: (c) => c.held(only(c, 'green') && c.dev('walkLamp').brightness < 0.5, 3) },
      { text: 'Button pressed: yellow, then red for the cars', check: (c) => c.world.buttonPresses >= 1 && c.held(only(c, 'red'), 0.4) },
      { text: 'The pedestrian crosses on the walk light, safely', check: (c) => c.world.safeCrossings >= 1 && c.world.unsafeCrossings === 0 },
      { text: 'Then the cars get green again', check: (c) => c.held(only(c, 'green') && c.dev('walkLamp').brightness < 0.5, 1.5) },
    ],
  },
  {
    id: 'countdown',
    title: 'Countdown Display',
    emoji: '🔢',
    course: ['L2S2', 'L1S11'],
    story: 'Pedestrians want to know how long they have left to cross. Make the crossing display count down: 9, 8, 7 ... 1, 0.',
    steps: [
      'Wire the 7-segment display: a → 2, b → 3, c → 4, d → 5, e → 6, f → 7, g → 8, − (COM) → GND.',
      'The DIGITS array says which segments make each number. Digits 5 to 9 are missing!',
      'Fill in the missing rows (1 = segment on), then Run.',
    ],
    devices: ['countdown'],
    controls: ['walker', 'time'],
    view: { position: [-3, 5, 9], target: [-1, 1.2, 2.6] },
    starterCode: `// Countdown display: 9, 8, 7 ... 0 on a 7-segment display.
//
//      aaa
//     f   b
//      ggg
//     e   c
//      ddd

const int SEG[7] = {2, 3, 4, 5, 6, 7, 8};   // pins for segments a, b, c, d, e, f, g

// Which segments light up for each digit (1 = on), in the order a b c d e f g
const byte DIGITS[10][7] = {
  {1, 1, 1, 1, 1, 1, 0},   // 0
  {0, 1, 1, 0, 0, 0, 0},   // 1
  {1, 1, 0, 1, 1, 0, 1},   // 2
  {1, 1, 1, 1, 0, 0, 1},   // 3
  {0, 1, 1, 0, 0, 1, 1},   // 4
  {0, 0, 0, 0, 0, 0, 0},   // 5  TODO
  {0, 0, 0, 0, 0, 0, 0},   // 6  TODO
  {0, 0, 0, 0, 0, 0, 0},   // 7  TODO
  {0, 0, 0, 0, 0, 0, 0},   // 8  TODO
  {0, 0, 0, 0, 0, 0, 0},   // 9  TODO
};

void showDigit(int n) {
  for (int i = 0; i < 7; i++) {
    digitalWrite(SEG[i], DIGITS[n][i]);
  }
}

void setup() {
  for (int i = 0; i < 7; i++) {
    pinMode(SEG[i], OUTPUT);
  }
}

void loop() {
  for (int n = 9; n >= 0; n--) {   // count down from 9 to 0
    showDigit(n);
    delay(1000);
  }
  delay(2000);
}
`,
    solutionCode: `// Countdown display: 9, 8, 7 ... 0 on a 7-segment display.

const int SEG[7] = {2, 3, 4, 5, 6, 7, 8};   // pins for segments a, b, c, d, e, f, g

// Which segments light up for each digit (1 = on), in the order a b c d e f g
const byte DIGITS[10][7] = {
  {1, 1, 1, 1, 1, 1, 0},   // 0
  {0, 1, 1, 0, 0, 0, 0},   // 1
  {1, 1, 0, 1, 1, 0, 1},   // 2
  {1, 1, 1, 1, 0, 0, 1},   // 3
  {0, 1, 1, 0, 0, 1, 1},   // 4
  {1, 0, 1, 1, 0, 1, 1},   // 5
  {1, 0, 1, 1, 1, 1, 1},   // 6
  {1, 1, 1, 0, 0, 0, 0},   // 7
  {1, 1, 1, 1, 1, 1, 1},   // 8
  {1, 1, 1, 1, 0, 1, 1},   // 9
};

void showDigit(int n) {
  for (int i = 0; i < 7; i++) {
    digitalWrite(SEG[i], DIGITS[n][i]);
  }
}

void setup() {
  for (int i = 0; i < 7; i++) {
    pinMode(SEG[i], OUTPUT);
  }
}

void loop() {
  for (int n = 9; n >= 0; n--) {   // count down from 9 to 0
    showDigit(n);
    delay(1000);
  }
  delay(2000);
}
`,
    solutionWires: [
      ['countdown:a', 'uno:D2'],
      ['countdown:b', 'uno:D3'],
      ['countdown:c', 'uno:D4'],
      ['countdown:d', 'uno:D5'],
      ['countdown:e', 'uno:D6'],
      ['countdown:f', 'uno:D7'],
      ['countdown:g', 'uno:D8'],
      ['countdown:COM', 'uno:GND1'],
    ],
    hints: [
      'Draw the digit on paper and tick which bars (a to g) you need. For 7 you need a, b and c.',
      '8 lights up every segment, so its row is all 1s.',
      'DIGITS[n][i] picks row n (the digit) and column i (the segment). Arrays start counting at 0!',
    ],
    objectives: [
      { text: 'The display shows a number', check: (c) => c.held((digitOf(c.dev('countdown')) ?? -1) >= 0, 0.3) },
      {
        text: 'It counts down 9, 8, 7 … 1, 0, one number per second',
        check: (c) => {
          const m = c.mem;
          m.seq ??= [] as { d: number; t: number }[];
          m.t = (m.t ?? 0) + c.dt;
          const d = digitOf(c.dev('countdown'));
          if (d !== m.last) {
            m.seq.push({ d, t: m.t });
            m.last = d;
            if (m.seq.length > 30) m.seq.shift();
          }
          const s = m.seq as { d: number | null; t: number }[];
          for (let i = 0; i + 10 < s.length; i++) {
            const run = s.slice(i, i + 11);
            if (run.slice(0, 10).every((e, k) => e.d === 9 - k) && run.slice(0, 9).every((e, k) => run[k + 1].t - e.t > 0.6 && run[k + 1].t - e.t < 1.6)) return true;
          }
          return false;
        },
      },
    ],
  },
  {
    id: 'railBarrier',
    title: 'Railway Barrier',
    emoji: '🚂',
    course: ['L2S3', 'L1S12'],
    story: 'A train is coming! An infrared sensor beside the track can see the train. Close the barrier and ring the bell before the train reaches the road.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'IR sensor: G → - rail, V → + rail, O → pin 4. It reads LOW when the train is in front of it.',
      'Barrier servo: G → - rail, V → + rail, S → pin 9. 90° = open, 0° = closed.',
      'Bell (buzzer): G → GND, S → pin 8.',
      'Write closeBarrier() and openBarrier() functions, then call a train!',
    ],
    devices: ['trainSensor', 'railBarrier', 'railBell'],
    controls: ['train', 'time'],
    view: { position: [2, 9, 13], target: [11, 0.5, -2] },
    starterCode: `// Railway barrier: close it when the IR sensor sees a train.
#include <Servo.h>

const int SENSOR = 4;   // IR sensor: LOW when the train is in front of it
const int BELL = 8;
Servo barrier;

const int UP = 90;      // barrier open
const int DOWN = 0;     // barrier closed

void openBarrier() {
  barrier.write(UP);
}

// TODO: write a closeBarrier() function

void setup() {
  pinMode(SENSOR, INPUT);
  barrier.attach(9);
  openBarrier();
}

void loop() {
  // TODO: if digitalRead(SENSOR) is LOW, a train is coming:
  //   close the barrier, ring the bell while the train passes,
  //   and open the barrier again a few seconds after the sensor is clear.
}
`,
    solutionCode: `// Railway barrier: close it when the IR sensor sees a train.
#include <Servo.h>

const int SENSOR = 4;   // IR sensor: LOW when the train is in front of it
const int BELL = 8;
Servo barrier;

const int UP = 90;      // barrier open
const int DOWN = 0;     // barrier closed

void openBarrier() {
  barrier.write(UP);
}

void closeBarrier() {
  barrier.write(DOWN);
}

// Ring the bell a number of times (each ring takes 0.3 seconds)
void ringBell(int times) {
  for (int i = 0; i < times; i++) {
    tone(BELL, 1200);
    delay(150);
    noTone(BELL);
    delay(150);
  }
}

void setup() {
  pinMode(SENSOR, INPUT);
  barrier.attach(9);
  openBarrier();
}

void loop() {
  if (digitalRead(SENSOR) == LOW) {        // a train is coming!
    closeBarrier();
    ringBell(10);
    while (digitalRead(SENSOR) == LOW) {   // wait until the sensor is clear
      ringBell(1);
    }
    ringBell(14);                          // the end of the train still has to cross the road
    openBarrier();
  }
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['trainSensor:GND', 'rail:N2'],
      ['trainSensor:VCC', 'rail:P2'],
      ['trainSensor:OUT', 'uno:D4'],
      ['railBarrier:GND', 'rail:N6'],
      ['railBarrier:VCC', 'rail:P6'],
      ['railBarrier:SIG', 'uno:D9'],
      ['railBell:GND', 'uno:GND2'],
      ['railBell:SIG', 'uno:D8'],
    ],
    hints: [
      'The IR sensor is LOW when it sees something. So "train coming" means digitalRead(SENSOR) == LOW.',
      'The sensor is before the crossing. When it stops seeing the train, the back of the train is still on the road - wait about 4 seconds before opening.',
      'A while loop keeps going as long as its condition is true: while (digitalRead(SENSOR) == LOW) { ... }',
    ],
    objectives: [
      { text: 'The barrier is down when the train reaches the road', check: (c) => c.world.trainOnRoad && c.dev('railBarrier').angle < 20 },
      { text: 'The bell rings while the train passes', check: (c) => c.world.trainOnRoad && c.dev('railBell').freq > 0 },
      { text: 'The train crosses safely', check: (c) => c.world.safeTrains >= 1 && c.world.unsafeTrains === 0 },
      { text: 'The barrier opens again after the train', check: (c) => c.held(!c.world.trainOnRoad && c.dev('railBarrier').angle > 60, 1) },
    ],
  },
  {
    id: 'carParkGate',
    title: 'Car Park Gate',
    emoji: '🅿️',
    course: ['L2S4', 'L1S12'],
    story: 'The new car park needs an automatic gate. An ultrasonic sensor measures how far away the car is. Open the gate when a car is waiting, and close it after it drives in.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'Distance sensor: V → + rail, T → pin 6, E → pin 7, G → - rail.',
      'Gate servo: G → - rail, V → + rail, S → pin 9. 0° = closed, 90° = open.',
      'Measure the distance with pulseIn(). Open the gate when the car is closer than 100 cm.',
      'Run it and send a car to the car park!',
    ],
    devices: ['gateSensor', 'gateBarrier'],
    controls: ['parkCar', 'time'],
    view: { position: [-2, 9, 17], target: [-8, 0.5, 5] },
    starterCode: `// Car park gate: open when a car is waiting.
#include <Servo.h>

const int TRIG = 6;
const int ECHO = 7;
Servo gate;

// Measure the distance to the car in centimetres
long readDistanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);       // send a 10 us "ping"
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);   // time for the echo to come back
  if (us == 0) return 999;        // no echo: nothing in front of the sensor
  return us / 58;                 // sound travels 1 cm there and back in 58 us
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  gate.attach(9);
  gate.write(0);                  // start closed
}

void loop() {
  long cm = readDistanceCm();
  Serial.println(cm);
  // TODO: if cm is less than 100, open the gate (90), wait 4 seconds,
  //       otherwise keep it closed (0)
  delay(100);
}
`,
    solutionCode: `// Car park gate: open when a car is waiting.
#include <Servo.h>

const int TRIG = 6;
const int ECHO = 7;
Servo gate;

// Measure the distance to the car in centimetres
long readDistanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);       // send a 10 us "ping"
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);   // time for the echo to come back
  if (us == 0) return 999;        // no echo: nothing in front of the sensor
  return us / 58;                 // sound travels 1 cm there and back in 58 us
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  gate.attach(9);
  gate.write(0);                  // start closed
}

void loop() {
  long cm = readDistanceCm();
  Serial.println(cm);
  if (cm < 100) {                 // a car is waiting at the gate
    gate.write(90);               // open
    delay(4000);                  // time to drive through
  } else {
    gate.write(0);                // closed
  }
  delay(100);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['gateSensor:VCC', 'rail:P3'],
      ['gateSensor:TRIG', 'uno:D6'],
      ['gateSensor:ECHO', 'uno:D7'],
      ['gateSensor:GND', 'rail:N3'],
      ['gateBarrier:GND', 'rail:N8'],
      ['gateBarrier:VCC', 'rail:P8'],
      ['gateBarrier:SIG', 'uno:D9'],
    ],
    hints: [
      'Open the Serial Monitor to see the distances. When nothing is there you get 999.',
      'Use if (cm < 100) { ... } else { ... } to choose between opening and closing.',
      'Keep the gate open for a few seconds with delay(4000), or it might close on top of the car!',
    ],
    objectives: [
      { text: 'The gate stays closed while no car is waiting', check: (c) => c.held(c.dev('gateBarrier').angle < 20 && c.world.parkCar === 'away', 1) },
      { text: 'The gate opens for the waiting car', check: (c) => (c.world.parkCar === 'waiting' || c.world.parkCar === 'entering') && c.dev('gateBarrier').angle > 60 },
      { text: 'The car drives into the car park', check: (c) => c.world.parked >= 1 && c.world.gateHits === 0 },
      { text: 'The gate closes again behind it', check: (c) => c.held(c.world.parked >= 1 && c.dev('gateBarrier').angle < 20, 1) },
    ],
  },
  {
    id: 'streetLights',
    title: 'Smart Street Lights',
    emoji: '💡',
    course: ['L1S4', 'L3S4'],
    story: 'Street lights waste electricity when they shine at full power all evening. Make them glow softly at dusk and brighter as the night gets darker.',
    steps: [
      'Light sensor: G → GND, V → 5V, A → A0.',
      'Street lamps: G → GND, S → pin 9 (a PWM pin with ~).',
      'Read the light with analogRead(A0), turn it around with map(), and set the brightness with analogWrite(9, ...).',
      'Run it and slide the time from day to night.',
    ],
    devices: ['streetSensor', 'streetLamps'],
    controls: ['time'],
    setup: { hour: 12 },
    view: { position: [2, 7, 15], target: [0, 1.5, 3] },
    starterCode: `// Smart street lights: brighter when it is darker.

const int SENSOR = A0;   // light sensor: 0 (dark) to 1023 (bright)
const int LAMPS = 9;     // a PWM pin (~), so the brightness can change

void setup() {
  Serial.begin(9600);
  pinMode(LAMPS, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR);
  Serial.println(light);

  // This only knows ON and OFF.
  // TODO: use map() so the lamps glow softly at dusk and fully at night
  if (light < 300) {
    analogWrite(LAMPS, 255);
  } else {
    analogWrite(LAMPS, 0);
  }
  delay(100);
}
`,
    solutionCode: `// Smart street lights: brighter when it is darker.

const int SENSOR = A0;   // light sensor: 0 (dark) to 1023 (bright)
const int LAMPS = 9;     // a PWM pin (~), so the brightness can change

void setup() {
  Serial.begin(9600);
  pinMode(LAMPS, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR);
  Serial.println(light);

  // 100 (night) -> 255 (full power), 800 (daylight) -> 0 (off)
  int brightness = map(light, 100, 800, 255, 0);
  brightness = constrain(brightness, 0, 255);   // keep it between 0 and 255
  analogWrite(LAMPS, brightness);
  delay(100);
}
`,
    solutionWires: [
      ['streetSensor:GND', 'uno:GND1'],
      ['streetSensor:VCC', 'uno:5V'],
      ['streetSensor:AO', 'uno:A0'],
      ['streetLamps:GND', 'uno:GND2'],
      ['streetLamps:SIG', 'uno:D9'],
    ],
    hints: [
      'Open the Serial Monitor and move the time slider: what numbers do you see at day, dusk and night?',
      'map(value, fromLow, fromHigh, toLow, toHigh) turns one range into another. Swapping 255 and 0 turns it around.',
      'map() can give numbers below 0 or above 255. constrain(x, 0, 255) keeps them in range.',
    ],
    objectives: [
      { text: 'Daytime: the lamps are off', check: (c) => c.held(c.world.daylight > 0.8 && c.dev('streetLamps').brightness < 0.08, 1.5) },
      { text: 'Dusk: the lamps glow softly', check: (c) => c.held(c.world.daylight > 0.3 && c.world.daylight < 0.7 && c.dev('streetLamps').brightness > 0.15 && c.dev('streetLamps').brightness < 0.8, 1) },
      { text: 'Night: full brightness', check: (c) => c.held(c.world.daylight < 0.05 && c.dev('streetLamps').brightness > 0.85, 1.5) },
    ],
  },
  {
    id: 'emergencyStop',
    title: 'Emergency Stop',
    emoji: '🛑',
    course: ['L3S6'],
    story: 'A ball rolls onto the road and a child runs after it! The crossing guard hits the emergency button. All cars must get a red light IMMEDIATELY - even if the program is in the middle of a delay().',
    steps: [
      'Traffic light: R → 12, Y → 11, G → 10, − → GND.',
      'Emergency button: G → GND, V → 5V, S → pin 2 (pins 2 and 3 can use interrupts).',
      'Run the starter code and roll the ball. Too slow! The program only checks the button between delays.',
      'Use attachInterrupt() so the button stops everything instantly.',
    ],
    devices: ['carLight', 'emergencyButton'],
    controls: ['ball', 'time'],
    view: CROSSING_VIEW,
    starterCode: `// Emergency stop - first try: checking the button in loop() ("polling").
// Roll the ball: why does the light react so late?

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;
const int EMERGENCY = 2;   // pins 2 and 3 can use interrupts

void allRed() {
  digitalWrite(GREEN, LOW);
  digitalWrite(YELLOW, LOW);
  digitalWrite(RED, HIGH);
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(EMERGENCY, INPUT);
  // TODO: attachInterrupt(digitalPinToInterrupt(EMERGENCY), ..., RISING);
}

void loop() {
  if (digitalRead(EMERGENCY) == HIGH) {   // only checked here!
    allRed();
    delay(5000);
  }
  digitalWrite(RED, HIGH);
  delay(3000);
  digitalWrite(RED, LOW);
  digitalWrite(GREEN, HIGH);
  delay(3000);              // the button is NOT checked during this delay
  digitalWrite(GREEN, LOW);
  digitalWrite(YELLOW, HIGH);
  delay(1000);
  digitalWrite(YELLOW, LOW);
}
`,
    solutionCode: `// Emergency stop with an interrupt: the button stops everything instantly.

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;
const int EMERGENCY = 2;          // pins 2 and 3 can use interrupts

volatile bool emergency = false;  // "volatile": it changes inside the interrupt

// The interrupt service routine: runs the moment the button is pressed
void stopEverything() {
  emergency = true;
  digitalWrite(GREEN, LOW);
  digitalWrite(YELLOW, LOW);
  digitalWrite(RED, HIGH);
}

// Change the lights - unless there is an emergency
void setLights(int r, int y, int g) {
  if (emergency) return;
  digitalWrite(RED, r);
  digitalWrite(YELLOW, y);
  digitalWrite(GREEN, g);
}

// Like delay(), but stops waiting as soon as there is an emergency
void wait(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms && !emergency) {
  }
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(EMERGENCY, INPUT);
  attachInterrupt(digitalPinToInterrupt(EMERGENCY), stopEverything, RISING);
}

void loop() {
  if (emergency) {
    delay(5000);          // keep every car stopped for 5 seconds
    emergency = false;
  }
  setLights(HIGH, LOW, LOW);
  wait(3000);
  setLights(LOW, LOW, HIGH);
  wait(3000);
  setLights(LOW, HIGH, LOW);
  wait(1000);
}
`,
    solutionWires: [
      ...TRAFFIC_LIGHT_WIRES,
      ['emergencyButton:GND', 'uno:GND2'],
      ['emergencyButton:VCC', 'uno:5V'],
      ['emergencyButton:SIG', 'uno:D2'],
    ],
    hints: [
      'Polling means asking "is the button pressed?" over and over. During delay(3000) nobody is asking!',
      'An interrupt is like a tap on the shoulder: attachInterrupt(digitalPinToInterrupt(2), stopEverything, RISING) runs stopEverything() the instant pin 2 goes HIGH.',
      'Variables changed inside an interrupt must be "volatile", and the interrupt function should be short: set a flag and switch the lights.',
    ],
    objectives: [
      { text: 'The traffic light runs normally', check: (c) => c.held(only(c, 'green'), 1) },
      { text: 'Emergency! Red in less than 0.3 seconds', check: (c) => c.world.lastReaction !== null && c.world.lastReaction <= 0.3 },
      { text: 'The cars stay stopped while the child is on the road', check: (c) => c.world.emergencies >= 1 && c.held(only(c, 'red'), 3) },
    ],
  },
  {
    id: 'free',
    title: 'Free Play: Your Town',
    emoji: '🏙️',
    story: 'Every gadget in Traffic Town is on your workbench. Combine them: a crossing with a countdown, street lights that switch on at night, a railway that stops the traffic...',
    steps: ['Pick the gadgets you want to use and wire them up.', 'Write your own program and Run it.', 'Use the buttons in the world to send pedestrians, trains and cars.'],
    devices: [
      'carLight',
      'walkLamp',
      'crossButton',
      'crossBeeper',
      'countdown',
      'railLampL',
      'railLampR',
      'trainSensor',
      'railBarrier',
      'railBell',
      'gateSensor',
      'gateBarrier',
      'streetSensor',
      'streetLamps',
      'emergencyButton',
    ],
    controls: ['time', 'walker', 'train', 'parkCar', 'ball'],
    starterCode: `// Free play: build your own smart town!

void setup() {
  Serial.begin(9600);
}

void loop() {

}
`,
    solutionCode: `// Example: a traffic light that also turns on the street lamps at night.

const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;
const int LAMPS = 9;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(LAMPS, OUTPUT);
}

void loop() {
  int light = analogRead(A0);
  analogWrite(LAMPS, constrain(map(light, 100, 800, 255, 0), 0, 255));

  digitalWrite(RED, HIGH);
  delay(3000);
  digitalWrite(RED, LOW);
  digitalWrite(GREEN, HIGH);
  delay(3000);
  digitalWrite(GREEN, LOW);
  digitalWrite(YELLOW, HIGH);
  delay(1000);
  digitalWrite(YELLOW, LOW);
}
`,
    solutionWires: [],
    hints: ['Look at the earlier missions for wiring ideas.', 'Use a power rail when several modules need 5V.'],
    objectives: [],
  },
];
