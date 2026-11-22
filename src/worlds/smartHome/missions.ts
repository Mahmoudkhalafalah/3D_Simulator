import type { Mission } from '../types';

const RAIL_POWER: [string, string][] = [
  ['uno:5V', 'rail:P0'],
  ['uno:GND1', 'rail:N0'],
];

export const SMART_HOME_MISSIONS: Mission[] = [
  {
    id: 'blink',
    course: ['L1S2', 'L1S3'],
    title: 'Hello, Porch Light!',
    emoji: '💡',
    story: 'It is your first day as the house electrician. Make the porch light blink so the family can see their new smart home is alive!',
    steps: [
      'On the workbench, click the LED module\'s G pin, then click an Arduino GND pin.',
      'Click the LED module\'s S pin, then click Arduino pin 13.',
      'Finish the code: turn the light OFF and wait again.',
      'Press ▶ Run and watch the porch!',
    ],
    devices: ['porchLight'],
    controls: ['time'],
    setup: { hour: 20 },
    starterCode: `// Mission 1: Make the porch light blink!
// The porch light's S pin is connected to pin 13.

void setup() {
  pinMode(13, OUTPUT);      // pin 13 sends electricity OUT
}

void loop() {
  digitalWrite(13, HIGH);   // light ON
  delay(1000);              // wait 1 second (1000 milliseconds)

  // TODO: turn the light OFF with digitalWrite(13, LOW);
  // TODO: wait again with delay(1000);
}
`,
    solutionCode: `// Mission 1: Make the porch light blink!

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);   // light ON
  delay(1000);
  digitalWrite(13, LOW);    // light OFF
  delay(1000);
}
`,
    solutionWires: [
      ['porchLight:GND', 'uno:GND1'],
      ['porchLight:SIG', 'uno:D13'],
    ],
    hints: [
      'Electricity needs a loop: it leaves the Arduino through pin 13, goes through the LED and comes back through GND.',
      'Did you notice the tiny "L" light on the Arduino? It is also connected to pin 13!',
      'If the light stays on forever, your loop() never turns it off. Add digitalWrite(13, LOW); and another delay(1000);',
    ],
    objectives: [
      { text: 'Turn the porch light on', check: (c) => c.held(c.dev('porchLight').brightness > 0.5, 0.2) },
      { text: 'Make it blink 3 times', check: (c) => c.count(c.dev('porchLight').brightness > 0.5) >= 3 },
    ],
  },
  {
    id: 'doorbell',
    course: ['L1S5', 'L1S6'],
    title: 'Ding Dong!',
    emoji: '🔔',
    story: 'Visitors keep knocking because the house has no doorbell. Build one: when someone presses the button, the chime plays a "ding-dong".',
    steps: [
      'Wire the doorbell button: G → GND, V → 5V, S → pin 2.',
      'Wire the chime (buzzer): G → another GND, S → pin 8.',
      'Use tone() to play a sound when the button reads HIGH.',
      'Run it, then click the doorbell (on the house or the workbench) or send a visitor!',
    ],
    devices: ['doorbell', 'chime'],
    controls: ['visitor'],
    starterCode: `// Mission 2: Build a doorbell!
const int BUTTON_PIN = 2;   // the doorbell button
const int BUZZER_PIN = 8;   // the chime speaker

void setup() {
  pinMode(BUTTON_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    // TODO: play a "ding" with tone(BUZZER_PIN, 880);
  } else {
    noTone(BUZZER_PIN);   // be quiet
  }
}
`,
    solutionCode: `// Mission 2: Build a doorbell!
const int BUTTON_PIN = 2;
const int BUZZER_PIN = 8;

void setup() {
  pinMode(BUTTON_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    tone(BUZZER_PIN, 880);   // ding (high note)
    delay(300);
    tone(BUZZER_PIN, 660);   // dong (lower note)
    delay(500);
    noTone(BUZZER_PIN);
  }
}
`,
    solutionWires: [
      ['doorbell:GND', 'uno:GND1'],
      ['doorbell:VCC', 'uno:5V'],
      ['doorbell:SIG', 'uno:D2'],
      ['chime:GND', 'uno:GND2'],
      ['chime:SIG', 'uno:D8'],
    ],
    hints: [
      'tone(pin, frequency) plays a note. 880 is a high "ding", 660 a lower "dong".',
      'digitalRead(BUTTON_PIN) gives HIGH while the button is pressed.',
      'The Arduino has three GND pins. You can use one for each module.',
    ],
    objectives: [
      { text: 'The chime sounds when the doorbell is pressed', check: (c) => c.world.pressed.doorbell === true && c.dev('chime').freq > 0 },
      { text: 'The chime is quiet when nobody presses', check: (c) => c.held(!c.world.pressed.doorbell && c.dev('chime').freq === 0, 2) },
    ],
  },
  {
    id: 'nightlight',
    course: ['L1S4', 'L2S3'],
    title: 'Automatic Night Light',
    emoji: '🌙',
    story: 'The family always forgets to switch on the porch light at night. Use the light sensor on the roof so the light turns on by itself when it gets dark.',
    steps: [
      'Wire the light sensor: G → GND, V → 5V, A → A0.',
      'Wire the porch light: G → GND, S → pin 9.',
      'Open the Serial Monitor to see the light numbers change.',
      'Move the ☀️ time slider to night and back to day to test it.',
    ],
    devices: ['lightSensor', 'porchLight'],
    controls: ['time'],
    setup: { hour: 12 },
    starterCode: `// Mission 3: Turn on the porch light when it gets dark!
const int SENSOR_PIN = A0;   // light sensor on the roof
const int LIGHT_PIN = 9;     // porch light

void setup() {
  pinMode(LIGHT_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(SENSOR_PIN);   // 0 = very dark ... 1023 = very bright
  Serial.println(light);                // watch the numbers in the Serial Monitor!

  // TODO: if it is dark (light < 300), turn the porch light ON
  //       otherwise turn it OFF

  delay(200);
}
`,
    solutionCode: `// Mission 3: Turn on the porch light when it gets dark!
const int SENSOR_PIN = A0;
const int LIGHT_PIN = 9;

void setup() {
  pinMode(LIGHT_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(SENSOR_PIN);
  Serial.println(light);

  if (light < 300) {
    digitalWrite(LIGHT_PIN, HIGH);   // dark: light ON
  } else {
    digitalWrite(LIGHT_PIN, LOW);    // bright: light OFF
  }
  delay(200);
}
`,
    solutionWires: [
      ['lightSensor:GND', 'uno:GND1'],
      ['lightSensor:VCC', 'uno:5V'],
      ['lightSensor:AO', 'uno:A0'],
      ['porchLight:GND', 'uno:GND2'],
      ['porchLight:SIG', 'uno:D9'],
    ],
    hints: [
      'analogRead() measures a voltage and gives a number from 0 to 1023.',
      'Use if (light < 300) { ... } else { ... } to choose what to do.',
      'Press ▶ next to the time slider to watch a whole day go by.',
    ],
    objectives: [
      { text: 'The porch light is ON at night', check: (c) => c.held(c.world.daylight < 0.15 && c.dev('porchLight').brightness > 0.5, 1.5) },
      { text: 'The porch light is OFF during the day', check: (c) => c.held(c.world.daylight > 0.5 && c.dev('porchLight').brightness < 0.1, 1.5) },
    ],
  },
  {
    id: 'dimmer',
    course: ['L1S4', 'L3S4'],
    title: 'Dimmer Switch',
    emoji: '🎛️',
    story: 'Grandma says the porch light is too bright. Give her a knob to make it brighter or dimmer, just like a real dimmer switch.',
    steps: [
      'Wire the knob: G → GND, V → 5V, S → A1.',
      'Wire the porch light: G → GND, S → pin 9 (pins with ~ can dim).',
      'Read the knob with analogRead() and set the light with analogWrite().',
      'Turn the 🎛️ knob slider and watch the light change.',
    ],
    devices: ['dimmer', 'porchLight'],
    controls: ['knob', 'time'],
    setup: { hour: 21, values: { dimmer: 0.5 } },
    starterCode: `// Mission 4: Make a dimmer switch!
const int KNOB_PIN = A1;
const int LIGHT_PIN = 9;    // the ~ next to 9 means this pin can dim (PWM)

void setup() {
  pinMode(LIGHT_PIN, OUTPUT);
}

void loop() {
  int knob = analogRead(KNOB_PIN);               // 0 ... 1023
  int brightness = map(knob, 0, 1023, 0, 255);   // turn it into 0 ... 255

  // TODO: set the light with analogWrite(LIGHT_PIN, brightness);
}
`,
    solutionCode: `// Mission 4: Make a dimmer switch!
const int KNOB_PIN = A1;
const int LIGHT_PIN = 9;

void setup() {
  pinMode(LIGHT_PIN, OUTPUT);
}

void loop() {
  int knob = analogRead(KNOB_PIN);
  int brightness = map(knob, 0, 1023, 0, 255);
  analogWrite(LIGHT_PIN, brightness);
}
`,
    solutionWires: [
      ['dimmer:GND', 'uno:GND1'],
      ['dimmer:VCC', 'uno:5V'],
      ['dimmer:SIG', 'uno:A1'],
      ['porchLight:GND', 'uno:GND2'],
      ['porchLight:SIG', 'uno:D9'],
    ],
    hints: [
      'analogWrite(pin, 0) is off, 127 is half, 255 is full brightness.',
      'Only pins marked with ~ (3, 5, 6, 9, 10, 11) can dim. On other pins the light is just on or off.',
      'map(value, 0, 1023, 0, 255) squeezes the knob number into the brightness range.',
    ],
    objectives: [
      { text: 'Knob in the middle: light is half bright', check: (c) => c.held(Math.abs(c.world.values.dimmer - 0.5) < 0.15 && Math.abs(c.dev('porchLight').brightness - c.world.values.dimmer) < 0.12, 1) },
      { text: 'Knob all the way up: full brightness', check: (c) => c.held(c.world.values.dimmer > 0.9 && c.dev('porchLight').brightness > 0.85, 1) },
      { text: 'Knob all the way down: light off', check: (c) => c.held(c.world.values.dimmer < 0.05 && c.dev('porchLight').brightness < 0.06, 1) },
    ],
  },
  {
    id: 'welcome',
    course: ['L1S7', 'L1S12'],
    title: 'Welcome Home',
    emoji: '🚪',
    story: 'The family\'s hands are always full of shopping bags. Make the front door open by itself when someone walks up, and close again after they come in.',
    steps: [
      'Two modules need 5V, but the Arduino has only one 5V pin. Use the power rail: Arduino 5V → red + rail, Arduino GND → blue - rail.',
      'Motion sensor: G → - rail, V → + rail, O → pin 3.',
      'Door servo: G → - rail, V → + rail, S → pin 9.',
      'Press 🚶 Send a visitor and see if they can get in!',
    ],
    devices: ['motion', 'door'],
    controls: ['visitor'],
    starterCode: `// Mission 5: Open the door when someone arrives!
#include <Servo.h>

const int MOTION_PIN = 3;
const int DOOR_PIN = 9;
Servo door;

void setup() {
  pinMode(MOTION_PIN, INPUT);
  door.attach(DOOR_PIN);
  door.write(0);              // 0 degrees = door closed
}

void loop() {
  if (digitalRead(MOTION_PIN) == HIGH) {
    // TODO: someone is here! Open the door with door.write(90);
  } else {
    // TODO: nobody is here. Close the door.
  }
  delay(50);
}
`,
    solutionCode: `// Mission 5: Open the door when someone arrives!
#include <Servo.h>

const int MOTION_PIN = 3;
const int DOOR_PIN = 9;
Servo door;

void setup() {
  pinMode(MOTION_PIN, INPUT);
  door.attach(DOOR_PIN);
  door.write(0);
}

void loop() {
  if (digitalRead(MOTION_PIN) == HIGH) {
    door.write(90);   // open
  } else {
    door.write(0);    // close
  }
  delay(50);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['motion:GND', 'rail:N4'],
      ['motion:VCC', 'rail:P4'],
      ['motion:OUT', 'uno:D3'],
      ['door:GND', 'rail:N10'],
      ['door:VCC', 'rail:P10'],
      ['door:SIG', 'uno:D9'],
    ],
    hints: [
      'All the holes in a rail row are connected inside, like one long wire.',
      'A servo turns to the angle you write: door.write(90) means 90 degrees.',
      'The motion sensor stays HIGH for 2 seconds after it last saw someone.',
    ],
    objectives: [
      { text: 'The door opens when a visitor arrives', check: (c) => c.dev('motion').on && c.dev('door').angle > 70 },
      { text: 'The visitor walks into the house', check: (c) => c.world.visitor === 'inside' },
      { text: 'The door closes again behind them', check: (c) => c.held(c.dev('door').angle < 10 && (c.world.visitor === 'inside' || c.world.visitor === 'away'), 0.5) },
    ],
  },
  {
    id: 'fan',
    course: ['L1S7', 'L1S10'],
    title: 'Cool Breeze',
    emoji: '🌀',
    story: 'Summer is coming and the living room gets too hot. Use the temperature sensor to switch on the fan when it is warmer than 28 °C.',
    steps: [
      'Power the rails: Arduino 5V → red + rail, GND → blue - rail.',
      'Temperature sensor: G → - rail, V → + rail, O → A2.',
      'Fan motor driver: G → - rail, V → + rail, I → pin 5.',
      'Move the 🌡️ temperature slider to test it.',
    ],
    devices: ['thermo', 'fan'],
    controls: ['temperature'],
    setup: { temperature: 22 },
    starterCode: `// Mission 6: Turn on the fan when the room gets hot!
const int TEMP_PIN = A2;
const int FAN_PIN = 5;

void setup() {
  pinMode(FAN_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(TEMP_PIN);
  float celsius = reading * 500.0 / 1023.0;   // LM35 sensor: 10 mV for every degree
  Serial.print("Temperature: ");
  Serial.println(celsius);

  // TODO: if celsius > 28, turn the fan ON (HIGH)
  //       otherwise turn it OFF (LOW)

  delay(500);
}
`,
    solutionCode: `// Mission 6: Turn on the fan when the room gets hot!
const int TEMP_PIN = A2;
const int FAN_PIN = 5;

void setup() {
  pinMode(FAN_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(TEMP_PIN);
  float celsius = reading * 500.0 / 1023.0;
  Serial.print("Temperature: ");
  Serial.println(celsius);

  if (celsius > 28) {
    digitalWrite(FAN_PIN, HIGH);
  } else {
    digitalWrite(FAN_PIN, LOW);
  }
  delay(500);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['thermo:GND', 'rail:N4'],
      ['thermo:VCC', 'rail:P4'],
      ['thermo:OUT', 'uno:A2'],
      ['fan:GND', 'rail:N12'],
      ['fan:VCC', 'rail:P12'],
      ['fan:IN', 'uno:D5'],
    ],
    hints: [
      'float numbers can have decimals, like 27.5.',
      'Bonus: use analogWrite(FAN_PIN, ...) to make the fan spin faster when it is hotter!',
    ],
    objectives: [
      { text: 'The fan spins when it is hot (above 28 °C)', check: (c) => c.held(c.world.temperature > 29 && c.dev('fan').speed > 0.5, 1.5) },
      { text: 'The fan stops when it is cool again', check: (c) => c.held(c.world.temperature < 26 && c.dev('fan').speed < 0.05, 1.5) },
    ],
  },
  {
    id: 'lampswitch',
    course: ['L1S6', 'L1S10'],
    title: 'Click-Click Lamp',
    emoji: '🛋️',
    story: 'The big living-room lamp runs on mains power, which is far too strong for an Arduino. A relay is a switch the Arduino can flip safely. Make one press turn the lamp on, and the next press turn it off.',
    steps: [
      'Both modules need 5V, so power the rails first: Arduino 5V → red + rail, Arduino GND → blue - rail.',
      'Light switch: G → - rail, V → + rail, S → pin 4.',
      'Relay: G → - rail, V → + rail, I → pin 7.',
      'Remember if the lamp is on in a variable, and flip it each time the switch is pressed.',
    ],
    devices: ['lightSwitch', 'roomLamp'],
    controls: ['time'],
    setup: { hour: 21 },
    starterCode: `// Mission 7: One press = lamp ON, next press = lamp OFF
const int SWITCH_PIN = 4;
const int RELAY_PIN = 7;

bool lampOn = false;       // is the lamp on right now?
bool wasPressed = false;   // was the switch pressed last time we looked?

void setup() {
  pinMode(SWITCH_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
}

void loop() {
  bool pressed = digitalRead(SWITCH_PIN) == HIGH;

  if (pressed && !wasPressed) {
    // The switch was JUST pressed.
    // TODO: flip the lamp: lampOn = !lampOn;
  }
  wasPressed = pressed;

  digitalWrite(RELAY_PIN, lampOn ? HIGH : LOW);
  delay(20);
}
`,
    solutionCode: `// Mission 7: One press = lamp ON, next press = lamp OFF
const int SWITCH_PIN = 4;
const int RELAY_PIN = 7;

bool lampOn = false;
bool wasPressed = false;

void setup() {
  pinMode(SWITCH_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
}

void loop() {
  bool pressed = digitalRead(SWITCH_PIN) == HIGH;

  if (pressed && !wasPressed) {
    lampOn = !lampOn;   // ! means "the opposite"
  }
  wasPressed = pressed;

  digitalWrite(RELAY_PIN, lampOn ? HIGH : LOW);
  delay(20);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['lightSwitch:GND', 'rail:N4'],
      ['lightSwitch:VCC', 'rail:P4'],
      ['lightSwitch:SIG', 'uno:D4'],
      ['roomLamp:GND', 'rail:N12'],
      ['roomLamp:VCC', 'rail:P12'],
      ['roomLamp:IN', 'uno:D7'],
    ],
    hints: [
      'Listen for the "click" of the relay!',
      'If the lamp is only on while you hold the button, you need to remember the state in lampOn.',
      'lampOn = !lampOn; flips true to false and false to true.',
    ],
    objectives: [
      { text: 'Press once: the lamp turns on and stays on', check: (c) => c.held(c.dev('roomLamp').on && !c.world.pressed.lightSwitch, 1) },
      { text: 'Press again: the lamp turns off and stays off', check: (c) => c.held(!c.dev('roomLamp').on && !c.world.pressed.lightSwitch, 1) },
    ],
  },
  {
    id: 'parking',
    course: ['L1S7', 'L2S4'],
    title: 'Parking Helper',
    emoji: '🚗',
    story: 'Dad keeps bumping the car into the garage wall! Build a parking sensor that beeps when the car gets close, like the ones in real cars.',
    steps: [
      'Distance sensor: V → 5V, T → pin 12, E → pin 11, G → GND.',
      'Garage beeper: G → GND, S → pin 10.',
      'Run it and open the Serial Monitor to see the distance.',
      'Hold 🚗 Drive in and stop when it beeps! Park between 10 and 30 cm.',
    ],
    devices: ['parking', 'beeper'],
    controls: ['car'],
    setup: { carDistance: 350 },
    starterCode: `// Mission 8: Help the car park without bumping the wall!
const int TRIG_PIN = 12;
const int ECHO_PIN = 11;
const int BEEP_PIN = 10;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BEEP_PIN, OUTPUT);
  Serial.begin(9600);
}

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);                 // send a "ping!"
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long echo = pulseIn(ECHO_PIN, HIGH, 30000);   // microseconds until the echo returns
  return echo / 58;                             // turn it into centimetres (0 = nothing found)
}

void loop() {
  long cm = readDistanceCm();
  Serial.print(cm);
  Serial.println(" cm");

  // TODO: if the car is closer than 100 cm (and cm > 0), beep:
  //   tone(BEEP_PIN, 1500, 100);
  // Bonus: beep faster when the car gets closer!

  delay(200);
}
`,
    solutionCode: `// Mission 8: Help the car park without bumping the wall!
const int TRIG_PIN = 12;
const int ECHO_PIN = 11;
const int BEEP_PIN = 10;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BEEP_PIN, OUTPUT);
  Serial.begin(9600);
}

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long echo = pulseIn(ECHO_PIN, HIGH, 30000);
  return echo / 58;
}

void loop() {
  long cm = readDistanceCm();
  Serial.print(cm);
  Serial.println(" cm");

  if (cm > 0 && cm < 100) {
    tone(BEEP_PIN, 1500, 80);
    delay(cm * 4);          // closer = shorter pause = faster beeps
  } else {
    noTone(BEEP_PIN);
    delay(200);
  }
}
`,
    solutionWires: [
      ['parking:VCC', 'uno:5V'],
      ['parking:TRIG', 'uno:D12'],
      ['parking:ECHO', 'uno:D11'],
      ['parking:GND', 'uno:GND1'],
      ['beeper:GND', 'uno:GND2'],
      ['beeper:SIG', 'uno:D10'],
    ],
    hints: [
      'The sensor shouts a sound you cannot hear and times how long the echo takes to come back, like a bat.',
      'pulseIn() gives 0 when there is no echo (nothing closer than about 4 m), so check cm > 0.',
      'tone(pin, frequency, duration) plays a short beep by itself.',
    ],
    objectives: [
      { text: 'It beeps when the car is closer than 1 m', check: (c) => c.world.carDistance < 95 && c.dev('beeper').freq > 0 },
      { text: 'It stays quiet when the car is far away (over 2 m)', check: (c) => c.held(c.world.carDistance > 200 && c.dev('beeper').freq === 0, 2) },
      { text: 'Park the car 10-30 cm from the wall without bumping', check: (c) => c.held(c.world.carDistance >= 10 && c.world.carDistance <= 30 && !c.world.crashed, 1) },
    ],
  },
  {
    id: 'free',
    title: 'Free Play: Your Smart House',
    emoji: '🏠',
    story: 'You have mastered every gadget. Now invent your own smart house! Mix any modules you like. A burglar alarm? A party mode? A night-time welcome light? You decide.',
    steps: [
      'Every module in the house is on the workbench.',
      'Use the power rails to share 5V and GND between many modules.',
      'Ideas: motion sensor + chime = burglar alarm. Light sensor + door = close the door at night.',
    ],
    devices: ['porchLight', 'doorbell', 'chime', 'motion', 'door', 'lightSensor', 'roomLamp', 'lightSwitch', 'fan', 'thermo', 'dimmer', 'parking', 'beeper'],
    controls: ['time', 'temperature', 'visitor', 'knob', 'car'],
    starterCode: `// Free Play: invent your own smart house!

void setup() {
  Serial.begin(9600);
  Serial.println("Smart house ready!");
}

void loop() {

}
`,
    solutionCode: `// Free Play example: a burglar alarm that only works at night
const int MOTION_PIN = 3;
const int SENSOR_PIN = A0;
const int CHIME_PIN = 8;
const int PORCH_PIN = 9;

void setup() {
  pinMode(MOTION_PIN, INPUT);
  pinMode(CHIME_PIN, OUTPUT);
  pinMode(PORCH_PIN, OUTPUT);
}

void loop() {
  bool night = analogRead(SENSOR_PIN) < 300;
  bool someone = digitalRead(MOTION_PIN) == HIGH;

  if (night && someone) {
    digitalWrite(PORCH_PIN, HIGH);
    tone(CHIME_PIN, 1000, 150);
    delay(300);
  } else {
    digitalWrite(PORCH_PIN, LOW);
  }
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['motion:GND', 'rail:N3'],
      ['motion:VCC', 'rail:P3'],
      ['motion:OUT', 'uno:D3'],
      ['lightSensor:GND', 'rail:N8'],
      ['lightSensor:VCC', 'rail:P8'],
      ['lightSensor:AO', 'uno:A0'],
      ['chime:GND', 'rail:N13'],
      ['chime:SIG', 'uno:D8'],
      ['porchLight:GND', 'rail:N18'],
      ['porchLight:SIG', 'uno:D9'],
    ],
    hints: ['Mix and match code from the missions you finished.', 'Use the Serial Monitor to print what your sensors see.'],
    objectives: [],
  },
];
