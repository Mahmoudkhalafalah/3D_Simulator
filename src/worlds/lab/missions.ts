import type { CheckApi, Mission } from '../types';

const RAIL_POWER: [string, string][] = [
  ['uno:5V', 'rail:P0'],
  ['uno:GND1', 'rail:N0'],
];

const numbers = (text: string) => (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const near = (list: number[], value: number, tol: number) => list.some((n) => Math.abs(n - value) <= tol);
const lines = (serial: string) => serial.split(/\r?\n/).map((l) => l.trim());
const lcdRow = (c: CheckApi, id: string, row: number) => c.dev(id).lines[row] ?? '';

/** Track a sequence of numbers shown over time (e.g. a binary counter). */
function seq(c: CheckApi, value: number | null): number[] {
  const m = c.mem;
  m.seq ??= [];
  if (value !== m.last) {
    m.last = value;
    if (value !== null) m.seq.push(value);
    if (m.seq.length > 60) m.seq.shift();
  }
  return m.seq;
}
const hasRun = (list: number[], run: number[]) => list.join(',').includes(run.join(','));
const binaryValue = (c: CheckApi) => [0, 1, 2, 3].reduce((v, i) => v + (c.dev(`bit${i}`).brightness > 0.5 ? 1 << i : 0), 0);

const KEYPAD_WIRES: [string, string][] = [
  ['keypad:R1', 'uno:D9'],
  ['keypad:R2', 'uno:D8'],
  ['keypad:R3', 'uno:D7'],
  ['keypad:R4', 'uno:D6'],
  ['keypad:C1', 'uno:D5'],
  ['keypad:C2', 'uno:D4'],
  ['keypad:C3', 'uno:D3'],
  ['keypad:C4', 'uno:D2'],
];
const VAULT_WIRES: [string, string][] = [
  ...RAIL_POWER,
  ...KEYPAD_WIRES,
  ['doorScreen:GND', 'rail:N3'],
  ['doorScreen:VCC', 'rail:P3'],
  ['doorScreen:SDA', 'uno:A4'],
  ['doorScreen:SCL', 'uno:A5'],
  ['vaultLock:GND', 'rail:N8'],
  ['vaultLock:VCC', 'rail:P8'],
  ['vaultLock:SIG', 'uno:D10'],
];
const KEYPAD_SETUP = `char keys[4][4] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};
byte rowPins[4] = {9, 8, 7, 6};   // R1-R4
byte colPins[4] = {5, 4, 3, 2};   // C1-C4
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, 4, 4);`;

const SLAVE_CODE = `// Arduino B (SLAVE): receive bytes over SPI and show them on the screen.
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
const int SS_PIN = 10;
const int MOSI_PIN = 11;
const int SCK_PIN = 12;

byte receiveByte() {
  byte b = 0;
  for (int i = 0; i < 8; i++) {
    while (digitalRead(SCK_PIN) == LOW) {}   // wait for the clock tick
    b = (b << 1) | digitalRead(MOSI_PIN);    // read one bit
    while (digitalRead(SCK_PIN) == HIGH) {}  // wait for the tick to end
  }
  return b;
}

void setup() {
  pinMode(SS_PIN, INPUT);
  pinMode(MOSI_PIN, INPUT);
  pinMode(SCK_PIN, INPUT);
  lcd.init();
  lcd.backlight();
  lcd.print("Slave ready:");
  lcd.setCursor(0, 1);
}

void loop() {
  if (digitalRead(SS_PIN) == LOW) {   // the master is talking to us
    char c = receiveByte();
    lcd.print(c);
  }
}
`;

const COMPUTER_VIEW = { position: [-3.4, 2.1, 1.7] as [number, number, number], target: [-3.6, 1.3, -2.6] as [number, number, number] };
const VAULT_VIEW = { position: [1.6, 2.8, 4.6] as [number, number, number], target: [1.2, 1.4, -2.6] as [number, number, number] };
const DOOR_VIEW = { position: [0.5, 4.5, 8] as [number, number, number], target: [3.2, 1.2, 0.6] as [number, number, number] };

export const LAB_MISSIONS: Mission[] = [
  {
    id: 'snackCalculator',
    title: 'Snack Shop Calculator',
    emoji: '🧮',
    course: ['L1S9'],
    story: 'The lab computer runs the snack shop. A sandwich costs 2.50, a juice 1.25 and an apple 0.75. Three friends buy 2 sandwiches, 1 juice and 3 apples. What is the total, and how much does each friend pay?',
    steps: [
      'No wiring needed: this program only uses the Serial Monitor (shown on the lab computer too).',
      'Run the starter code. The total is wrong! Look at the type of the price variables.',
      'int can only hold whole numbers. Use float for money, then print what each friend pays.',
    ],
    devices: [],
    controls: [],
    view: COMPUTER_VIEW,
    starterCode: `// Snack shop calculator.
// Prices: sandwich 2.50, juice 1.25, apple 0.75

void setup() {
  Serial.begin(9600);

  int sandwich = 2.50;    // hmm... can an int hold 2.50?
  int juice = 1.25;
  int apple = 0.75;

  int total = 2 * sandwich + 1 * juice + 3 * apple;
  Serial.print("Total: ");
  Serial.println(total);

  // TODO: three friends share the bill. Print "Each pays: ..."
}

void loop() {
}
`,
    solutionCode: `// Snack shop calculator.
// Prices: sandwich 2.50, juice 1.25, apple 0.75

void setup() {
  Serial.begin(9600);

  float sandwich = 2.50;   // float: numbers with a decimal point
  float juice = 1.25;
  float apple = 0.75;

  float total = 2 * sandwich + 1 * juice + 3 * apple;
  Serial.print("Total: ");
  Serial.println(total);   // 8.50

  float each = total / 3;  // dividing floats keeps the decimals
  Serial.print("Each pays: ");
  Serial.println(each);    // 2.83
}

void loop() {
}
`,
    solutionWires: [],
    hints: [
      'int means "integer": a whole number. int x = 2.50; quietly throws away the .50!',
      'float can hold decimals. Change every price (and the total) to float.',
      'Serial.println() prints floats with 2 decimals, which is perfect for money.',
    ],
    objectives: [
      { text: 'The total is right: 8.50', check: (c) => near(numbers(c.world.serial), 8.5, 0.005) },
      { text: 'Each friend pays 2.83', check: (c) => near(numbers(c.world.serial), 2.83, 0.006) },
    ],
  },
  {
    id: 'gradeRobot',
    title: 'The Grade Robot',
    emoji: '🎓',
    course: ['L1S10'],
    story: 'The lab robot marks the trainee inventors. 90 or more is an A, 75 or more a B, 60 or more a C, anything lower is a D. Then it must find the oldest of three agents.',
    steps: [
      'No wiring needed: open the Serial Monitor.',
      'Finish the if / else if / else ladder so every mark gets the right letter.',
      'Find the oldest agent using comparison operators (>, >=) and && (AND).',
    ],
    devices: [],
    controls: [],
    view: COMPUTER_VIEW,
    starterCode: `// The grade robot: if / else if / else

int marks[5] = {95, 82, 67, 45, 78};

void setup() {
  Serial.begin(9600);

  for (int i = 0; i < 5; i++) {
    int m = marks[i];
    Serial.print(m);
    Serial.print(" -> ");
    if (m >= 90) {
      Serial.println("A");
    } else {
      Serial.println("B");   // TODO: add C (60 or more) and D (below 60)
    }
  }

  int ageA = 12;
  int ageB = 15;
  int ageC = 9;
  int oldest = ageA;         // TODO: compare with ageB and ageC
  Serial.print("Oldest agent: ");
  Serial.println(oldest);
}

void loop() {
}
`,
    solutionCode: `// The grade robot: if / else if / else

int marks[5] = {95, 82, 67, 45, 78};

void setup() {
  Serial.begin(9600);

  for (int i = 0; i < 5; i++) {
    int m = marks[i];
    Serial.print(m);
    Serial.print(" -> ");
    if (m >= 90) {
      Serial.println("A");
    } else if (m >= 75) {
      Serial.println("B");
    } else if (m >= 60) {
      Serial.println("C");
    } else {
      Serial.println("D");
    }
  }

  int ageA = 12;
  int ageB = 15;
  int ageC = 9;
  int oldest;
  if (ageA >= ageB && ageA >= ageC) {
    oldest = ageA;
  } else if (ageB >= ageA && ageB >= ageC) {
    oldest = ageB;
  } else {
    oldest = ageC;
  }
  Serial.print("Oldest agent: ");
  Serial.println(oldest);
}

void loop() {
}
`,
    solutionWires: [],
    hints: [
      'The ladder is checked from the top: the first true condition wins, so put the biggest number first.',
      '&& means AND: (ageA >= ageB && ageA >= ageC) is true only if BOTH parts are true.',
      'Press Restart to run setup() again and see the output from the start.',
    ],
    objectives: [
      {
        text: 'Every mark gets the right grade',
        check: (c) => {
          const want: Record<number, string> = { 95: 'A', 82: 'B', 67: 'C', 45: 'D', 78: 'B' };
          const got: Record<number, string> = {};
          for (const l of lines(c.world.serial)) {
            const m = l.match(/(\d+)\D*?\b([ABCD])\b/);
            if (m) got[Number(m[1])] = m[2];
          }
          return Object.entries(want).every(([k, v]) => got[Number(k)] === v);
        },
      },
      { text: 'Find the oldest agent: 15', check: (c) => lines(c.world.serial).some((l) => /oldest/i.test(l) && near(numbers(l), 15, 0)) },
    ],
  },
  {
    id: 'loopMachine',
    title: 'The Loop Machine',
    emoji: '🔁',
    course: ['L1S11'],
    story: 'The lab machine does boring jobs so you do not have to: count to 100, find a number hidden in an array, and draw a triangle of stars.',
    steps: [
      'No wiring needed: open the Serial Monitor.',
      'Make the while loop count all the way to 100.',
      'Print the 4th secret number. Careful: arrays start counting at 0!',
      'Use a loop inside a loop to draw 5 rows of stars: *, **, ***, ****, *****.',
    ],
    devices: [],
    controls: [],
    view: COMPUTER_VIEW,
    starterCode: `// The loop machine.

int secret[5] = {3, 7, 1, 9, 4};

void setup() {
  Serial.begin(9600);

  // 1. Count with a while loop (TODO: go all the way to 100)
  int n = 0;
  while (n <= 10) {
    Serial.print(n);
    Serial.print(" ");
    n++;
  }
  Serial.println();

  // 2. The 4th secret number. Is secret[4] really the 4th one?
  Serial.print("4th secret number: ");
  Serial.println(secret[4]);

  // 3. TODO: a triangle of 5 rows of stars with nested for loops
  Serial.println("*");
}

void loop() {
}
`,
    solutionCode: `// The loop machine.

int secret[5] = {3, 7, 1, 9, 4};

void setup() {
  Serial.begin(9600);

  // 1. Count with a while loop
  int n = 0;
  while (n <= 100) {
    Serial.print(n);
    Serial.print(" ");
    n++;
  }
  Serial.println();

  // 2. Arrays start at 0: secret[0] is the 1st, so secret[3] is the 4th
  Serial.print("4th secret number: ");
  Serial.println(secret[3]);

  // 3. A loop inside a loop: rows, then stars in each row
  for (int row = 1; row <= 5; row++) {
    for (int s = 0; s < row; s++) {
      Serial.print("*");
    }
    Serial.println();
  }
}

void loop() {
}
`,
    solutionWires: [],
    hints: [
      'A while loop keeps going while its condition is true: while (n <= 100) stops after 100.',
      'secret[0] = 3, secret[1] = 7, secret[2] = 1, secret[3] = 9. The 4th one has index 3!',
      'The outer loop counts rows. The inner loop prints as many stars as the row number.',
    ],
    objectives: [
      {
        text: 'Count from 0 to 100',
        check: (c) => {
          const n = numbers(c.world.serial);
          const run = Array.from({ length: 101 }, (_, i) => i);
          return hasRun(n, run);
        },
      },
      {
        text: 'Print the 4th secret number: 9',
        check: (c) => lines(c.world.serial).some((l) => /4th/.test(l) && /(\d+)\s*$/.test(l) && l.match(/(\d+)\s*$/)![1] === '9'),
      },
      {
        text: 'Draw a triangle of 5 rows of stars',
        check: (c) => lines(c.world.serial).join('\n').includes('*\n**\n***\n****\n*****'),
      },
    ],
  },
  {
    id: 'binaryBracelet',
    title: 'Binary Bracelet',
    emoji: '📿',
    course: ['L1S2', 'L1S3'],
    story: 'Computers store every letter as a number (ASCII), and every number as 0s and 1s. Make a secret binary bracelet: print each letter of a name with its ASCII code and its binary code.',
    steps: [
      'No wiring needed: open the Serial Monitor.',
      'Change the name to your own (in CAPITAL letters).',
      'For each letter print: the letter, its number (int) and its binary code.',
      'Serial.println(x, BIN) prints a number in binary.',
    ],
    devices: [],
    controls: [],
    view: COMPUTER_VIEW,
    starterCode: `// Binary bracelet: letters -> numbers -> 0s and 1s

String name = "ADA";   // write your own name here!

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < name.length(); i++) {
    char c = name[i];
    Serial.print(c);
    Serial.print(" = ");
    Serial.println((int)c);   // the ASCII code
    // TODO: also print it in binary: Serial.println((int)c, BIN);
  }
}

void loop() {
}
`,
    solutionCode: `// Binary bracelet: letters -> numbers -> 0s and 1s

String name = "ADA";   // write your own name here!

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < name.length(); i++) {
    char c = name[i];
    Serial.print(c);
    Serial.print(" = ");
    Serial.print((int)c);         // the ASCII code, e.g. A = 65
    Serial.print(" = ");
    Serial.println((int)c, BIN);  // the same number in binary: 1000001
  }
}

void loop() {
}
`,
    solutionWires: [],
    hints: [
      '(int)c turns a letter into its ASCII number. A is 65, B is 66 ...',
      'Serial.println(65, BIN) prints 1000001. Each 1 or 0 is one bead on the bracelet!',
      'Use Serial.print (no "ln") for parts that should stay on the same line.',
    ],
    objectives: [
      {
        text: 'Print each letter with its ASCII number',
        check: (c) => lines(c.world.serial).filter((l) => {
          const m = l.match(/^([A-Za-z])\D*?(\d+)/);
          return !!m && m[1].charCodeAt(0) === Number(m[2]);
        }).length >= 3,
      },
      {
        text: '...and in binary (0s and 1s)',
        check: (c) => lines(c.world.serial).filter((l) => {
          const m = l.match(/^([A-Za-z])\D*?(\d+)\D+([01]{6,8})\s*$/);
          return !!m && m[1].charCodeAt(0) === Number(m[2]) && parseInt(m[3], 2) === Number(m[2]);
        }).length >= 3,
      },
    ],
  },
  {
    id: 'binaryCounter',
    title: 'Binary Counter',
    emoji: '💡',
    course: ['L2S1'],
    story: 'The lab door shows a code in binary lights. Each light is worth double the one before: 1, 2, 4, 8. Make the four lights count from 0 to 15.',
    steps: [
      'Arduino GND → blue - rail. Each bit light: G → - rail.',
      'Bit 0 (×1) S → pin 2, Bit 1 (×2) → pin 3, Bit 2 (×4) → pin 4, Bit 3 (×8) → pin 5.',
      'bitRead(n, b) gives bit number b of n (0 or 1). Show every bit of the number.',
    ],
    devices: ['bit0', 'bit1', 'bit2', 'bit3'],
    controls: [],
    view: DOOR_VIEW,
    starterCode: `// Binary counter: count from 0 to 15 with four lights.

const int LED[4] = {2, 3, 4, 5};   // worth 1, 2, 4 and 8

void setup() {
  for (int i = 0; i < 4; i++) {
    pinMode(LED[i], OUTPUT);
  }
}

void loop() {
  for (int n = 0; n < 16; n++) {
    digitalWrite(LED[0], bitRead(n, 0));   // the "1" light
    // TODO: the other three lights (use a for loop!)
    delay(500);
  }
}
`,
    solutionCode: `// Binary counter: count from 0 to 15 with four lights.

const int LED[4] = {2, 3, 4, 5};   // worth 1, 2, 4 and 8

void setup() {
  for (int i = 0; i < 4; i++) {
    pinMode(LED[i], OUTPUT);
  }
}

void loop() {
  for (int n = 0; n < 16; n++) {
    for (int b = 0; b < 4; b++) {
      digitalWrite(LED[b], bitRead(n, b));   // bit b of the number n
    }
    delay(500);
  }
}
`,
    solutionWires: [
      ['uno:GND1', 'rail:N0'],
      ['bit0:GND', 'rail:N2'],
      ['bit0:SIG', 'uno:D2'],
      ['bit1:GND', 'rail:N6'],
      ['bit1:SIG', 'uno:D3'],
      ['bit2:GND', 'rail:N10'],
      ['bit2:SIG', 'uno:D4'],
      ['bit3:GND', 'rail:N14'],
      ['bit3:SIG', 'uno:D5'],
    ],
    hints: [
      '5 in binary is 0101: the 4 light and the 1 light are on (4 + 1 = 5).',
      'bitRead(n, 2) tells you if the "4" light should be on for the number n.',
      'A for loop over b = 0, 1, 2, 3 can set all four lights in one go.',
    ],
    objectives: [
      { text: 'Count up: 0, 1, 2, 3, 4, 5', check: (c) => hasRun(seq(c, binaryValue(c)), [0, 1, 2, 3, 4, 5]) },
      { text: 'All the way to 15 (all four lights on)', check: (c) => hasRun(seq(c, binaryValue(c)), [10, 11, 12, 13, 14, 15]) },
      { text: 'Then start again at 0', check: (c) => hasRun(seq(c, binaryValue(c)), [15, 0]) },
    ],
  },
  {
    id: 'catchThief',
    title: 'Catch the Thief',
    emoji: '🦹',
    course: ['L1S7'],
    story: 'Someone keeps sneaking into the lab at night to steal gadgets! A PIR motion sensor feels the warmth of a moving body. Sound a siren and flash the alarm lamp to scare the thief away.',
    steps: [
      'Motion sensor: G → GND1, O → pin 2, V → 5V.',
      'Alarm lamp: G → GND2, S → pin 13.',
      'Siren (buzzer): G → GND3, S → pin 8.',
      'When the sensor reads HIGH: flash the lamp and play a high-low siren.',
    ],
    devices: ['thiefSensor', 'alarmLamp', 'labAlarm'],
    controls: ['thief'],
    view: DOOR_VIEW,
    starterCode: `// Catch the thief: motion sensor + lamp + siren.

const int PIR = 2;      // HIGH when something warm moves
const int LAMP = 13;
const int SIREN = 8;

void setup() {
  pinMode(PIR, INPUT);
  pinMode(LAMP, OUTPUT);
}

void loop() {
  if (digitalRead(PIR) == HIGH) {
    digitalWrite(LAMP, HIGH);   // TODO: flash the lamp and play a siren
  } else {
    digitalWrite(LAMP, LOW);
  }
}
`,
    solutionCode: `// Catch the thief: motion sensor + lamp + siren.

const int PIR = 2;      // HIGH when something warm moves
const int LAMP = 13;
const int SIREN = 8;

void setup() {
  pinMode(PIR, INPUT);
  pinMode(LAMP, OUTPUT);
}

void loop() {
  if (digitalRead(PIR) == HIGH) {     // someone is moving in the lab!
    for (int i = 0; i < 5; i++) {     // siren: high-low, with a flashing lamp
      digitalWrite(LAMP, HIGH);
      tone(SIREN, 1200);
      delay(250);
      digitalWrite(LAMP, LOW);
      tone(SIREN, 800);
      delay(250);
    }
  } else {
    noTone(SIREN);
    digitalWrite(LAMP, LOW);
  }
}
`,
    solutionWires: [
      ['thiefSensor:GND', 'uno:GND1'],
      ['thiefSensor:OUT', 'uno:D2'],
      ['thiefSensor:VCC', 'uno:5V'],
      ['alarmLamp:GND', 'uno:GND2'],
      ['alarmLamp:SIG', 'uno:D13'],
      ['labAlarm:GND', 'uno:GND3'],
      ['labAlarm:SIG', 'uno:D8'],
    ],
    hints: [
      'A PIR sensor is passive: it does not send anything out, it only feels infrared heat from bodies.',
      'A siren is just two tones taking turns: tone(SIREN, 1200), wait, tone(SIREN, 800), wait.',
      'Flash the lamp at the same time: HIGH with the high tone, LOW with the low tone.',
    ],
    objectives: [
      { text: 'Quiet while the lab is empty', check: (c) => c.held(c.world.thief === 'away' && c.dev('labAlarm').freq === 0 && c.dev('alarmLamp').brightness < 0.1, 2) },
      { text: 'Siren and flashing lamp when the thief sneaks in', check: (c) => c.world.thief !== 'away' && c.dev('labAlarm').freq > 0 && c.count(c.dev('alarmLamp').brightness > 0.5) >= 2 },
      { text: 'The thief runs away scared', check: (c) => c.world.scared >= 1 && c.world.thefts === 0 },
    ],
  },
  {
    id: 'clapLights',
    title: 'Clap Lights',
    emoji: '👏',
    course: ['L2S10'],
    story: 'Inventors have messy hands. Make the lab lights switch on with a clap - and off with the next clap. The sound sensor works like an ear: a microphone, a peak detector and an amplifier.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'Sound sensor: V → + rail, G → - rail, D → pin 2 (HIGH on a loud sound).',
      'Lights relay: G → - rail, V → + rail, I → pin 7.',
      'Each clap flips the lights. Remember them in a bool variable.',
    ],
    devices: ['clapSensor', 'labLights'],
    controls: ['clap', 'talk'],
    view: DOOR_VIEW,
    starterCode: `// Clap lights: one clap = on, next clap = off.

const int MIC = 2;      // DO: HIGH on a loud sound
const int LIGHTS = 7;   // relay for the lab lights

void setup() {
  pinMode(MIC, INPUT);
  pinMode(LIGHTS, OUTPUT);
}

void loop() {
  // This only lights up while the clap is happening!
  // TODO: remember the lights in a variable and flip it on every clap
  digitalWrite(LIGHTS, digitalRead(MIC));
}
`,
    solutionCode: `// Clap lights: one clap = on, next clap = off.

const int MIC = 2;      // DO: HIGH on a loud sound
const int LIGHTS = 7;   // relay for the lab lights
bool on = false;        // are the lights on?

void setup() {
  pinMode(MIC, INPUT);
  pinMode(LIGHTS, OUTPUT);
}

void loop() {
  if (digitalRead(MIC) == HIGH) {   // clap!
    on = !on;                       // flip: on -> off, off -> on
    digitalWrite(LIGHTS, on);
    delay(300);                     // ignore the rest of the same clap
  }
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['clapSensor:VCC', 'rail:P3'],
      ['clapSensor:GND', 'rail:N3'],
      ['clapSensor:DO', 'uno:D2'],
      ['labLights:GND', 'rail:N8'],
      ['labLights:VCC', 'rail:P8'],
      ['labLights:IN', 'uno:D7'],
    ],
    hints: [
      'A bool variable is either true or false. on = !on flips it.',
      'One clap lasts a little while: wait a moment after flipping so you do not count it twice.',
      'The sensor has a little knob: on a real board you turn it so talking does not trigger it.',
    ],
    objectives: [
      { text: 'Clap once: the lights switch on', check: (c) => c.held(c.world.claps >= 1 && c.dev('labLights').on, 1) },
      { text: 'Clap again: the lights switch off', check: (c) => c.held(c.world.claps >= 2 && !c.dev('labLights').on, 1) },
      {
        text: 'Normal talking does not switch them',
        check: (c) => {
          if (!c.world.talking) {
            c.mem.state = c.dev('labLights').on;
            return false;
          }
          return c.held(c.dev('labLights').on === c.mem.state, 2);
        },
      },
    ],
  },
  {
    id: 'theremin',
    title: 'Hand Theremin',
    emoji: '🎵',
    course: ['L2S4'],
    story: 'A theremin is a musical instrument you play without touching it! Measure how far your hand is with the ultrasonic sensor and turn the distance into a note.',
    steps: [
      'Distance sensor: V → 5V, T → pin 6, E → pin 7, G → GND1.',
      'Speaker (buzzer): G → GND2, S → pin 8.',
      'Close hand = high note, far hand = low note, no hand = silence. map() does the maths.',
      'Run it and move the hand slider.',
    ],
    devices: ['handSensor', 'theremin'],
    controls: ['hand'],
    setup: { values: { hand: 100 } },
    view: { position: [3.4, 2.6, 4.4] as [number, number, number], target: [3.4, 1.0, 1.4] as [number, number, number] },
    starterCode: `// Hand theremin: the distance of your hand picks the note.

const int TRIG = 6;
const int ECHO = 7;
const int SPEAKER = 8;

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  if (us == 0) return 999;   // nothing there
  return us / 58;
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  long cm = readCm();
  if (cm > 60) {
    noTone(SPEAKER);           // no hand: silence
  } else {
    tone(SPEAKER, 1000);       // TODO: use map() so close = high, far = low
  }
  delay(50);
}
`,
    solutionCode: `// Hand theremin: the distance of your hand picks the note.

const int TRIG = 6;
const int ECHO = 7;
const int SPEAKER = 8;

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  if (us == 0) return 999;   // nothing there
  return us / 58;
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  long cm = readCm();
  if (cm > 60) {
    noTone(SPEAKER);                          // no hand: silence
  } else {
    int note = map(cm, 5, 60, 2000, 200);     // 5 cm -> 2000 Hz, 60 cm -> 200 Hz
    tone(SPEAKER, note);
  }
  delay(50);
}
`,
    solutionWires: [
      ['handSensor:VCC', 'uno:5V'],
      ['handSensor:TRIG', 'uno:D6'],
      ['handSensor:ECHO', 'uno:D7'],
      ['handSensor:GND', 'uno:GND1'],
      ['theremin:GND', 'uno:GND2'],
      ['theremin:SIG', 'uno:D8'],
    ],
    hints: [
      'distance = (speed of sound x time) / 2, because the sound goes there AND back. That is where the 58 comes from.',
      'map(cm, 5, 60, 2000, 200): the first range goes up while the second goes down, so closer means higher.',
      'Sound is a vibration: 200 Hz shakes 200 times a second (low), 2000 Hz shakes 2000 times (high).',
    ],
    objectives: [
      { text: 'No hand: silence', check: (c) => c.held((c.world.values.hand ?? 100) >= 95 && c.dev('theremin').freq === 0, 1) },
      { text: 'Hand close: a high note', check: (c) => c.held((c.world.values.hand ?? 100) < 15 && c.dev('theremin').freq > 1200, 0.5) },
      { text: 'Hand far: a low note', check: (c) => c.held((c.world.values.hand ?? 100) >= 40 && (c.world.values.hand ?? 100) <= 60 && c.dev('theremin').freq > 0 && c.dev('theremin').freq < 700, 0.5) },
    ],
  },
  {
    id: 'robotArm',
    title: 'Robot Arm',
    emoji: '🦾',
    course: ['L1S12'],
    story: 'The lab robot arm moves boxes from one table to the other. If it swings too fast, the box flies off! Write a moveTo() function that turns the servo slowly, one degree at a time.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'Arm servo: G → - rail, V → + rail, S → pin 9.',
      'Arm button: G → - rail, V → + rail, S → pin 2.',
      'On a button press: moveTo(0) to pick up, moveTo(180) to drop off, moveTo(90) to go home.',
    ],
    devices: ['armServo', 'armButton'],
    controls: [],
    view: { position: [-1.2, 3.3, 5.2] as [number, number, number], target: [-0.6, 1.0, 0.2] as [number, number, number] },
    starterCode: `// Robot arm: carry the box from one table to the other.
#include <Servo.h>

Servo arm;
const int BUTTON = 2;

void setup() {
  pinMode(BUTTON, INPUT);
  arm.attach(9);
  arm.write(90);           // home position
}

void loop() {
  if (digitalRead(BUTTON) == HIGH) {
    arm.write(0);          // pick up... far too fast!
    delay(1000);
    arm.write(180);        // the box flies off!
    delay(1000);
    arm.write(90);
  }
  // TODO: write a function moveTo(target) that moves one degree
  //       at a time with a short delay, and use it instead
}
`,
    solutionCode: `// Robot arm: carry the box from one table to the other.
#include <Servo.h>

Servo arm;
const int BUTTON = 2;
int angle = 90;            // where the arm is now

// Move slowly to the target angle, one degree at a time
void moveTo(int target) {
  while (angle != target) {
    if (angle < target) {
      angle++;
    } else {
      angle--;
    }
    arm.write(angle);
    delay(15);
  }
}

void setup() {
  pinMode(BUTTON, INPUT);
  arm.attach(9);
  arm.write(angle);        // home position
}

void loop() {
  if (digitalRead(BUTTON) == HIGH) {
    moveTo(0);             // pick up the box
    delay(500);
    moveTo(180);           // carry it to the other table
    delay(500);
    moveTo(90);            // back home
  }
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['armServo:GND', 'rail:N3'],
      ['armServo:VCC', 'rail:P3'],
      ['armServo:SIG', 'uno:D9'],
      ['armButton:GND', 'rail:N9'],
      ['armButton:VCC', 'rail:P9'],
      ['armButton:SIG', 'uno:D2'],
    ],
    hints: [
      'A function is a named block of code. Write it once, then call moveTo(0), moveTo(180), moveTo(90).',
      'Inside moveTo, a while loop runs until angle equals target, changing angle by 1 each time.',
      'delay(15) after every degree makes 180 degrees take almost 3 seconds: nice and gentle.',
    ],
    objectives: [
      { text: 'The arm waits at home (90°)', check: (c) => c.held(Math.abs(c.dev('armServo').angle - 90) < 5, 1.5) },
      { text: 'Press the button: it picks up the box', check: (c) => c.world.box === 'carried' },
      { text: 'It carries the box gently to the other table', check: (c) => c.world.delivered >= 1 && c.world.drops === 0 },
      { text: 'Then it goes home again', check: (c) => c.held(c.world.delivered >= 1 && Math.abs(c.dev('armServo').angle - 90) < 5, 1) },
    ],
  },
  {
    id: 'vault',
    title: 'Keypad Vault',
    emoji: '🔐',
    course: ['L2S9', 'L1S12'],
    story: 'The lab inventions are kept in a vault. Build its lock: a 4x4 keypad to type the code, a screen that shows * for each digit, and a servo that slides the bolt. The code is 1234 and # means "enter".',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'Keypad: R1-R4 → pins 9, 8, 7, 6 and C1-C4 → pins 5, 4, 3, 2.',
      'I2C screen: G → - rail, V → + rail, SDA → A4, SCL → A5.',
      'Lock servo: G → - rail, V → + rail, S → pin 10. 0° = locked, 90° = open.',
      'Type with the keypad below the world: digits, then # to enter, * to start again.',
    ],
    devices: ['keypad', 'doorScreen', 'vaultLock'],
    controls: ['keypad'],
    view: VAULT_VIEW,
    starterCode: `// Keypad vault: type the code, # to enter.
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

${KEYPAD_SETUP}
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo lock;

String secret = "1234";
String typed = "";

void setup() {
  lcd.init();
  lcd.backlight();
  lock.attach(10);
  lock.write(0);           // 0 = locked
  lcd.print("Enter code:");
  lcd.setCursor(0, 1);
}

void loop() {
  char key = keypad.getKey();
  if (!key) return;        // no key pressed

  if (key == '#') {
    // TODO: if typed == secret: show "Open!" and unlock (90) for 3 seconds
    //       otherwise show "Wrong code!"
    typed = "";
  } else {
    typed += key;
    lcd.print(key);        // TODO: show * instead, so nobody can peek
  }
}
`,
    solutionCode: `// Keypad vault: type the code, # to enter.
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

${KEYPAD_SETUP}
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo lock;

String secret = "1234";
String typed = "";

void showPrompt() {
  lcd.clear();
  lcd.print("Enter code:");
  lcd.setCursor(0, 1);
}

void setup() {
  lcd.init();
  lcd.backlight();
  lock.attach(10);
  lock.write(0);           // 0 = locked
  showPrompt();
}

void loop() {
  char key = keypad.getKey();
  if (!key) return;        // no key pressed

  if (key == '#') {        // # = enter
    lcd.clear();
    if (typed == secret) {
      lcd.print("Open! Welcome");
      lock.write(90);      // slide the bolt open
      delay(3000);
      lock.write(0);       // and lock again
    } else {
      lcd.print("Wrong code!");
      delay(1500);
    }
    typed = "";
    showPrompt();
  } else if (key == '*') { // * = start again
    typed = "";
    showPrompt();
  } else {
    typed += key;
    lcd.print('*');        // hide the digits
  }
}
`,
    solutionWires: VAULT_WIRES,
    hints: [
      'keypad.getKey() returns the key that was just pressed, or 0 if none. if (!key) return; skips the rest.',
      'Strings can be glued together: typed += key adds one more character.',
      'Compare Strings with ==, then clear typed so the next try starts fresh.',
    ],
    objectives: [
      { text: 'The screen asks for the code', check: (c) => c.held(!!c.dev('doorScreen').display?.backlight && lcdRow(c, 'doorScreen', 0).trim().length > 0, 0.5) },
      { text: 'Typed digits show as * (no peeking!)', check: (c) => c.world.typed.length > 0 && lcdRow(c, 'doorScreen', 1).includes('*') && !/\d/.test(lcdRow(c, 'doorScreen', 1)) },
      { text: 'A wrong code keeps the vault locked', check: (c) => c.world.entries >= 1 && c.world.lastEntry !== '1234' && c.world.sinceEntry > 1 && c.dev('vaultLock').angle < 20 },
      { text: 'The right code opens it', check: (c) => c.world.lastEntry === '1234' && c.dev('vaultLock').angle > 70 },
    ],
  },
  {
    id: 'rememberCode',
    title: 'A Code That Remembers',
    emoji: '💾',
    course: ['L3S5'],
    story: 'Let the inventors change the vault code: press A, type 4 new digits and #. But variables forget everything when the power goes off! Store the code in EEPROM, the memory that survives a power cut.',
    steps: [
      'Same wiring as the Keypad Vault (keypad, I2C screen, lock servo on pin 10).',
      'Open the vault with 1234. Then press A, type a new code, and #.',
      'Press ⚡ Power off & on. Does your new code still work?',
      'Save the code with EEPROM.update() and read it back in setup() with EEPROM.read().',
    ],
    devices: ['keypad', 'doorScreen', 'vaultLock'],
    controls: ['keypad', 'power'],
    view: VAULT_VIEW,
    starterCode: `// A code that remembers: change it with A, keep it in EEPROM.
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>
#include <EEPROM.h>

${KEYPAD_SETUP}
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo lock;

String secret = "1234";    // TODO: load it from EEPROM in setup()
String typed = "";
bool changing = false;     // true after pressing A

void showPrompt() {
  lcd.clear();
  lcd.print(changing ? "New code:" : "Enter code:");
  lcd.setCursor(0, 1);
}

void setup() {
  lcd.init();
  lcd.backlight();
  lock.attach(10);
  lock.write(0);
  showPrompt();
}

void loop() {
  char key = keypad.getKey();
  if (!key) return;

  if (key == 'A') {                    // A = change the code
    changing = true;
    typed = "";
    showPrompt();
  } else if (key == '#') {
    lcd.clear();
    if (changing) {
      if (typed.length() == 4) {
        secret = typed;                // TODO: also save it in EEPROM!
        lcd.print("Code saved!");
      }
      changing = false;
    } else if (typed == secret) {
      lcd.print("Open! Welcome");
      lock.write(90);
      delay(3000);
      lock.write(0);
    } else {
      lcd.print("Wrong code!");
    }
    delay(1500);
    typed = "";
    showPrompt();
  } else if (key == '*') {
    typed = "";
    showPrompt();
  } else {
    typed += key;
    lcd.print('*');
  }
}
`,
    solutionCode: `// A code that remembers: change it with A, keep it in EEPROM.
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>
#include <EEPROM.h>

${KEYPAD_SETUP}
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo lock;

String secret;
String typed = "";
bool changing = false;     // true after pressing A

// EEPROM keeps its bytes when the power is off. A brand new chip holds 255 everywhere.
void loadCode() {
  if (EEPROM.read(0) == 255) {
    secret = "1234";       // nothing saved yet: factory code
    return;
  }
  secret = "";
  for (int i = 0; i < 4; i++) {
    secret += (char)EEPROM.read(i);
  }
}

void saveCode(String code) {
  for (int i = 0; i < 4; i++) {
    EEPROM.update(i, code[i]);   // update only writes if the byte changed (EEPROM wears out!)
  }
}

void showPrompt() {
  lcd.clear();
  lcd.print(changing ? "New code:" : "Enter code:");
  lcd.setCursor(0, 1);
}

void setup() {
  lcd.init();
  lcd.backlight();
  lock.attach(10);
  lock.write(0);
  loadCode();
  showPrompt();
}

void loop() {
  char key = keypad.getKey();
  if (!key) return;

  if (key == 'A') {                    // A = change the code
    changing = true;
    typed = "";
    showPrompt();
  } else if (key == '#') {
    lcd.clear();
    if (changing) {
      if (typed.length() == 4) {
        secret = typed;
        saveCode(secret);
        lcd.print("Code saved!");
      }
      changing = false;
    } else if (typed == secret) {
      lcd.print("Open! Welcome");
      lock.write(90);
      delay(3000);
      lock.write(0);
    } else {
      lcd.print("Wrong code!");
    }
    delay(1500);
    typed = "";
    showPrompt();
  } else if (key == '*') {
    typed = "";
    showPrompt();
  } else {
    typed += key;
    lcd.print('*');
  }
}
`,
    solutionWires: VAULT_WIRES,
    hints: [
      'RAM (normal variables) is wiped when the power goes off. EEPROM keeps its contents for years.',
      'EEPROM.read(i) reads one byte at address i. A digit like "5" is stored as its ASCII code (53).',
      'A new EEPROM is full of 255s. Use that to know if a code was ever saved.',
    ],
    objectives: [
      { text: 'Open the vault with the factory code 1234', check: (c) => c.world.lastEntry === '1234' && c.dev('vaultLock').angle > 70 },
      { text: 'Change the code: A, four new digits, #', check: (c) => c.world.newCode.length === 4 && c.world.newCode !== '1234' },
      { text: 'Switch the power off and on (⚡)', check: (c) => c.world.powerCycles >= 1 },
      { text: 'The NEW code still opens the vault', check: (c) => c.world.powerCycles >= 1 && c.world.lastEntry === c.world.newCode && c.dev('vaultLock').angle > 70 },
    ],
  },
  {
    id: 'securityCamera',
    title: 'Security Camera',
    emoji: '🎥',
    course: ['L3S7'],
    story: 'The lab camera sits on a pan-tilt bracket made of two servos. Steer it with a joystick: left and right turn it, up and down tilt it, and pushing the stick makes it look straight ahead.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'Joystick: G → - rail, + → + rail, X → A0, Y → A1, SW → pin 2.',
      'Pan servo: G → - rail, V → + rail, S → pin 9. Tilt servo: same, S → pin 10.',
      'map(analogRead(A0), 0, 1023, 0, 180) turns the stick into an angle. SW needs INPUT_PULLUP!',
    ],
    devices: ['stick', 'camPan', 'camTilt'],
    controls: ['stick'],
    view: { position: [-2.4, 3.2, 4.4] as [number, number, number], target: [-3.6, 2.3, -1.6] as [number, number, number] },
    starterCode: `// Security camera: steer two servos with a joystick.
#include <Servo.h>

Servo pan;     // left / right
Servo tilt;    // up / down

void setup() {
  pinMode(2, INPUT_PULLUP);   // the stick's button: LOW when pushed
  pan.attach(9);
  tilt.attach(10);
}

void loop() {
  int x = analogRead(A0);     // 0 (left) .. 1023 (right)
  pan.write(map(x, 0, 1023, 0, 180));
  // TODO: tilt with A1
  // TODO: when the button reads LOW, look straight ahead (90, 90)
  delay(15);
}
`,
    solutionCode: `// Security camera: steer two servos with a joystick.
#include <Servo.h>

Servo pan;     // left / right
Servo tilt;    // up / down

void setup() {
  pinMode(2, INPUT_PULLUP);   // the stick's button: LOW when pushed
  pan.attach(9);
  tilt.attach(10);
}

void loop() {
  if (digitalRead(2) == LOW) {          // stick pushed: look straight ahead
    pan.write(90);
    tilt.write(90);
  } else {
    int x = analogRead(A0);             // 0 (left) .. 1023 (right)
    int y = analogRead(A1);             // 0 (down) .. 1023 (up)
    pan.write(map(x, 0, 1023, 0, 180));
    tilt.write(map(y, 0, 1023, 0, 180));
  }
  delay(15);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['stick:GND', 'rail:N2'],
      ['stick:VCC', 'rail:P2'],
      ['stick:VRx', 'uno:A0'],
      ['stick:VRy', 'uno:A1'],
      ['stick:SW', 'uno:D2'],
      ['camPan:GND', 'rail:N7'],
      ['camPan:VCC', 'rail:P7'],
      ['camPan:SIG', 'uno:D9'],
      ['camTilt:GND', 'rail:N12'],
      ['camTilt:VCC', 'rail:P12'],
      ['camTilt:SIG', 'uno:D10'],
    ],
    hints: [
      'A joystick is two knobs at right angles: X and Y each give 0 to 1023, with about 512 in the middle.',
      'The SW button connects to GND when pushed. INPUT_PULLUP keeps the pin HIGH the rest of the time.',
      'Drag the round pad under the world to move the stick. "Push" presses its button.',
    ],
    objectives: [
      { text: 'Stick right: the camera turns right', check: (c) => c.held((c.world.values['stick.x'] ?? 0.5) > 0.8 && c.dev('camPan').angle > 140, 0.5) },
      { text: 'Stick left: the camera turns left', check: (c) => c.held((c.world.values['stick.x'] ?? 0.5) < 0.2 && c.dev('camPan').angle < 40, 0.5) },
      { text: 'Stick up: the camera tilts up', check: (c) => c.held((c.world.values['stick.y'] ?? 0.5) > 0.8 && c.dev('camTilt').angle > 140, 0.5) },
      {
        text: 'Push the stick: look straight ahead',
        check: (c) => c.held(!!c.world.pressed.stick && (c.world.values['stick.x'] ?? 0.5) > 0.8 && Math.abs(c.dev('camPan').angle - 90) < 8 && Math.abs(c.dev('camTilt').angle - 90) < 8, 0.5),
      },
    ],
  },
  {
    id: 'walkieTalkie',
    title: 'Lab Walkie-Talkie (UART)',
    emoji: '📡',
    course: ['L3S1'],
    boards: 2,
    story: 'Two Arduinos, two jobs. Arduino A measures how close a hand is and SENDS the distance over a wire. Arduino B LISTENS and switches on the alarm lamp when something comes too close. They must agree on how fast to talk: the baud rate.',
    steps: [
      'Arduino A - distance sensor: V → 5V, T → pin 6, E → pin 7, G → GND.',
      'The link: A\'s TX (pin 1) → B\'s RX (pin 0), and A\'s GND → B\'s GND (a shared ground!).',
      'Arduino B - alarm lamp: S → pin 13, G → GND.',
      'Run it. Does B understand A? Check B\'s Serial Monitor and the baud rates in both programs.',
    ],
    devices: ['handSensor', 'alarmLamp'],
    controls: ['hand'],
    setup: { values: { hand: 100 } },
    view: { position: [3.4, 3.2, 6.4] as [number, number, number], target: [3.8, 1.4, 0.6] as [number, number, number] },
    starterCode: `// Arduino A: measure the hand distance and SEND it to Arduino B.

const int TRIG = 6;
const int ECHO = 7;

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  if (us == 0) return 999;   // nothing there
  return us / 58;
}

void setup() {
  Serial.begin(9600);        // talk at 9600 baud (bits per second)
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  long cm = readCm();
  Serial.println(cm);        // goes out of TX (pin 1) to Arduino B
  delay(200);
}
`,
    starterCode2: `// Arduino B: LISTEN to Arduino A and switch on the alarm lamp when something is close.

const int LAMP = 13;

void setup() {
  Serial.begin(4800);        // hmm... is this the same speed as Arduino A?
  pinMode(LAMP, OUTPUT);
}

void loop() {
  if (Serial.available() > 0) {
    long cm = Serial.parseInt();   // read the number Arduino A sent
    Serial.print("Got: ");
    Serial.println(cm);
    // TODO: lamp ON when cm is less than 30, OFF otherwise
  }
}
`,
    solutionCode: `// Arduino A: measure the hand distance and SEND it to Arduino B.

const int TRIG = 6;
const int ECHO = 7;

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  if (us == 0) return 999;   // nothing there
  return us / 58;
}

void setup() {
  Serial.begin(9600);        // talk at 9600 baud (bits per second)
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  long cm = readCm();
  Serial.println(cm);        // goes out of TX (pin 1) to Arduino B
  delay(200);
}
`,
    solutionCode2: `// Arduino B: LISTEN to Arduino A and switch on the alarm lamp when something is close.

const int LAMP = 13;

void setup() {
  Serial.begin(9600);        // the SAME speed as Arduino A
  pinMode(LAMP, OUTPUT);
}

void loop() {
  if (Serial.available() > 0) {
    long cm = Serial.parseInt();   // read the number Arduino A sent
    if (cm > 0) {
      Serial.print("Got: ");
      Serial.println(cm);
      if (cm < 30) {
        digitalWrite(LAMP, HIGH);  // too close: alarm!
      } else {
        digitalWrite(LAMP, LOW);
      }
    }
  }
}
`,
    solutionWires: [
      ['handSensor:VCC', 'uno:5V'],
      ['handSensor:TRIG', 'uno:D6'],
      ['handSensor:ECHO', 'uno:D7'],
      ['handSensor:GND', 'uno:GND1'],
      ['uno:D1', 'uno2:D0'],
      ['uno:GND2', 'uno2:GND1'],
      ['alarmLamp:SIG', 'uno2:D13'],
      ['alarmLamp:GND', 'uno2:GND2'],
    ],
    hints: [
      'UART has no shared clock: both sides just agree in advance how many bits per second to send. That number is the baud rate.',
      'If the baud rates are different, Arduino B reads the bits at the wrong moments and gets gibberish. Look at Serial.begin() in both programs!',
      'TX (transmit) of one board always goes to RX (receive) of the other. And the grounds must be connected, so both boards agree what 0 volts is.',
    ],
    objectives: [
      { text: 'Both Arduinos talk at the same speed (baud rate)', check: (c) => c.world.link.cleanStreak >= 20 },
      { text: 'Hand close (under 30 cm): Arduino B lights the lamp', check: (c) => c.held((c.world.values.hand ?? 100) < 30 && c.dev('alarmLamp').brightness > 0.5, 0.5) },
      { text: 'Hand away: the lamp goes off', check: (c) => c.held((c.world.values.hand ?? 100) > 50 && c.dev('alarmLamp').brightness < 0.1, 1) },
    ],
  },
  {
    id: 'secretWire',
    title: 'Secret Wire (SPI)',
    emoji: '🔌',
    course: ['L3S3'],
    boards: 2,
    story: 'Arduino A has the keypad, Arduino B has the screen. Connect them with SPI: a clock wire that says "read the bit NOW", a data wire, and a select wire that says "I am talking to you". You will send every bit by hand!',
    steps: [
      'Arduino A (master) - keypad: R1-R4 → pins 9, 8, 7, 6 and C1-C4 → pins 5, 4, 3, 2.',
      'Arduino B (slave) - I2C screen: G → GND, V → 5V, SDA → A4, SCL → A5.',
      'The SPI wires, A → B: pin 10 → pin 10 (SS, select), 11 → 11 (MOSI, data), 12 → 12 (SCK, clock), and GND → GND.',
      'The slave program is ready. Finish sendByte() on the master: set the data bit, then tick the clock.',
      'Type on the keypad below the world and watch the slave\'s screen.',
    ],
    devices: ['keypad', 'doorScreen'],
    controls: ['keypad'],
    view: { position: [1.6, 2.8, 4.6] as [number, number, number], target: [1.2, 1.4, -2.6] as [number, number, number] },
    starterCode: `// Arduino A (MASTER): read the keypad and send each key over SPI, one bit at a time.
#include <Keypad.h>

${KEYPAD_SETUP}

const int SS_PIN = 10;     // Slave Select: "it is you I am talking to"
const int MOSI_PIN = 11;   // Master Out, Slave In: the data
const int SCK_PIN = 12;    // the clock: "read the bit now!"

void sendByte(byte b) {
  digitalWrite(SS_PIN, LOW);              // wake up the slave
  for (int i = 7; i >= 0; i--) {          // the biggest bit first
    digitalWrite(MOSI_PIN, bitRead(b, i));
    // TODO: tick the clock: wait 100 us, SCK HIGH, wait 100 us, SCK LOW
  }
  digitalWrite(SS_PIN, HIGH);             // done talking
}

void setup() {
  pinMode(SS_PIN, OUTPUT);
  pinMode(MOSI_PIN, OUTPUT);
  pinMode(SCK_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  digitalWrite(SCK_PIN, LOW);
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    sendByte(key);
  }
}
`,
    starterCode2: SLAVE_CODE,
    solutionCode: `// Arduino A (MASTER): read the keypad and send each key over SPI, one bit at a time.
#include <Keypad.h>

${KEYPAD_SETUP}

const int SS_PIN = 10;     // Slave Select: "it is you I am talking to"
const int MOSI_PIN = 11;   // Master Out, Slave In: the data
const int SCK_PIN = 12;    // the clock: "read the bit now!"

void sendByte(byte b) {
  digitalWrite(SS_PIN, LOW);              // wake up the slave
  for (int i = 7; i >= 0; i--) {          // the biggest bit first
    digitalWrite(MOSI_PIN, bitRead(b, i));
    delayMicroseconds(100);
    digitalWrite(SCK_PIN, HIGH);          // tick: the slave reads the bit now
    delayMicroseconds(100);
    digitalWrite(SCK_PIN, LOW);
  }
  digitalWrite(SS_PIN, HIGH);             // done talking
}

void setup() {
  pinMode(SS_PIN, OUTPUT);
  pinMode(MOSI_PIN, OUTPUT);
  pinMode(SCK_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  digitalWrite(SCK_PIN, LOW);
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    sendByte(key);
  }
}
`,
    solutionCode2: SLAVE_CODE,
    solutionWires: [
      ...KEYPAD_WIRES,
      ['doorScreen:GND', 'uno2:GND1'],
      ['doorScreen:VCC', 'uno2:5V'],
      ['doorScreen:SDA', 'uno2:A4'],
      ['doorScreen:SCL', 'uno2:A5'],
      ['uno:D10', 'uno2:D10'],
      ['uno:D11', 'uno2:D11'],
      ['uno:D12', 'uno2:D12'],
      ['uno:GND1', 'uno2:GND2'],
    ],
    hints: [
      'SPI is synchronous: the master owns the clock. Every time SCK goes HIGH, the slave reads one bit from MOSI.',
      'A byte is 8 bits. The loop sends bit 7 first and bit 0 last, and the slave builds the byte in the same order.',
      'Why the delays? The slave checks the pins in a loop. Give it time to notice every tick.',
    ],
    objectives: [
      { text: 'The slave\'s screen is ready', check: (c) => c.held(lcdRow(c, 'doorScreen', 0).trim().length > 0, 0.5) },
      {
        text: 'Keys typed on the master appear on the slave\'s screen',
        check: (c) => c.world.keyLog.length >= 3 && lcdRow(c, 'doorScreen', 1).trimEnd().endsWith(c.world.keyLog.slice(-3)),
      },
    ],
  },
  {
    id: 'graduation',
    title: 'Graduation Project',
    emoji: '🎓',
    course: ['L3S8'],
    story: 'Time to graduate! Every lab gadget is on your workbench. Build your own invention: a smart office, a keypad calculator on the screen, a stopwatch, a robot that waves... You choose.',
    steps: [
      'Plan first: what should your invention do? Which gadgets does it need?',
      'Wire one gadget at a time and test it before adding the next.',
      'Present it: what does it do, and what problem did you solve on the way?',
    ],
    devices: ['thiefSensor', 'alarmLamp', 'labAlarm', 'bit0', 'bit1', 'bit2', 'bit3', 'clapSensor', 'labLights', 'handSensor', 'theremin', 'armServo', 'armButton', 'keypad', 'doorScreen', 'vaultLock', 'stick', 'camPan', 'camTilt'],
    controls: ['thief', 'clap', 'talk', 'hand', 'keypad', 'stick', 'power'],
    starterCode: `// Graduation project: your own invention!

void setup() {
  Serial.begin(9600);
}

void loop() {

}
`,
    solutionCode: `// Example: a stopwatch on the I2C screen. Press # to start and stop, * to reset.
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

${KEYPAD_SETUP}
LiquidCrystal_I2C lcd(0x27, 16, 2);

bool running = false;
unsigned long startedAt = 0;
unsigned long elapsed = 0;

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.print("Stopwatch  # / *");
}

void loop() {
  char key = keypad.getKey();
  if (key == '#') {
    if (running) {
      elapsed += millis() - startedAt;
    } else {
      startedAt = millis();
    }
    running = !running;
  } else if (key == '*') {
    running = false;
    elapsed = 0;
  }
  unsigned long ms = elapsed + (running ? millis() - startedAt : 0);
  lcd.setCursor(0, 1);
  lcd.print(ms / 1000);
  lcd.print(".");
  lcd.print((ms / 100) % 10);
  lcd.print(" s      ");
  delay(50);
}
`,
    solutionWires: [],
    hints: ['Reuse code from the earlier missions: they all work together.', 'Use the power rail when several modules need 5V.', 'Ideas from the course: a smart office, a calculator, a stopwatch.'],
    objectives: [],
  },
];
