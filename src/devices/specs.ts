// Electronic modules available on the workbench. Every module uses the simple header
// layout kids find in real starter kits, with the pin names printed on real boards.

export type DeviceType =
  | 'led'
  | 'button'
  | 'buzzer'
  | 'pir'
  | 'servo'
  | 'ldr'
  | 'relay'
  | 'fan'
  | 'temp'
  | 'pot'
  | 'ultrasonic'
  | 'trafficLight'
  | 'rgbLed'
  | 'sevenSeg'
  | 'ir'
  | 'soil'
  | 'dht'
  | 'lcd'
  | 'lcdI2c'
  | 'motor'
  | 'keypad'
  | 'joystick'
  | 'sound';

export type PinRole = 'gnd' | 'vcc' | 'sig';

export interface PinSpec {
  name: string;
  /** Printed on the module next to the pin */
  short: string;
  label: string;
  role: PinRole;
  /** 'in' = the module listens to the Arduino, 'out' = the module talks to the Arduino */
  dir?: 'in' | 'out';
  /** Gives an analog voltage: connect it to A0-A5 */
  analog?: boolean;
  /** I2C bus pin: must go to A4/SDA or A5/SCL */
  i2c?: 'SDA' | 'SCL';
}

export interface DeviceSpec {
  type: DeviceType;
  title: string;
  /** What it is in one kid-friendly sentence */
  blurb: string;
  pins: PinSpec[];
  pcb: string;
  /** Module footprint in cm (width, depth) */
  size: [number, number];
  needs5V?: boolean;
}

const GND: PinSpec = { name: 'GND', short: 'G', label: 'GND (ground, -)', role: 'gnd' };
const VCC: PinSpec = { name: 'VCC', short: 'V', label: 'VCC (power, +)', role: 'vcc' };
const MINUS: PinSpec = { name: 'GND', short: '−', label: '− (ground, GND)', role: 'gnd' };
const sigIn = (name: string, short: string, label: string): PinSpec => ({ name, short, label, role: 'sig', dir: 'in' });
const sigOut = (name: string, short: string, label: string, analog = false): PinSpec => ({ name, short, label, role: 'sig', dir: 'out', analog });

export const KEYPAD_KEYS = ['123A', '456B', '789C', '*0#D'];

export const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  led: {
    type: 'led',
    title: 'LED module',
    blurb: 'A small light. HIGH turns it on; analogWrite() makes it dimmer or brighter.',
    pins: [GND, sigIn('SIG', 'S', 'S (signal from Arduino)')],
    pcb: '#1d4ed8',
    size: [2.4, 2.0],
  },
  button: {
    type: 'button',
    title: 'Push button module',
    blurb: 'Sends HIGH while pressed and LOW when released.',
    pins: [GND, VCC, sigOut('SIG', 'S', 'S (HIGH when pressed)')],
    pcb: '#b91c1c',
    size: [2.6, 2.4],
  },
  buzzer: {
    type: 'buzzer',
    title: 'Buzzer module',
    blurb: 'Makes sound. Use tone(pin, frequency) to play notes, or HIGH for a beep.',
    pins: [GND, sigIn('SIG', 'S', 'S (signal from Arduino)')],
    pcb: '#111827',
    size: [2.4, 2.2],
  },
  pir: {
    type: 'pir',
    title: 'Motion sensor (PIR)',
    blurb: 'Notices warm bodies moving. OUT goes HIGH when someone is nearby.',
    pins: [GND, sigOut('OUT', 'O', 'OUT (HIGH when motion)'), VCC],
    pcb: '#15803d',
    size: [3.2, 3.2],
  },
  servo: {
    type: 'servo',
    title: 'Servo motor',
    blurb: 'Turns to an exact angle (0-180°). Use the Servo library: myServo.write(90).',
    pins: [{ ...GND, label: 'GND (brown wire)' }, { ...VCC, label: 'VCC (red wire, needs 5V)' }, sigIn('SIG', 'S', 'SIG (orange wire, from Arduino)')],
    pcb: '#2563eb',
    size: [4.0, 2.4],
    needs5V: true,
  },
  ldr: {
    type: 'ldr',
    title: 'Light sensor',
    blurb: 'Measures light. analogRead() gives a big number in bright light and a small one in the dark.',
    pins: [GND, VCC, sigOut('AO', 'A', 'AO (analog light level)', true)],
    pcb: '#7c3aed',
    size: [2.4, 2.2],
  },
  relay: {
    type: 'relay',
    title: 'Relay module',
    blurb: 'An electric switch for big things like a lamp or a water pump. HIGH clicks it on.',
    pins: [GND, VCC, sigIn('IN', 'I', 'IN (signal from Arduino)')],
    pcb: '#0e7490',
    size: [3.4, 2.6],
    needs5V: true,
  },
  fan: {
    type: 'fan',
    title: 'Motor driver (fan)',
    blurb: 'Drives a motor. HIGH spins it; analogWrite() sets the speed.',
    pins: [GND, VCC, sigIn('IN', 'I', 'IN (speed from Arduino)')],
    pcb: '#c2410c',
    size: [3.0, 2.6],
    needs5V: true,
  },
  temp: {
    type: 'temp',
    title: 'Temperature sensor',
    blurb: 'Measures temperature. Every 10 mV means 1 °C (LM35).',
    pins: [GND, VCC, sigOut('OUT', 'O', 'OUT (analog temperature)', true)],
    pcb: '#0f766e',
    size: [2.4, 2.2],
  },
  pot: {
    type: 'pot',
    title: 'Knob (potentiometer)',
    blurb: 'Turn it to change a voltage. analogRead() gives 0 to 1023.',
    pins: [GND, sigOut('SIG', 'S', 'S (analog knob position)', true), VCC],
    pcb: '#4d7c0f',
    size: [2.6, 2.4],
  },
  ultrasonic: {
    type: 'ultrasonic',
    title: 'Distance sensor (HC-SR04)',
    blurb: 'Measures distance with sound echoes, like a bat. Use pulseIn() on ECHO.',
    pins: [VCC, sigIn('TRIG', 'T', 'TRIG (Arduino says "ping!")'), sigOut('ECHO', 'E', 'ECHO (pulse back to Arduino)'), GND],
    pcb: '#1e40af',
    size: [4.6, 2.2],
  },
  trafficLight: {
    type: 'trafficLight',
    title: 'Traffic light module',
    blurb: 'Red, yellow and green LEDs in one module. Each colour has its own pin.',
    pins: [sigIn('RED', 'R', 'R (red light)'), sigIn('YEL', 'Y', 'Y (yellow light)'), sigIn('GRN', 'G', 'G (green light)'), MINUS],
    pcb: '#18181b',
    size: [2.6, 4.4],
  },
  rgbLed: {
    type: 'rgbLed',
    title: 'RGB LED module',
    blurb: 'One light, three colours. Mix red, green and blue with analogWrite() to make any colour.',
    pins: [sigIn('RED', 'R', 'R (red amount)'), sigIn('GRN', 'G', 'G (green amount)'), sigIn('BLU', 'B', 'B (blue amount)'), MINUS],
    pcb: '#27272a',
    size: [2.6, 2.4],
  },
  sevenSeg: {
    type: 'sevenSeg',
    title: '7-segment display',
    blurb: 'Seven LED bars (a-g) that draw any digit. Common cathode: COM goes to GND.',
    pins: [
      ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => sigIn(s, s, `${s} (segment ${s})`)),
      { name: 'COM', short: '−', label: 'COM (common cathode, to GND)', role: 'gnd' },
    ],
    pcb: '#1f2937',
    size: [4.6, 3.8],
  },
  ir: {
    type: 'ir',
    title: 'IR obstacle sensor',
    blurb: 'Shines invisible infrared light and sees it bounce back. OUT goes LOW when something is in front.',
    pins: [sigOut('OUT', 'O', 'OUT (LOW when something is in front)'), GND, VCC],
    pcb: '#1d4ed8',
    size: [2.4, 3.2],
  },
  soil: {
    type: 'soil',
    title: 'Soil moisture sensor',
    blurb: 'Two prongs in the soil. AO is HIGH when dry and lower when wet; DO goes LOW when the soil is wet.',
    pins: [VCC, GND, sigOut('DO', 'D', 'DO (LOW when wet)'), sigOut('AO', 'A', 'AO (analog: high = dry)', true)],
    pcb: '#0f766e',
    size: [2.6, 4.8],
  },
  dht: {
    type: 'dht',
    title: 'DHT11 temp & humidity',
    blurb: 'Measures temperature and air humidity, and sends them as a digital code. Use the DHT library.',
    pins: [{ name: 'DATA', short: 'S', label: 'S (data)', role: 'sig', dir: 'out' }, VCC, MINUS],
    pcb: '#2563eb',
    size: [2.4, 3.0],
  },
  lcd: {
    type: 'lcd',
    title: 'LCD 16x2',
    blurb: 'A screen with 2 rows of 16 letters. Use the LiquidCrystal library (RS, E, D4-D7).',
    pins: [GND, VCC, sigIn('RS', 'RS', 'RS (register select)'), sigIn('E', 'E', 'E (enable)'), sigIn('D4', 'D4', 'D4 (data)'), sigIn('D5', 'D5', 'D5 (data)'), sigIn('D6', 'D6', 'D6 (data)'), sigIn('D7', 'D7', 'D7 (data)')],
    pcb: '#166534',
    size: [8.4, 4.4],
    needs5V: true,
  },
  lcdI2c: {
    type: 'lcdI2c',
    title: 'LCD 16x2 I2C',
    blurb: 'The same screen with an I2C backpack: only 4 wires. Address 0x27, LiquidCrystal_I2C library.',
    pins: [
      GND,
      VCC,
      { name: 'SDA', short: 'SDA', label: 'SDA (I2C data, to A4)', role: 'sig', i2c: 'SDA' },
      { name: 'SCL', short: 'SCL', label: 'SCL (I2C clock, to A5)', role: 'sig', i2c: 'SCL' },
    ],
    pcb: '#166534',
    size: [8.4, 4.4],
    needs5V: true,
  },
  motor: {
    type: 'motor',
    title: 'L293D motor driver',
    blurb: 'Lets a small Arduino pin control a big motor. IN1/IN2 pick the direction, EN sets the speed.',
    pins: [GND, VCC, sigIn('EN', 'EN', 'EN (speed, PWM)'), sigIn('IN1', 'I1', 'IN1 (direction)'), sigIn('IN2', 'I2', 'IN2 (direction)')],
    pcb: '#b45309',
    size: [3.8, 3.2],
    needs5V: true,
  },
  keypad: {
    type: 'keypad',
    title: 'Keypad 4x4',
    blurb: '16 keys in 4 rows and 4 columns. Use the Keypad library to find which key is pressed.',
    pins: [
      ...[1, 2, 3, 4].map((i): PinSpec => ({ name: `R${i}`, short: `R${i}`, label: `R${i} (row ${i})`, role: 'sig' })),
      ...[1, 2, 3, 4].map((i): PinSpec => ({ name: `C${i}`, short: `C${i}`, label: `C${i} (column ${i})`, role: 'sig' })),
    ],
    pcb: '#0f172a',
    size: [5.0, 5.6],
  },
  joystick: {
    type: 'joystick',
    title: 'Joystick',
    blurb: 'Two knobs in one stick: VRx and VRy give 0-1023, and SW is a button (LOW when pressed, use INPUT_PULLUP).',
    pins: [GND, { ...VCC, short: '+' }, sigOut('VRx', 'X', 'VRx (left/right)', true), sigOut('VRy', 'Y', 'VRy (up/down)', true), sigOut('SW', 'SW', 'SW (LOW when pushed)')],
    pcb: '#1e293b',
    size: [3.6, 3.8],
  },
  sound: {
    type: 'sound',
    title: 'Sound sensor',
    blurb: 'A tiny microphone. AO tells how loud it is; DO goes HIGH on a loud sound like a clap.',
    pins: [sigOut('AO', 'A', 'AO (analog loudness)', true), GND, VCC, sigOut('DO', 'D', 'DO (HIGH when loud)')],
    pcb: '#0e7490',
    size: [2.6, 3.0],
  },
};

/** A module placed in a world, e.g. the LED module that powers the porch light. */
export interface DeviceInstance {
  id: string;
  type: DeviceType;
  /** Real-life job, e.g. "Porch light" */
  name: string;
  emoji: string;
  /** LED colour etc. */
  color?: string;
}

export const pinRef = (part: string, pin: string) => `${part}:${pin}`;
