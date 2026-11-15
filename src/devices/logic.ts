// How each module behaves electrically. Pure logic with no rendering, so it runs
// the same way in the browser and in tests.
import type { PinReading } from '../sim/avr-runner';
import type { DeviceType } from './specs';

/** What the 3D world needs to draw a module and the real-life thing it controls. */
export interface DeviceState {
  powered: boolean;
  /** LED brightness 0..1 */
  brightness: number;
  /** Buzzer frequency in Hz (0 = silent) */
  freq: number;
  /** Servo angle in degrees */
  angle: number;
  /** Relay closed / button pressed / motion detected */
  on: boolean;
  /** Motor speed 0..1 */
  speed: number;
  /** World time (s) of the last ultrasonic ping */
  ping: number;
  /** Voltage the sensor is sending, for display */
  volts: number;
}

export const emptyState = (): DeviceState => ({
  powered: false,
  brightness: 0,
  freq: 0,
  angle: 0,
  on: false,
  speed: 0,
  ping: -10,
  volts: 0,
});

/** What the world around a module looks like right now. */
export interface WorldSense {
  /** 0 = dark night, 1 = bright noon */
  daylight: number;
  temperature: number;
  /** Knob position 0..1 */
  knob: number;
  /** Someone is in front of the motion sensor */
  motion: boolean;
  /** Distance from the ultrasonic sensor to the nearest object, cm */
  distanceCm: number;
  pressed: (deviceId: string) => boolean;
  /** Seconds since the simulation started */
  time: number;
}

export interface DeviceCtx {
  readonly id: string;
  readonly powered: boolean;
  readonly supply: number;
  readonly world: WorldSense;
  /** What the Arduino (or a power pin) is sending to this module pin; null if nothing drives it */
  read(pin: string): PinReading | null;
  /** Drive this module's output pin with a voltage (null = let go) */
  drive(pin: string, volts: number | null): void;
  /** Listen for changes the Arduino makes on a pin (registered once in attach) */
  onEdge(pin: string, cb: (level: 0 | 1, cycles: number) => void): void;
  schedule(cb: () => void, delaySeconds: number): void;
}

export interface DeviceLogic {
  state: DeviceState;
  attach?(ctx: DeviceCtx): void;
  update(ctx: DeviceCtx, dt: number): void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
          hold = ctx.world.motion ? 2.0 : Math.max(0, hold - dt);
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
          const noise = (Math.random() - 0.5) * 0.004;
          const v = ctx.supply * clamp(0.02 + 0.96 * ctx.world.daylight + noise, 0, 1);
          state.volts = ctx.powered ? v : 0;
          ctx.drive('AO', ctx.powered ? v : null);
        },
      };

    case 'temp':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const v = clamp(ctx.world.temperature, 0, 150) * 0.01 + (Math.random() - 0.5) * 0.002;
          state.volts = ctx.powered ? v : 0;
          ctx.drive('OUT', ctx.powered ? v : null);
        },
      };

    case 'pot':
      return {
        state,
        update(ctx) {
          state.powered = ctx.powered;
          const v = ctx.supply * clamp(ctx.world.knob, 0, 1);
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
            const d = ctx.world.distanceCm;
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
  }
}
