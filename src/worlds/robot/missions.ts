// Robot Arena missions: a two-wheeled robot car, from the first wheel turn to a robot
// that finds its own way through a maze. Every robot uses the same pins, so kids learn
// one robot and keep adding to it:
//
//   left wheel  L293D  EN 5, IN1 7, IN2 8        bumper switch  2
//   right wheel L293D  EN 6, IN1 9, IN2 10       head servo     3
//   eyes (HC-SR04)     TRIG 12, ECHO 11          horn           4
//   line sensors       left A1, right A2         headlights     13
//   light sensor       A0                        joystick       X A3, Y A4, SW 2
import type { Mission } from '../types';

type W = [string, string];

// ------------------------------------------------------------------ shared wiring
const POWER: W[] = [
  ['uno:5V', 'rail:P0'],
  ['uno:GND1', 'rail:N0'],
];
const MOTOR_WIRES: W[] = [
  ['leftMotor:GND', 'rail:N3'],
  ['leftMotor:VCC', 'rail:P3'],
  ['leftMotor:EN', 'uno:D5'],
  ['leftMotor:IN1', 'uno:D7'],
  ['leftMotor:IN2', 'uno:D8'],
  ['rightMotor:GND', 'rail:N8'],
  ['rightMotor:VCC', 'rail:P8'],
  ['rightMotor:EN', 'uno:D6'],
  ['rightMotor:IN1', 'uno:D9'],
  ['rightMotor:IN2', 'uno:D10'],
];
const MOTOR_STEPS = [
  'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
  'Left wheel driver: G → - rail, V → + rail, EN → pin 5, I1 → pin 7, I2 → pin 8.',
  'Right wheel driver: G → - rail, V → + rail, EN → pin 6, I1 → pin 9, I2 → pin 10.',
];
const EYE_WIRES: W[] = [
  ['eyes:VCC', 'rail:P13'],
  ['eyes:GND', 'rail:N13'],
  ['eyes:TRIG', 'uno:D12'],
  ['eyes:ECHO', 'uno:D11'],
];
const EYE_STEP = 'Robot eyes (HC-SR04): V → + rail, G → - rail, T → pin 12, E → pin 11.';

// ------------------------------------------------------------------ shared code
const MOTOR_PINS = `const int LEFT_EN = 5;      // left wheel: speed (PWM)
const int LEFT_IN1 = 7;     // left wheel: direction
const int LEFT_IN2 = 8;
const int RIGHT_EN = 6;     // right wheel: speed (PWM)
const int RIGHT_IN1 = 9;    // right wheel: direction
const int RIGHT_IN2 = 10;`;

const MOTOR_SETUP = `  pinMode(LEFT_EN, OUTPUT);
  pinMode(LEFT_IN1, OUTPUT);
  pinMode(LEFT_IN2, OUTPUT);
  pinMode(RIGHT_EN, OUTPUT);
  pinMode(RIGHT_IN1, OUTPUT);
  pinMode(RIGHT_IN2, OUTPUT);`;

const DRIVE = `// One wheel: 1 = forward, -1 = backward, 0 = stop
void wheel(int in1, int in2, int dir) {
  if (dir == 1) {
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
  } else if (dir == -1) {
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, LOW);
  }
}

// Both wheels: drive(1, 1) = forward, drive(-1, -1) = back,
// drive(-1, 1) = spin left, drive(1, -1) = spin right, drive(0, 0) = stop
void drive(int left, int right) {
  wheel(LEFT_IN1, LEFT_IN2, left);
  wheel(RIGHT_IN1, RIGHT_IN2, right);
}

// Speed of both wheels: 0-255
void setSpeed(int speed) {
  analogWrite(LEFT_EN, speed);
  analogWrite(RIGHT_EN, speed);
}`;

const DISTANCE = `// Ping! How far away is the thing in front of the eyes? (cm)
long distanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  if (us == 0) return 400;      // no echo: nothing in front
  return us / 58;
}`;

const RESET_HINT = 'Press ▶ Run again (or 🔄 Back to start) to put the robot back on its start spot.';

// ------------------------------------------------------------------ missions
export const ROBOT_MISSIONS: Mission[] = [
  {
    id: 'wakeUp',
    title: 'Wake Up, Robot!',
    emoji: '🤖',
    course: ['L2S5'],
    story: 'Meet your robot car! It has two wheels, and each wheel has its own DC motor and its own L293D motor driver. Make the robot drive across the yellow line and park in the blue box.',
    steps: [
      ...MOTOR_STEPS,
      'Run the starter code. Only the left wheel turns, so the robot spins in a circle!',
      'Add the right wheel: its pinMode lines, forward, and stop.',
    ],
    devices: ['leftMotor', 'rightMotor'],
    controls: ['reset', 'follow'],
    setup: { layout: 'open' },
    starterCode: `// Wake up the robot! Each wheel has a motor and an L293D motor driver:
// EN = speed, IN1 and IN2 = direction (HIGH + LOW = forward, both LOW = stop).

${MOTOR_PINS}

void setup() {
  pinMode(LEFT_EN, OUTPUT);
  pinMode(LEFT_IN1, OUTPUT);
  pinMode(LEFT_IN2, OUTPUT);
  // TODO: pinMode for the three RIGHT pins

  // Left wheel: forward at full speed
  digitalWrite(LEFT_IN1, HIGH);
  digitalWrite(LEFT_IN2, LOW);
  digitalWrite(LEFT_EN, HIGH);
  // TODO: right wheel forward too

  delay(2000);               // drive for 2 seconds

  // Stop: both direction pins LOW
  digitalWrite(LEFT_IN1, LOW);
  digitalWrite(LEFT_IN2, LOW);
  // TODO: stop the right wheel too
}

void loop() {
  // nothing here: the robot drives once and parks
}
`,
    solutionCode: `// Wake up the robot! Each wheel has a motor and an L293D motor driver:
// EN = speed, IN1 and IN2 = direction (HIGH + LOW = forward, both LOW = stop).

${MOTOR_PINS}

void setup() {
${MOTOR_SETUP}

  // Both wheels: forward at full speed
  digitalWrite(LEFT_IN1, HIGH);
  digitalWrite(LEFT_IN2, LOW);
  digitalWrite(LEFT_EN, HIGH);
  digitalWrite(RIGHT_IN1, HIGH);
  digitalWrite(RIGHT_IN2, LOW);
  digitalWrite(RIGHT_EN, HIGH);

  delay(2000);               // drive for 2 seconds

  // Stop both wheels
  digitalWrite(LEFT_IN1, LOW);
  digitalWrite(LEFT_IN2, LOW);
  digitalWrite(RIGHT_IN1, LOW);
  digitalWrite(RIGHT_IN2, LOW);
}

void loop() {
  // nothing here: the robot drives once and parks
}
`,
    solutionWires: [...POWER, ...MOTOR_WIRES],
    hints: [
      'A robot car steers by turning its wheels at different speeds. One wheel only = going round in circles!',
      'The right wheel uses RIGHT_IN1, RIGHT_IN2 and RIGHT_EN, exactly like the left one.',
      'Too short or too far? Change delay(2000). At full speed the robot drives about 30 cm every second.',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Both wheels turn forward', check: (c) => c.held(c.dev('leftMotor').speed > 0.3 && c.dev('rightMotor').speed > 0.3, 0.3) },
      { text: 'Drive across the yellow line', check: (c) => c.world.robot.x > -50 },
      { text: 'Stop inside the blue parking box', check: (c) => c.held(c.world.stopped && c.world.inPark, 1) },
    ],
  },
  {
    id: 'squareDance',
    title: 'Square Dance',
    emoji: '💃',
    course: ['L1S11', 'L1S12', 'L2S5'],
    story: 'The robot wants to dance! Drive along the dashed square on the mat: forward, turn left, forward, turn left... four times, and finish where you started. Functions and a for loop make it short.',
    steps: [
      ...MOTOR_STEPS,
      'forward() and stopMotors() are ready. Finish turnLeft(): left wheel backward, right wheel forward. That spins the robot on the spot.',
      'The for loop repeats "side + turn" 4 times. Tune TURN_TIME until each turn is a right angle (90°). Watch the robot’s trail!',
    ],
    devices: ['leftMotor', 'rightMotor'],
    controls: ['reset', 'follow'],
    setup: { layout: 'square' },
    starterCode: `// Square dance: forward, turn left... 4 times = a square!

${MOTOR_PINS}

const int SPEED = 200;        // 0-255
const int SIDE_TIME = 2000;   // ms to drive one side of the square
const int TURN_TIME = 400;    // ms to turn 90° (try it, then adjust!)

void forward() {
  digitalWrite(LEFT_IN1, HIGH);
  digitalWrite(LEFT_IN2, LOW);
  digitalWrite(RIGHT_IN1, HIGH);
  digitalWrite(RIGHT_IN2, LOW);
}

void turnLeft() {
  // TODO: spin on the spot: left wheel BACKWARD, right wheel FORWARD
}

void stopMotors() {
  digitalWrite(LEFT_IN1, LOW);
  digitalWrite(LEFT_IN2, LOW);
  digitalWrite(RIGHT_IN1, LOW);
  digitalWrite(RIGHT_IN2, LOW);
}

void setup() {
${MOTOR_SETUP}
  analogWrite(LEFT_EN, SPEED);
  analogWrite(RIGHT_EN, SPEED);
  delay(500);

  for (int side = 0; side < 4; side++) {
    forward();
    delay(SIDE_TIME);
    stopMotors();
    delay(300);
    turnLeft();
    delay(TURN_TIME);
    stopMotors();
    delay(300);
  }
}

void loop() {
}
`,
    solutionCode: `// Square dance: forward, turn left... 4 times = a square!

${MOTOR_PINS}

const int SPEED = 200;        // 0-255
const int SIDE_TIME = 2000;   // ms to drive one side of the square
const int TURN_TIME = 400;    // ms to turn 90° (try it, then adjust!)

void forward() {
  digitalWrite(LEFT_IN1, HIGH);
  digitalWrite(LEFT_IN2, LOW);
  digitalWrite(RIGHT_IN1, HIGH);
  digitalWrite(RIGHT_IN2, LOW);
}

void turnLeft() {
  digitalWrite(LEFT_IN1, LOW);     // left wheel backward
  digitalWrite(LEFT_IN2, HIGH);
  digitalWrite(RIGHT_IN1, HIGH);   // right wheel forward
  digitalWrite(RIGHT_IN2, LOW);
}

void stopMotors() {
  digitalWrite(LEFT_IN1, LOW);
  digitalWrite(LEFT_IN2, LOW);
  digitalWrite(RIGHT_IN1, LOW);
  digitalWrite(RIGHT_IN2, LOW);
}

void setup() {
${MOTOR_SETUP}
  analogWrite(LEFT_EN, SPEED);
  analogWrite(RIGHT_EN, SPEED);
  delay(500);

  for (int side = 0; side < 4; side++) {
    forward();
    delay(SIDE_TIME);
    stopMotors();
    delay(300);
    turnLeft();
    delay(TURN_TIME);
    stopMotors();
    delay(300);
  }
}

void loop() {
}
`,
    solutionWires: [...POWER, ...MOTOR_WIRES],
    hints: [
      'Spinning on the spot: one wheel forward and the other backward. Which way it spins depends on which wheel goes backward.',
      'Turned too far? Make TURN_TIME smaller. Not far enough? Make it bigger. Real robot builders tune numbers like this all the time!',
      'A function (like turnLeft) is a name for a few lines of code, so you can use them again and again.',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Drive the first side of the square', check: (c) => c.world.sides >= 1 },
      { text: 'Turn about 90° on the spot', check: (c) => c.world.goodTurns >= 1 },
      { text: 'Dance all 4 sides', check: (c) => c.world.sides >= 4 && c.world.goodTurns >= 3 },
      { text: 'Finish back on the start spot', check: (c) => c.held(c.world.sides >= 4 && c.world.stopped && c.world.startDist < 20, 1) },
    ],
  },
  {
    id: 'bumperCar',
    title: 'Bumper Car',
    emoji: '🚗',
    course: ['L1S6', 'L1S7', 'L1S5'],
    story: 'The robot has a bumper switch on its nose. When it bumps into a wall the switch clicks. Make it honk, back away and turn, like a bumper car at the fair.',
    steps: [
      ...MOTOR_STEPS,
      'Bumper switch: G → - rail, V → + rail, S → pin 2. It sends HIGH while it is pressed.',
      'Horn (buzzer): G → - rail, S → pin 4.',
      'In loop(): if the bumper is pressed, stop, honk, back up and spin. Otherwise drive forward.',
    ],
    devices: ['leftMotor', 'rightMotor', 'bumper', 'horn'],
    controls: ['reset', 'follow'],
    setup: { layout: 'bumper' },
    starterCode: `// Bumper car: drive until the bumper hits something, then back away.

${MOTOR_PINS}
const int BUMPER = 2;         // HIGH when the bumper is pressed
const int HORN = 4;

${DRIVE}

void setup() {
${MOTOR_SETUP}
  pinMode(BUMPER, INPUT);
  pinMode(HORN, OUTPUT);
  setSpeed(220);
}

void loop() {
  // TODO: if the bumper is pressed (HIGH):
  //   stop, honk with tone(HORN, 880, 300), back up for a while, spin for a while
  // otherwise:
  drive(1, 1);                // forward
}
`,
    solutionCode: `// Bumper car: drive until the bumper hits something, then back away.

${MOTOR_PINS}
const int BUMPER = 2;         // HIGH when the bumper is pressed
const int HORN = 4;

${DRIVE}

void setup() {
${MOTOR_SETUP}
  pinMode(BUMPER, INPUT);
  pinMode(HORN, OUTPUT);
  setSpeed(220);
}

void loop() {
  if (digitalRead(BUMPER) == HIGH) {
    drive(0, 0);              // ouch! stop
    tone(HORN, 880, 300);     // honk
    delay(300);
    drive(-1, -1);            // back up
    delay(700);
    drive(-1, 1);             // spin left
    delay(600);
  } else {
    drive(1, 1);              // nothing in the way: forward
  }
}
`,
    solutionWires: [
      ...POWER,
      ...MOTOR_WIRES,
      ['bumper:GND', 'rail:N13'],
      ['bumper:VCC', 'rail:P13'],
      ['bumper:SIG', 'uno:D2'],
      ['horn:GND', 'rail:N18'],
      ['horn:SIG', 'uno:D4'],
    ],
    hints: [
      'The bumper is a push button that the wall presses for you. digitalRead(BUMPER) == HIGH means "I hit something".',
      'Back up first, then spin. If you spin with your nose against the wall, you just scrape along it.',
      'Real robot vacuum cleaners work like this: bump, turn, try again.',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Drive into a wall: the bumper clicks', check: (c) => c.world.bumps >= 1 },
      { text: 'Honk the horn when you bump', check: (c) => c.dev('horn').freq > 0 && c.world.sinceBump < 1.5 },
      { text: 'Back away from the wall', check: (c) => c.world.bounces >= 1 },
      { text: 'Bounce off 3 walls', check: (c) => c.world.bounces >= 3 },
    ],
  },
  {
    id: 'headlights',
    title: 'Tunnel Headlights',
    emoji: '💡',
    course: ['L2S3', 'L1S4'],
    story: 'Cars switch their headlights on by themselves when they drive into a tunnel. Give the robot a light sensor on its roof and headlights that know when it gets dark.',
    steps: [
      ...MOTOR_STEPS,
      'Light sensor: G → - rail, V → + rail, A → A0.',
      'Headlights (LED): G → GND2, S → pin 13.',
      'The driving is done. In loop(): if analogRead(LIGHT) is low (dark), switch the headlights on; otherwise off.',
    ],
    devices: ['leftMotor', 'rightMotor', 'lightSensor', 'headlights'],
    controls: ['time', 'reset', 'follow'],
    setup: { layout: 'tunnel', hour: 12 },
    starterCode: `// Automatic headlights: on in the dark tunnel, off in the sunshine.

${MOTOR_PINS}
const int LIGHT = A0;         // light sensor: big number = bright
const int HEADLIGHTS = 13;

${DRIVE}

void setup() {
${MOTOR_SETUP}
  pinMode(HEADLIGHTS, OUTPUT);
  Serial.begin(9600);
  setSpeed(150);
  drive(1, 1);                // drive through the tunnel
}

void loop() {
  int light = analogRead(LIGHT);
  Serial.println(light);

  // TODO: dark (light < 300)? headlights ON, otherwise OFF

  if (millis() > 11000) {
    drive(0, 0);              // park after the tunnel
  }
  delay(100);
}
`,
    solutionCode: `// Automatic headlights: on in the dark tunnel, off in the sunshine.

${MOTOR_PINS}
const int LIGHT = A0;         // light sensor: big number = bright
const int HEADLIGHTS = 13;

${DRIVE}

void setup() {
${MOTOR_SETUP}
  pinMode(HEADLIGHTS, OUTPUT);
  Serial.begin(9600);
  setSpeed(150);
  drive(1, 1);                // drive through the tunnel
}

void loop() {
  int light = analogRead(LIGHT);
  Serial.println(light);

  if (light < 300) {
    digitalWrite(HEADLIGHTS, HIGH);   // dark: lights on
  } else {
    digitalWrite(HEADLIGHTS, LOW);    // bright: lights off
  }

  if (millis() > 11000) {
    drive(0, 0);              // park after the tunnel
  }
  delay(100);
}
`,
    solutionWires: [
      ...POWER,
      ...MOTOR_WIRES,
      ['lightSensor:GND', 'rail:N13'],
      ['lightSensor:VCC', 'rail:P13'],
      ['lightSensor:AO', 'uno:A0'],
      ['headlights:GND', 'uno:GND2'],
      ['headlights:SIG', 'uno:D13'],
    ],
    hints: [
      'Open the Serial Monitor: it shows the light level. Outside it is about 1000, in the tunnel it drops below 100.',
      'Pick a number between bright and dark (like 300) and compare with if / else.',
      'Try the time slider: at night your headlights should stay on all the time!',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Headlights off in the sunshine', check: (c) => c.held(c.world.robot.speed > 0.2 && !c.world.inTunnel && c.dev('headlights').brightness < 0.1, 1) },
      { text: 'Headlights on in the dark tunnel', check: (c) => c.held(c.world.inTunnel && c.dev('headlights').brightness > 0.5, 0.5) },
      { text: 'Headlights off again after the tunnel', check: (c) => c.held(c.world.robot.x > 60 && c.dev('headlights').brightness < 0.1, 0.5) },
    ],
  },
  {
    id: 'dontCrash',
    title: "Don't Crash!",
    emoji: '🐱',
    course: ['L2S4', 'L1S10'],
    story: 'The cat sleeps in a cardboard box in the middle of the room, and the robot keeps crashing into it. Give the robot ultrasonic eyes so it stops in front of the box, and drives on when the cat moves it away.',
    steps: [
      ...MOTOR_STEPS,
      EYE_STEP,
      'distanceCm() measures the distance. In loop(): closer than 20 cm? stop. Otherwise drive forward.',
      'When the robot is waiting, press 📦 Move the box and watch it drive on.',
    ],
    devices: ['leftMotor', 'rightMotor', 'eyes'],
    controls: ['box', 'reset', 'follow'],
    setup: { layout: 'wall' },
    starterCode: `// Don't crash: stop in front of things, drive on when the way is clear.

${MOTOR_PINS}
const int TRIG = 12;          // eyes: "ping!"
const int ECHO = 11;          // eyes: the echo comes back

${DRIVE}

${DISTANCE}

void setup() {
${MOTOR_SETUP}
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
  setSpeed(200);
}

void loop() {
  long cm = distanceCm();
  Serial.println(cm);

  // TODO: closer than 20 cm? stop. Otherwise drive forward.
  drive(1, 1);
  delay(50);
}
`,
    solutionCode: `// Don't crash: stop in front of things, drive on when the way is clear.

${MOTOR_PINS}
const int TRIG = 12;          // eyes: "ping!"
const int ECHO = 11;          // eyes: the echo comes back

${DRIVE}

${DISTANCE}

void setup() {
${MOTOR_SETUP}
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
  setSpeed(200);
}

void loop() {
  long cm = distanceCm();
  Serial.println(cm);

  if (cm < 20) {
    drive(0, 0);              // something in front: wait
  } else {
    drive(1, 1);              // the way is clear: drive
  }
  delay(50);
}
`,
    solutionWires: [...POWER, ...MOTOR_WIRES, ...EYE_WIRES],
    hints: [
      'The robot needs a little distance to stop, like a bike. If it still touches the box, stop a bit earlier (25 cm).',
      'Check the distance again and again in loop(): that is how the robot notices the box is gone.',
      'The far wall counts too: your robot should stop there as well!',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Drive towards the box', check: (c) => c.world.odometer > 30 },
      { text: 'Stop in front of the box without touching it', check: (c) => c.held(c.world.stopped && c.world.boxPresent && c.world.frontGap < 30 && c.world.crashes === 0, 2) },
      { text: 'The box is gone: drive on!', check: (c) => !c.world.boxPresent && c.world.robot.x > 50 && c.world.crashes === 0 },
      { text: 'Stop before the far wall too', check: (c) => c.held(!c.world.boxPresent && c.world.stopped && c.world.frontGap < 30 && c.world.crashes === 0, 1) },
    ],
  },
  {
    id: 'lineFollower',
    title: 'Line Follower',
    emoji: '〰️',
    course: ['L2S3'],
    story: 'Factory robots follow black lines painted on the floor to carry boxes around. Two line sensors under the robot’s nose look down: steer so the black line always stays between them, and drive a whole lap.',
    steps: [
      ...MOTOR_STEPS,
      'Left line sensor: V → + rail, G → - rail, O → A1. Right line sensor: same, O → A2.',
      'A line sensor gives HIGH over the black line and LOW over the white mat. (A1 and A2 work as digital pins too!)',
      'Left sensor on the line? Turn left. Right sensor on the line? Turn right. Neither? Straight on.',
    ],
    devices: ['leftMotor', 'rightMotor', 'lineLeft', 'lineRight'],
    controls: ['reset', 'follow'],
    setup: { layout: 'track' },
    starterCode: `// Line follower: keep the black line between the two sensors.

${MOTOR_PINS}
const int LINE_L = A1;        // HIGH = black line under the left sensor
const int LINE_R = A2;        // HIGH = black line under the right sensor

${DRIVE}

void setup() {
${MOTOR_SETUP}
  pinMode(LINE_L, INPUT);
  pinMode(LINE_R, INPUT);
  setSpeed(150);
}

void loop() {
  int left = digitalRead(LINE_L);
  int right = digitalRead(LINE_R);

  // TODO: left sensor sees the line? turn left: drive(0, 1)
  // TODO: right sensor sees the line? turn right: drive(1, 0)
  drive(1, 1);                // otherwise: straight on
}
`,
    solutionCode: `// Line follower: keep the black line between the two sensors.

${MOTOR_PINS}
const int LINE_L = A1;        // HIGH = black line under the left sensor
const int LINE_R = A2;        // HIGH = black line under the right sensor

${DRIVE}

void setup() {
${MOTOR_SETUP}
  pinMode(LINE_L, INPUT);
  pinMode(LINE_R, INPUT);
  setSpeed(150);
}

void loop() {
  int left = digitalRead(LINE_L);
  int right = digitalRead(LINE_R);

  if (left == HIGH && right == LOW) {
    drive(0, 1);              // the line is on the left: turn left
  } else if (right == HIGH && left == LOW) {
    drive(1, 0);              // the line is on the right: turn right
  } else {
    drive(1, 1);              // the line is between the sensors: straight on
  }
}
`,
    solutionWires: [
      ...POWER,
      ...MOTOR_WIRES,
      ['lineLeft:VCC', 'rail:P13'],
      ['lineLeft:GND', 'rail:N13'],
      ['lineLeft:OUT', 'uno:A1'],
      ['lineRight:VCC', 'rail:P18'],
      ['lineRight:GND', 'rail:N18'],
      ['lineRight:OUT', 'uno:A2'],
    ],
    hints: [
      'The sensors sit on both sides of the line. When the robot drifts, one of them reaches the black line first.',
      'To turn left, slow down or stop the LEFT wheel and keep the right one going.',
      'Leaving the track on the curves? Try a lower speed, like setSpeed(120). Real line followers slow down too!',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Drive along the black line', check: (c) => c.world.progress > 30 },
      { text: 'Follow the first curve', check: (c) => c.world.progress > 180 },
      { text: 'Drive a whole lap!', check: (c) => c.world.progress >= c.world.lapLength },
    ],
  },
  {
    id: 'schoolZone',
    title: 'School Zone',
    emoji: '🏫',
    course: ['L3S4'],
    story: 'Children cross the road near the school, so cars must crawl through the school zone. A speed camera flashes anyone going too fast! Use PWM to drive slowly through the zone, then zoom to the finish line.',
    steps: [
      ...MOTOR_STEPS,
      'analogWrite(EN, speed) sets the speed with PWM: 255 is full speed, about 100 is a crawl.',
      'The zone ends about 1 metre from the start. At speed 100 the robot drives about 12 cm every second. How long must it crawl?',
      'After the zone, setSpeed(255) and drive to the chequered finish line, then stop.',
    ],
    devices: ['leftMotor', 'rightMotor'],
    controls: ['reset', 'follow'],
    setup: { layout: 'school' },
    starterCode: `// School zone: crawl slowly past the school, then zoom to the finish.

${MOTOR_PINS}

${DRIVE}

void setup() {
${MOTOR_SETUP}
  drive(1, 1);

  // TODO: crawl through the school zone: a low speed (about 100) for long enough
  setSpeed(255);              // full speed... the speed camera will flash!
  delay(4000);

  drive(0, 0);                // stop after the finish line
}

void loop() {
}
`,
    solutionCode: `// School zone: crawl slowly past the school, then zoom to the finish.

${MOTOR_PINS}

${DRIVE}

void setup() {
${MOTOR_SETUP}
  drive(1, 1);

  setSpeed(100);              // crawl: 100 out of 255
  delay(9000);                // the whole school zone

  setSpeed(255);              // full speed to the finish
  delay(3000);

  drive(0, 0);                // stop after the finish line
}

void loop() {
}
`,
    solutionWires: [...POWER, ...MOTOR_WIRES],
    hints: [
      'PWM switches the motor on and off very fast. analogWrite(EN, 100) means "on 100 out of every 255 moments", so the motor turns slower.',
      'Below about 40 the motor does not have enough push to turn at all.',
      'Flashed by the speed camera? Press ▶ Run to try again.',
    ],
    objectives: [
      { text: 'Crawl slowly into the school zone', check: (c) => c.held(c.world.inZone && c.world.robot.speed > 0.1 && c.world.robot.speed < 0.55 && !c.world.speeding, 0.5) },
      { text: 'Drive through the whole zone without speeding', check: (c) => c.world.zonePassed && !c.world.speeding },
      { text: 'Zoom to the finish line at full speed', check: (c) => c.world.fastAfter > 0.85 && c.world.robot.x > 90 && !c.world.speeding },
    ],
  },
  {
    id: 'lookBothWays',
    title: 'Look Both Ways',
    emoji: '🧭',
    course: ['L1S12', 'L2S4'],
    story: 'The robot is lost in a maze with a treasure in the far corner! Its eyes sit on a servo, so it can turn its head. At every wall it stops, looks left, looks right, and turns towards the side with more space.',
    steps: [
      ...MOTOR_STEPS,
      EYE_STEP,
      'Head servo: G → - rail, V → + rail, S → pin 3. 90° = straight ahead, 180° = left, 0° = right.',
      'Finish look(): turn the head, wait for it, then measure. At a wall, compare look(180) with look(0) and turn towards the bigger one.',
    ],
    devices: ['leftMotor', 'rightMotor', 'eyes', 'neck'],
    controls: ['reset', 'follow'],
    setup: { layout: 'maze' },
    starterCode: `// Look both ways: at a wall, look left and right, then turn to the open side.
#include <Servo.h>

${MOTOR_PINS}
const int TRIG = 12;
const int ECHO = 11;
const int TURN_TIME = 480;    // ms for a 90° turn at speed 170

Servo neck;                   // the head servo, on pin 3

${DRIVE}

${DISTANCE}

// Turn the head to an angle and measure the distance there
long look(int angle) {
  // TODO: neck.write(angle), wait 600 ms for the head to turn, then return distanceCm()
  return 0;
}

void setup() {
${MOTOR_SETUP}
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  neck.attach(3);
  neck.write(90);             // look straight ahead
  setSpeed(170);
  delay(500);
}

void loop() {
  if (distanceCm() > 20) {
    drive(1, 1);              // the way is clear
    delay(30);
    return;
  }
  drive(0, 0);                // a wall!

  // TODO: look left (180) and right (0), then look ahead again (90)
  // TODO: turn towards the side with MORE space
  drive(1, -1);               // for now: always spin right
  delay(TURN_TIME);
  drive(0, 0);
  delay(300);
}
`,
    solutionCode: `// Look both ways: at a wall, look left and right, then turn to the open side.
#include <Servo.h>

${MOTOR_PINS}
const int TRIG = 12;
const int ECHO = 11;
const int TURN_TIME = 480;    // ms for a 90° turn at speed 170

Servo neck;                   // the head servo, on pin 3

${DRIVE}

${DISTANCE}

// Turn the head to an angle and measure the distance there
long look(int angle) {
  neck.write(angle);
  delay(600);                 // give the head time to turn
  return distanceCm();
}

void setup() {
${MOTOR_SETUP}
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  neck.attach(3);
  neck.write(90);             // look straight ahead
  setSpeed(170);
  delay(500);
}

void loop() {
  if (distanceCm() > 20) {
    drive(1, 1);              // the way is clear
    delay(30);
    return;
  }
  drive(0, 0);                // a wall!

  long left = look(180);
  long right = look(0);
  neck.write(90);
  delay(400);

  if (left > right) {
    drive(-1, 1);             // more space on the left: spin left
  } else {
    drive(1, -1);             // more space on the right: spin right
  }
  delay(TURN_TIME);
  drive(0, 0);
  delay(300);
}
`,
    solutionWires: [
      ...POWER,
      ...MOTOR_WIRES,
      ...EYE_WIRES,
      ['neck:GND', 'rail:N18'],
      ['neck:VCC', 'rail:P18'],
      ['neck:SIG', 'uno:D3'],
    ],
    hints: [
      'look() is a function that gives back a number: long d = look(180); stores the distance on the left.',
      'A servo needs time to turn. Measure too early and the eyes are still looking the wrong way!',
      'If the turns are not square, tune TURN_TIME like in the Square Dance.',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Stop before the first wall', check: (c) => c.held(c.world.stopped && c.world.robot.x > 60 && c.world.crashes === 0, 0.3) },
      { text: 'Look left and right with the head', check: (c) => c.world.lookedLeft && c.world.lookedRight },
      { text: 'Turn to the open side and drive on', check: (c) => c.world.robot.x > 40 && c.world.robot.y > -5 },
      { text: 'Find the treasure!', check: (c) => c.world.treasure },
    ],
  },
  {
    id: 'remoteControl',
    title: 'Remote Control',
    emoji: '🕹️',
    course: ['L3S7', 'L3S4'],
    story: 'Time to drive the robot yourself! A joystick on a long cable is the remote control. Push it up to drive, sideways to turn, press it to honk, and park the robot in its garage.',
    steps: [
      ...MOTOR_STEPS,
      'Joystick: G → - rail, + → + rail, X → A3, Y → A4, SW → pin 2. Horn: G → - rail, S → pin 4.',
      'Up/down (Y) is the speed. Left/right (X) makes one wheel faster than the other: left wheel = Y + X, right wheel = Y - X.',
      'Run, then drive with the joystick under the 3D view.',
    ],
    devices: ['leftMotor', 'rightMotor', 'remote', 'horn'],
    controls: ['remote', 'reset', 'follow'],
    setup: { layout: 'garage' },
    starterCode: `// Remote control: a joystick drives the robot.

${MOTOR_PINS}
const int STICK_X = A3;       // left/right
const int STICK_Y = A4;       // up/down
const int STICK_SW = 2;       // LOW when you press the stick
const int HORN = 4;

// One wheel: speed -255 (full backward) to 255 (full forward)
void wheel(int en, int in1, int in2, int speed) {
  if (speed > 0) {
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
  } else if (speed < 0) {
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, LOW);
  }
  analogWrite(en, min(abs(speed), 255));
}

void setup() {
${MOTOR_SETUP}
  pinMode(STICK_SW, INPUT_PULLUP);
  pinMode(HORN, OUTPUT);
}

void loop() {
  int x = analogRead(STICK_X) - 512;    // -512 (left) to 511 (right)
  int y = analogRead(STICK_Y) - 512;    // -512 (down) to 511 (up)
  if (abs(x) < 40) x = 0;               // dead zone: a stick never sits exactly in the middle
  if (abs(y) < 40) y = 0;

  // TODO: turning! left wheel = (y + x) / 2, right wheel = (y - x) / 2
  int left = y / 2;
  int right = y / 2;
  wheel(LEFT_EN, LEFT_IN1, LEFT_IN2, left);
  wheel(RIGHT_EN, RIGHT_IN1, RIGHT_IN2, right);

  // TODO: stick pressed (LOW)? tone(HORN, 660). Otherwise noTone(HORN).
  delay(20);
}
`,
    solutionCode: `// Remote control: a joystick drives the robot.

${MOTOR_PINS}
const int STICK_X = A3;       // left/right
const int STICK_Y = A4;       // up/down
const int STICK_SW = 2;       // LOW when you press the stick
const int HORN = 4;

// One wheel: speed -255 (full backward) to 255 (full forward)
void wheel(int en, int in1, int in2, int speed) {
  if (speed > 0) {
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
  } else if (speed < 0) {
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, LOW);
  }
  analogWrite(en, min(abs(speed), 255));
}

void setup() {
${MOTOR_SETUP}
  pinMode(STICK_SW, INPUT_PULLUP);
  pinMode(HORN, OUTPUT);
}

void loop() {
  int x = analogRead(STICK_X) - 512;    // -512 (left) to 511 (right)
  int y = analogRead(STICK_Y) - 512;    // -512 (down) to 511 (up)
  if (abs(x) < 40) x = 0;               // dead zone: a stick never sits exactly in the middle
  if (abs(y) < 40) y = 0;

  int left = (y + x) / 2;               // pushing right speeds up the left wheel
  int right = (y - x) / 2;
  wheel(LEFT_EN, LEFT_IN1, LEFT_IN2, left);
  wheel(RIGHT_EN, RIGHT_IN1, RIGHT_IN2, right);

  if (digitalRead(STICK_SW) == LOW) {
    tone(HORN, 660);                    // beep beep!
  } else {
    noTone(HORN);
  }
  delay(20);
}
`,
    solutionWires: [
      ...POWER,
      ...MOTOR_WIRES,
      ['remote:GND', 'rail:N13'],
      ['remote:VCC', 'rail:P13'],
      ['remote:VRx', 'uno:A3'],
      ['remote:VRy', 'uno:A4'],
      ['remote:SW', 'uno:D2'],
      ['horn:GND', 'rail:N18'],
      ['horn:SIG', 'uno:D4'],
    ],
    hints: [
      'analogRead gives 0-1023 and the middle is about 512. Subtract 512 so the middle becomes 0.',
      'Stick to the right: x is positive, so the left wheel goes faster than the right one and the robot turns right.',
      'Drive slowly near the garage: small pushes on the stick make small speeds.',
      RESET_HINT,
    ],
    objectives: [
      { text: 'Press the stick: honk the horn', check: (c) => !!c.world.pressed.remote && c.dev('horn').freq > 0 },
      { text: 'Push the stick up: drive forward', check: (c) => c.held((c.world.values['remote.y'] ?? 0.5) > 0.7 && c.world.robot.v > 10, 0.5) },
      { text: 'Push the stick sideways: turn', check: (c) => Math.abs((c.world.values['remote.x'] ?? 0.5) - 0.5) > 0.3 && Math.abs(c.world.robot.w) > 1 },
      { text: 'Park inside the garage', check: (c) => c.held(c.world.inGarage && c.world.stopped, 1) },
    ],
  },
  {
    id: 'free',
    title: 'Free Play: Robot Playground',
    emoji: '🎡',
    story: 'Every robot part is on your workbench, and the playground has a line track with a tunnel, boxes and a garage. Build your dream robot: a line follower with headlights, a box dodger, a remote-control car...',
    steps: [
      'Pick the parts you want and wire them (the pins from the missions work well).',
      'Write your own program and Run it. 🔄 puts the robot back on the start.',
      'Use the joystick and the time of day to play.',
    ],
    devices: ['leftMotor', 'rightMotor', 'bumper', 'horn', 'eyes', 'neck', 'lineLeft', 'lineRight', 'lightSensor', 'headlights', 'remote'],
    controls: ['remote', 'time', 'reset', 'follow'],
    setup: { layout: 'playground' },
    starterCode: `// Free play: build your own robot!
//   left wheel  EN 5, IN1 7, IN2 8      bumper  2       eyes TRIG 12, ECHO 11
//   right wheel EN 6, IN1 9, IN2 10     servo   3       line sensors A1, A2
//   horn 4      headlights 13           light sensor A0 joystick X A3, Y A4

void setup() {

}

void loop() {

}
`,
    solutionCode: `// Example: a line follower that switches its headlights on in the tunnel.

${MOTOR_PINS}
const int LINE_L = A1;
const int LINE_R = A2;
const int LIGHT = A0;
const int HEADLIGHTS = 13;

${DRIVE}

void setup() {
${MOTOR_SETUP}
  pinMode(LINE_L, INPUT);
  pinMode(LINE_R, INPUT);
  pinMode(HEADLIGHTS, OUTPUT);
  setSpeed(140);
}

void loop() {
  int left = digitalRead(LINE_L);
  int right = digitalRead(LINE_R);
  if (left == HIGH && right == LOW) {
    drive(0, 1);
  } else if (right == HIGH && left == LOW) {
    drive(1, 0);
  } else {
    drive(1, 1);
  }
  digitalWrite(HEADLIGHTS, analogRead(LIGHT) < 300 ? HIGH : LOW);
}
`,
    solutionWires: [],
    hints: ['Look at the earlier missions for wiring ideas.', 'Use the power rail: both motor drivers need 5V.'],
    objectives: [],
  },
];
