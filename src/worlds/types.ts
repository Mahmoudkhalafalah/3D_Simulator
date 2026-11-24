import type { DeviceInstance } from '../devices/specs';
import type { DeviceState, SenseMap } from '../devices/logic';

export type VisitorPhase = 'away' | 'arriving' | 'waiting' | 'entering' | 'inside' | 'leaving';

/** Everything the player (or a test script) can change by hand. Shared by every world. */
export interface WorldInputs {
  hour: number;
  temperature: number;
  humidity: number;
  /** Named sliders: knobs (by device id), joystick axes ("stick.x"), ... (0..1 unless noted) */
  values: Record<string, number>;
  /** Buttons currently held down, by device id */
  pressed: Record<string, boolean>;
  /** The key held down on each keypad, by device id */
  keys: Record<string, string | null>;
}

export const defaultInputs = (): WorldInputs => ({ hour: 12, temperature: 24, humidity: 55, values: {}, pressed: {}, keys: {} });

/** World settings applied when a mission opens. Extra keys go to the world's own simulation. */
export interface MissionSetup {
  hour?: number;
  temperature?: number;
  humidity?: number;
  values?: Record<string, number>;
  [simKey: string]: unknown;
}

/**
 * The living part of a world: people, cars, trains, plants and weather.
 * Pure logic (no rendering), so the app and the automated tests run the same world.
 */
export interface WorldSim {
  /** Move everything forward by dt seconds. `states` are the modules' current outputs. */
  step(dt: number, inputs: WorldInputs, states: Record<string, DeviceState>): void;
  /** What every sensor module senses right now */
  sense(inputs: WorldInputs): SenseMap;
  /** World-specific values for objectives and the UI (visitor phase, soil moisture, ...) */
  snapshot(): Record<string, unknown>;
  /** Buttons in the world controls: send a visitor, drive the car, call a train ... */
  action(name: string, arg?: number): void;
  /** Sound effects that happened since the last call ('bump', 'splash', ...) */
  drainEvents?(): string[];
  /** A program was just started (Run): e.g. put the robot back on its start spot */
  onStart?(): void;
}

/** What objectives can look at: the inputs, the time of day and the world's own values. */
export type WorldSnapshot = WorldInputs & {
  daylight: number;
  serial: string;
  /** Arduino B's Serial Monitor (two-Arduino missions) */
  serial2: string;
  /** Bytes sent between the two Arduinos over TX/RX */
  link: { bytes: number; garbled: number; cleanStreak: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/** Tools an objective can use to check what is happening in the world. */
export interface CheckApi {
  dev(id: string): DeviceState;
  world: WorldSnapshot;
  /** True once `cond` has stayed true for `seconds` in a row */
  held(cond: boolean, seconds: number, slot?: number): boolean;
  /** How many times `cond` has switched from false to true */
  count(cond: boolean, slot?: number): number;
  /** Free notes an objective can keep between checks (e.g. the digits seen so far) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mem: Record<string, any>;
  /** Seconds since the previous check */
  dt: number;
}

export interface Objective {
  text: string;
  check(api: CheckApi): boolean;
}

export interface Mission {
  id: string;
  title: string;
  emoji: string;
  /** The real-life problem we are solving */
  story: string;
  /** Step-by-step instructions */
  steps: string[];
  devices: string[];
  /** Ids of the world controls shown for this mission */
  controls: string[];
  starterCode: string;
  solutionCode: string;
  /** Two-Arduino missions: the second board (Arduino B) and its code */
  boards?: 2;
  starterCode2?: string;
  solutionCode2?: string;
  solutionWires: [string, string][];
  hints: string[];
  /** Completed in order: each one unlocks after the previous one */
  objectives: Objective[];
  setup?: MissionSetup;
  /** Where the world camera looks when the mission opens */
  view?: { position: [number, number, number]; target: [number, number, number] };
  /** Course sessions this mission practises, e.g. ['L1S3', 'L1S5'] (see worlds/course.ts) */
  course?: string[];
}

type Snap = Record<string, unknown>;

/** A control in the world panel. */
export type ControlDef =
  | { type: 'time' }
  | {
      type: 'slider';
      /** 'temperature' | 'humidity', or a key of inputs.values */
      key: string;
      emoji: string;
      title: string;
      min: number;
      max: number;
      step: number;
      format(v: number): string;
    }
  | { type: 'action'; emoji: string; label: string; action: string; arg?: number; busy?: (snap: Snap) => string | null }
  | { type: 'hold'; emoji: string; title: string; buttons: { label: string; action: string; arg: number }[]; readout?: (snap: Snap) => string }
  | { type: 'joystick'; device: string; title: string }
  /** An on/off switch kept in inputs.values[key] (1 = on), e.g. a camera that follows the robot */
  | { type: 'toggle'; emoji: string; label: string; key: string }
  | { type: 'keypad'; device: string; title: string };

export interface WorldDef {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  /** Shown under the world title: how to interact with the 3D scene */
  help: string;
  devices: DeviceInstance[];
  missions: Mission[];
  controls: Record<string, ControlDef>;
  createSim(setup: MissionSetup): WorldSim;
  camera: { position: [number, number, number]; target: [number, number, number] };
}
