// Arduino Uno pin map: how header pins map onto the ATmega328P ports.

export type PortName = 'B' | 'C' | 'D';

export interface McuPin {
  /** Arduino pin number (0-19, A0 = 14) */
  io: number;
  port: PortName;
  bit: number;
  adc?: number;
  pwm?: boolean;
}

export const UNO_IO: McuPin[] = [
  ...Array.from({ length: 8 }, (_, i): McuPin => ({ io: i, port: 'D', bit: i, pwm: [3, 5, 6].includes(i) })),
  ...Array.from({ length: 6 }, (_, i): McuPin => ({ io: 8 + i, port: 'B', bit: i, pwm: [9, 10, 11].includes(8 + i) })),
  ...Array.from({ length: 6 }, (_, i): McuPin => ({ io: 14 + i, port: 'C', bit: i, adc: i })),
];

export type BoardPinKind = 'io' | 'power5' | 'power33' | 'gnd' | 'none';

export interface BoardPin {
  name: string;
  /** Text shown in tooltips */
  label: string;
  kind: BoardPinKind;
  io?: number;
  /** Position on the board in cm, relative to the board centre (x right, z towards viewer) */
  x: number;
  z: number;
}

// Real Uno R3 header positions (mm from bottom-left corner), converted to cm around the board centre.
const W = 68.6;
const H = 53.3;
const pos = (xmm: number, ymm: number) => ({ x: (xmm - W / 2) / 10, z: -(ymm - H / 2) / 10 });

const top = (xmm: number) => pos(xmm, 50.8);
const bottom = (xmm: number) => pos(xmm, 2.54);

function digital(n: number, xmm: number): BoardPin {
  const pwm = [3, 5, 6, 9, 10, 11].includes(n);
  const extra = n === 0 ? ' (RX - used by Serial)' : n === 1 ? ' (TX - used by Serial)' : pwm ? ' ~PWM' : '';
  return { name: `D${n}`, label: `Pin ${n}${extra}`, kind: 'io', io: n, ...top(xmm) };
}

export const UNO_PINS: BoardPin[] = [
  // Top header, right group: D0..D7
  ...Array.from({ length: 8 }, (_, i) => digital(i, 63.5 - i * 2.54)),
  // Top header, left group: D8..D13, GND, AREF, SDA, SCL
  ...Array.from({ length: 6 }, (_, i) => digital(8 + i, 41.66 - i * 2.54)),
  { name: 'GND3', label: 'GND (ground)', kind: 'gnd', ...top(41.66 - 6 * 2.54) },
  { name: 'AREF', label: 'AREF (analog reference)', kind: 'none', ...top(41.66 - 7 * 2.54) },
  { name: 'SDA', label: 'SDA (same as A4)', kind: 'io', io: 18, ...top(41.66 - 8 * 2.54) },
  { name: 'SCL', label: 'SCL (same as A5)', kind: 'io', io: 19, ...top(41.66 - 9 * 2.54) },
  // Bottom power header
  { name: 'IOREF', label: 'IOREF (5V reference)', kind: 'power5', ...bottom(27.94 + 2.54) },
  { name: 'RESET', label: 'RESET', kind: 'none', ...bottom(27.94 + 2 * 2.54) },
  { name: '3V3', label: '3.3V power', kind: 'power33', ...bottom(27.94 + 3 * 2.54) },
  { name: '5V', label: '5V power', kind: 'power5', ...bottom(27.94 + 4 * 2.54) },
  { name: 'GND1', label: 'GND (ground)', kind: 'gnd', ...bottom(27.94 + 5 * 2.54) },
  { name: 'GND2', label: 'GND (ground)', kind: 'gnd', ...bottom(27.94 + 6 * 2.54) },
  { name: 'VIN', label: 'VIN (power in)', kind: 'power5', ...bottom(27.94 + 7 * 2.54) },
  // Bottom analog header A0..A5
  ...Array.from({ length: 6 }, (_, i): BoardPin => ({
    name: `A${i}`,
    label: `Analog pin A${i}`,
    kind: 'io',
    io: 14 + i,
    ...bottom(50.8 + i * 2.54),
  })),
];

export const UNO_SIZE = { w: W / 10, d: H / 10 };

export function ioName(io: number): string {
  return io >= 14 ? `A${io - 14}` : `D${io}`;
}
