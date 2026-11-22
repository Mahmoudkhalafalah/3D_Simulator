// How each module behaves electrically. Pure logic with no rendering, so it runs
// the same way in the browser and in tests.
import type { PinMode, PinReading } from '../sim/avr-runner';
import { KEYPAD_KEYS, type DeviceType } from './specs';
import { HD44780, type LcdView } from './hd44780';

/** What the 3D world needs to draw a module and the real-life thing it controls. */
export interface DeviceState {
  powered: boolean;
  /** LED brightness 0..1 */
  brightness: number;
  /** Several lights in one module: traffic light [R,Y,G], RGB [R,G,B], 7-segment [a..g] */
  levels: number[];
  /** Buzzer frequency in Hz (0 = silent) */
  freq: number;
  /** Servo angle in degrees */
  angle: number;
  /** Relay closed / button pressed / motion detected / obstacle seen */
  on: boolean;
  /** Motor speed: 0..1 for the fan, -1..1 (direction!) for the L293D motor */
  speed: number;
  /** World time (s) of the last ultrasonic ping / DHT reading */
  ping: number;
  /** Voltage the sensor is sending, for display */
  volts: number;
  /** LCD screen contents */
  display: LcdView | null;
  /** LCD rows as plain text (for objectives) */
  lines: string[];
  /** Keypad: the key being pressed */
  key: string;
}

export const emptyState = (): DeviceState => ({
  powered: false,
  brightness: 0,
  levels: [],
  freq: 0,
  angle: 0,
  on: false,
  speed: 0,
  ping: -10,
  volts: 0,
  display: null,
  lines: ['', ''],
  key: '',
});

/** What each sensor module senses right now, asked per module (by device id). */
export interface SenseMap {
  pressed(id: string): boolean;
  /** 0 = dark, 1 = bright sunlight */
  light(id: string): number;
  /** Knob position 0..1 */
  knob(id: string): number;
  temperature(id: string): number;
  /** Relative humidity in % */
  humidity(id: string): number;
  motion(id: string): boolean;
  /** Distance to the nearest object in front of an ultrasonic sensor, cm */
  distance(id: string): number;
  /** Something right in front of an IR sensor */
  obstacle(id: string): boolean;
  /** Soil moisture: 0 = bone dry, 1 = soaking wet */
  moisture(id: string): number;
  /** Loudness 0..1 */
  sound(id: string): number;
  /** Key held on a keypad, or null */
  key(id: string): string | null;
  /** Joystick position 0..1 (0.5 = centre). x: right is 1, y: up is 1 */
  axis(id: string, axis: 'x' | 'y'): number;
}

export interface WorldSense extends SenseMap {
  /** Seconds since the simulation started */
  time: number;
}

export interface DeviceCtx {
  readonly id: string;
  readonly powered: boolean;
  readonly supply: number;
  readonly world: WorldSense;
  /** What the Arduino (or a power pin) is sending to this module pin, measured over the last frame; null if nothing drives it */
  read(pin: string): PinReading | null;
  /** The level the Arduino is driving on this pin right now, or null if no Arduino output drives it */
  level(pin: string): 0 | 1 | null;
  /** Drive this module's output pin with a voltage (null = let go) */
  drive(pin: string, volts: number | null): void;
  /** Called when an Arduino output on this pin's wire goes HIGH or LOW */
  onEdge(pin: string, cb: (level: 0 | 1, cycles: number) => void): void;
  /** Called whenever an Arduino pin on this wire changes mode or level */
  onChange(pin: string, cb: (mode: PinMode, level: 0 | 1, cycles: number) => void): void;
  schedule(cb: () => void, delaySeconds: number): void;
}

/** A module on the I2C bus (SDA/SCL). Return true to acknowledge. */
export interface I2CTarget {
  address: number;
  write(byte: number): boolean;
  read?(): number;
}

export interface DeviceLogic {
  state: DeviceState;
  i2c?: I2CTarget;
  attach?(ctx: DeviceCtx): void;
  update(ctx: DeviceCtx, dt: number): void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const noise = (amount: number) => (Math.random() - 0.5) * amount;

/** Several LEDs sharing one ground pin (traffic light, RGB LED, 7-segment display). */
function multiLed(state: DeviceState, pins: string[]): DeviceLogic {
  return {
    state,
    update(ctx) {
      state.powered = ctx.powered;
      state.levels = pins.map((p) => {
        const r = ctx.read(p);
        return ctx.powered && r ? r.duty : 0;
      });
      state.brightness = Math.max(0, ...state.levels);
    },
  };
}

function lcdUpdate(state: DeviceState, hd: HD44780, ctx: DeviceCtx) {
  state.powered = ctx.powered;
  state.display = ctx.powered ? hd.view() : null;
  state.lines = state.display?.on ? hd.text() : ['', ''];
}

export function createLogic(type: DeviceType): DeviceLogic {
  const state = emptyState();
  switch (type) {
    case 'led':
      return {
        state,
        update(ctx) {
          const r = ctx.read('SIG');
          state.powered = ctx.powered;
          state.brightness = ctx.powered && r ? r.duty : 0;
        },
      };

    case 'buzzer':
      return {
        state,
        update(ctx) {
          const r = ctx.read('SIG');
          state.powered = ctx.powered;
          if (!ctx.powered || !r) state.freq = 0;
          else if (r.freqHz >= 20 && r.freqHz <= 20000) state.freq = r.freqHz;
          else state.freq = r.duty > 0.9 ? 2300 : 0; // steady HIGH: beeps like an active buzzer
        },
      };

    case 'button':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          state.on = ctx.world.pressed(ctx.id);
          ctx.drive('SIG', ctx.powered ? (state.on ? ctx.supply : 0) : null);
          state.volts = ctx.powered && state.on ? ctx.supply : 0;
        },
      };

    case 'pir': {
      let hold = 0;
      return {
        state,
        update(ctx, dt) {
          state.powered = ctx.powered;
          hold = ctx.world.motion(ctx.id) ? 2.0 : Math.max(0, hold - dt);
          state.on = ctx.powered && hold > 0;
          ctx.drive('OUT', ctx.powered ? (state.on ? ctx.supply : 0) : null);
        },
      };
    }

    case 'servo':
      return {
        state,
        update(ctx, dt) {
          const r = ctx.read('SIG');
          state.powered = ctx.powered;
          if (ctx.powered && ctx.supply >= 4.5 && r && r.pulseUs > 400 && r.pulseUs < 2600) {
            const target = clamp(((r.pulseUs - 544) / (2400 - 544)) * 180, 0, 180);
            const maxStep = 360 * dt; // about 0.17 s per 60 degrees, like an SG90
            state.angle += clamp(target - state.angle, -maxStep, maxStep);
            state.on = Math.abs(target - state.angle) > 0.5;
          } else {
            state.on = false;
          }
        },
      };

    case 'ldr':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const v = ctx.supply * clamp(0.02 + 0.96 * ctx.world.light(ctx.id) + noise(0.004), 0, 1);
          state.volts = ctx.powered ? v : 0;
          ctx.drive('AO', ctx.powered ? v : null);
        },
      };

    case 'temp':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const v = clamp(ctx.world.temperature(ctx.id), 0, 150) * 0.01 + noise(0.002);
          state.volts = ctx.powered ? v : 0;
          ctx.drive('OUT', ctx.powered ? v : null);
        },
      };

    case 'pot':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const v = ctx.supply * clamp(ctx.world.knob(ctx.id), 0, 1);
          state.volts = ctx.powered ? v : 0;
          ctx.drive('SIG', ctx.powered ? v : null);
        },
      };

    case 'relay':
      return {
        state,
        update(ctx) {
          const r = ctx.read('IN');
          state.powered = ctx.powered;
          state.on = ctx.powered && ctx.supply >= 4.5 && !!r && r.duty > 0.5;
        },
      };

    case 'fan':
      return {
        state,
        update(ctx, dt) {
          const r = ctx.read('IN');
          state.powered = ctx.powered;
          const target = ctx.powered && ctx.supply >= 4.5 && r ? r.duty : 0;
          // Motors need a little push to start, and they spin up/down smoothly
          const effective = target < 0.15 ? 0 : target;
          state.speed += (effective - state.speed) * Math.min(1, dt * 2.5);
          if (state.speed < 0.005) state.speed = 0;
        },
      };

    case 'ultrasonic': {
      let riseAt = 0;
      let busy = false;
      return {
        state,
        attach(ctx) {
          ctx.onEdge('TRIG', (level, cycles) => {
            if (!ctx.powered) return;
            if (level === 1) {
              riseAt = cycles;
              return;
            }
            const widthUs = (cycles - riseAt) / 16;
            if (widthUs < 8 || busy) return;
            busy = true;
            const d = ctx.world.distance(ctx.id);
            const echoUs = d > 400 || d < 2 ? 38000 : d * 58.3;
            state.ping = ctx.world.time;
            ctx.schedule(() => ctx.drive('ECHO', 5), 450e-6);
            ctx.schedule(() => {
              ctx.drive('ECHO', 0);
              busy = false;
            }, 450e-6 + echoUs * 1e-6);
          });
        },
        update(ctx) {
          state.powered = ctx.powered;
          if (!ctx.powered) {
            busy = false;
            ctx.drive('ECHO', null);
          }
        },
      };
    }

    case 'trafficLight':
      return multiLed(state, ['RED', 'YEL', 'GRN']);

    case 'rgbLed':
      return multiLed(state, ['RED', 'GRN', 'BLU']);

    case 'sevenSeg':
      return multiLed(state, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);

    case 'ir':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          state.on = ctx.powered && ctx.world.obstacle(ctx.id);
          ctx.drive('OUT', ctx.powered ? (state.on ? 0 : ctx.supply) : null);
        },
      };

    case 'soil':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const m = clamp(ctx.world.moisture(ctx.id), 0, 1);
          const v = ctx.supply * clamp(1.0 - 0.7 * m + noise(0.004), 0, 1);
          state.volts = ctx.powered ? v : 0;
          state.on = ctx.powered && m > 0.4; // DO says "wet"
          ctx.drive('AO', ctx.powered ? v : null);
          ctx.drive('DO', ctx.powered ? (state.on ? 0 : ctx.supply) : null);
        },
      };

    case 'dht': {
      // DHT11 one-wire protocol: the Arduino pulls DATA low for 18 ms, lets go, and the
      // sensor answers with 80 us low + 80 us high, then 40 bits (50 us low + 27/70 us high).
      let lowSince = -1;
      let busy = false;
      return {
        state,
        attach(ctx) {
          ctx.onChange('DATA', (mode, level, cycles) => {
            if (!ctx.powered || busy) return;
            if (mode === 'out' && level === 0) {
              if (lowSince < 0) lowSince = cycles;
              return;
            }
            if (lowSince < 0) return;
            const lowUs = (cycles - lowSince) / 16;
            lowSince = -1;
            if (lowUs < 800) return;
            busy = true;
            const t = clamp(ctx.world.temperature(ctx.id), 0, 50);
            const h = clamp(Math.round(ctx.world.humidity(ctx.id)), 5, 95);
            const ti = Math.floor(t);
            const td = Math.min(9, Math.round((t - ti) * 10));
            const bytes = [h, 0, ti, td];
            bytes.push(bytes.reduce((a, b) => a + b, 0) & 0xff);
            state.ping = ctx.world.time;
            let at = 30e-6;
            const pulse = (high: boolean, us: number) => {
              ctx.schedule(() => ctx.drive('DATA', high ? ctx.supply : 0), at);
              at += us * 1e-6;
            };
            pulse(false, 80);
            pulse(true, 80);
            for (const b of bytes) for (let i = 7; i >= 0; i--) {
              pulse(false, 50);
              pulse(true, (b >> i) & 1 ? 70 : 27);
            }
            pulse(false, 50);
            ctx.schedule(() => {
              ctx.drive('DATA', ctx.supply);
              busy = false;
            }, at);
          });
        },
        update(ctx) {
          state.powered = ctx.powered;
          if (!ctx.powered) {
            busy = false;
            lowSince = -1;
            ctx.drive('DATA', null);
          } else if (!busy) {
            ctx.drive('DATA', ctx.supply); // the module's pull-up resistor
          }
        },
      };
    }

    case 'lcd': {
      const hd = new HD44780();
      const bit = (ctx: DeviceCtx, pin: string) => (ctx.level(pin) === 1 ? 1 : 0);
      return {
        state,
        attach(ctx) {
          ctx.onEdge('E', (level) => {
            if (level !== 0 || !ctx.powered) return;
            const n = bit(ctx, 'D4') | (bit(ctx, 'D5') << 1) | (bit(ctx, 'D6') << 2) | (bit(ctx, 'D7') << 3);
            hd.nibble(ctx.level('RS') === 1, n);
          });
        },
        update(ctx) {
          lcdUpdate(state, hd, ctx);
        },
      };
    }

    case 'lcdI2c': {
      // PCF8574 backpack: P0 = RS, P1 = RW, P2 = E, P3 = backlight, P4-P7 = D4-D7
      const hd = new HD44780();
      let last = 0;
      return {
        state,
        i2c: {
          address: 0x27,
          write(b) {
            if (last & 0x04 && !(b & 0x04)) hd.nibble(!!(last & 0x01), last >> 4);
            hd.backlight = !!(b & 0x08);
            last = b;
            return true;
          },
          read: () => last,
        },
        update(ctx) {
          lcdUpdate(state, hd, ctx);
        },
      };
    }

    case 'motor':
      return {
        state,
        update(ctx, dt) {
          state.powered = ctx.powered;
          const en = ctx.read('EN');
          const a = ctx.read('IN1');
          const b = ctx.read('IN2');
          const fwd = !!a && a.duty > 0.5;
          const back = !!b && b.duty > 0.5;
          const dir = fwd === back ? 0 : fwd ? 1 : -1;
          const power = ctx.powered && ctx.supply >= 4.5 && en ? en.duty : 0;
          const target = power < 0.15 ? 0 : dir * power;
          state.speed += (target - state.speed) * Math.min(1, dt * 3);
          if (Math.abs(state.speed) < 0.005) state.speed = 0;
          state.on = state.speed !== 0;
        },
      };

    case 'keypad': {
      // A pressed key connects its row wire to its column wire. Whatever the Arduino
      // drives on one side appears on the other (the Keypad library drives columns LOW).
      const find = (k: string | null) => {
        if (!k) return null;
        for (let r = 0; r < 4; r++) {
          const c = KEYPAD_KEYS[r].indexOf(k);
          if (c >= 0) return { r, c };
        }
        return null;
      };
      const refresh = (ctx: DeviceCtx) => {
        const k = find(ctx.world.key(ctx.id));
        for (let i = 0; i < 4; i++) {
          const rowLink = k && k.r === i ? ctx.level(`C${k.c + 1}`) : null;
          ctx.drive(`R${i + 1}`, rowLink === null ? null : rowLink * 5);
          const colLink = k && k.c === i ? ctx.level(`R${k.r + 1}`) : null;
          ctx.drive(`C${i + 1}`, colLink === null ? null : colLink * 5);
        }
      };
      return {
        state,
        attach(ctx) {
          for (const p of ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4']) ctx.onChange(p, () => refresh(ctx));
        },
        update(ctx) {
          state.powered = true;
          state.key = ctx.world.key(ctx.id) ?? '';
          refresh(ctx);
        },
      };
    }

    case 'joystick':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const x = clamp(ctx.world.axis(ctx.id, 'x'), 0, 1);
          const y = clamp(ctx.world.axis(ctx.id, 'y'), 0, 1);
          state.on = ctx.world.pressed(ctx.id);
          ctx.drive('VRx', ctx.powered ? ctx.supply * x : null);
          ctx.drive('VRy', ctx.powered ? ctx.supply * y : null);
          ctx.drive('SW', ctx.powered && state.on ? 0 : null);
        },
      };

    case 'sound':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const loud = clamp(ctx.world.sound(ctx.id), 0, 1);
          const v = ctx.supply * clamp(0.04 + 0.9 * loud + noise(0.01), 0, 1);
          state.volts = ctx.powered ? v : 0;
          state.on = ctx.powered && loud > 0.45;
          ctx.drive('AO', ctx.powered ? v : null);
          ctx.drive('DO', ctx.powered ? (state.on ? ctx.supply : 0) : null);
        },
      };
  }
}
