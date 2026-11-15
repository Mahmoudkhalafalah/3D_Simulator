// Electronic modules available on the workbench. Every module uses the same
// simple header layout kids find in real starter kits (GND / VCC / signal).

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
  | 'ultrasonic';

export type PinRole = 'gnd' | 'vcc' | 'sig';

export interface PinSpec {
  name: string;
  /** Printed on the module next to the pin */
  short: string;
  label: string;
  role: PinRole;
  /** 'in' = the module listens to the Arduino, 'out' = the module talks to the Arduino */
  dir?: 'in' | 'out';
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

export const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  led: {
    type: 'led',
    title: 'LED module',
    blurb: 'A small light. HIGH turns it on; analogWrite() makes it dimmer or brighter.',
    pins: [GND, { name: 'SIG', short: 'S', label: 'S (signal from Arduino)', role: 'sig', dir: 'in' }],
    pcb: '#1d4ed8',
    size: [2.4, 2.0],
  },
  button: {
    type: 'button',
    title: 'Push button module',
    blurb: 'Sends HIGH while pressed and LOW when released.',
    pins: [GND, VCC, { name: 'SIG', short: 'S', label: 'S (HIGH when pressed)', role: 'sig', dir: 'out' }],
    pcb: '#b91c1c',
    size: [2.6, 2.4],
  },
  buzzer: {
    type: 'buzzer',
    title: 'Buzzer module',
    blurb: 'Makes sound. Use tone(pin, frequency) to play notes, or HIGH for a beep.',
    pins: [GND, { name: 'SIG', short: 'S', label: 'S (signal from Arduino)', role: 'sig', dir: 'in' }],
    pcb: '#111827',
    size: [2.4, 2.2],
  },
  pir: {
    type: 'pir',
    title: 'Motion sensor (PIR)',
    blurb: 'Notices people moving. OUT goes HIGH when someone is nearby.',
    pins: [GND, { name: 'OUT', short: 'O', label: 'OUT (HIGH when motion)', role: 'sig', dir: 'out' }, VCC],
    pcb: '#15803d',
    size: [3.2, 3.2],
  },
  servo: {
    type: 'servo',
    title: 'Servo motor',
    blurb: 'Turns to an exact angle (0-180°). Use the Servo library: myServo.write(90).',
    pins: [
      { ...GND, label: 'GND (brown wire)' },
      { ...VCC, label: 'VCC (red wire, needs 5V)' },
      { name: 'SIG', short: 'S', label: 'SIG (orange wire, from Arduino)', role: 'sig', dir: 'in' },
    ],
    pcb: '#2563eb',
    size: [4.0, 2.4],
    needs5V: true,
  },
  ldr: {
    type: 'ldr',
    title: 'Light sensor',
    blurb: 'Measures light. analogRead() gives a big number in bright light and a small one in the dark.',
    pins: [GND, VCC, { name: 'AO', short: 'A', label: 'AO (analog light level)', role: 'sig', dir: 'out' }],
    pcb: '#7c3aed',
    size: [2.4, 2.2],
  },
  relay: {
    type: 'relay',
    title: 'Relay module',
    blurb: 'An electric switch for big things like a room lamp. HIGH clicks it on.',
    pins: [GND, VCC, { name: 'IN', short: 'I', label: 'IN (signal from Arduino)', role: 'sig', dir: 'in' }],
    pcb: '#0e7490',
    size: [3.4, 2.6],
    needs5V: true,
  },
  fan: {
    type: 'fan',
    title: 'Motor driver (fan)',
    blurb: 'Drives a motor. HIGH spins it; analogWrite() sets the speed.',
    pins: [GND, VCC, { name: 'IN', short: 'I', label: 'IN (speed from Arduino)', role: 'sig', dir: 'in' }],
    pcb: '#c2410c',
    size: [3.0, 2.6],
    needs5V: true,
  },
  temp: {
    type: 'temp',
    title: 'Temperature sensor',
    blurb: 'Measures temperature. Every 10 mV means 1 °C (LM35).',
    pins: [GND, VCC, { name: 'OUT', short: 'O', label: 'OUT (analog temperature)', role: 'sig', dir: 'out' }],
    pcb: '#0f766e',
    size: [2.4, 2.2],
  },
  pot: {
    type: 'pot',
    title: 'Knob (potentiometer)',
    blurb: 'Turn it to change a voltage. analogRead() gives 0 to 1023.',
    pins: [GND, { name: 'SIG', short: 'S', label: 'S (analog knob position)', role: 'sig', dir: 'out' }, VCC],
    pcb: '#4d7c0f',
    size: [2.6, 2.4],
  },
  ultrasonic: {
    type: 'ultrasonic',
    title: 'Distance sensor (HC-SR04)',
    blurb: 'Measures distance with sound echoes, like a bat. Use pulseIn() on ECHO.',
    pins: [
      VCC,
      { name: 'TRIG', short: 'T', label: 'TRIG (Arduino says "ping!")', role: 'sig', dir: 'in' },
      { name: 'ECHO', short: 'E', label: 'ECHO (pulse back to Arduino)', role: 'sig', dir: 'out' },
      GND,
    ],
    pcb: '#1e40af',
    size: [4.6, 2.2],
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
