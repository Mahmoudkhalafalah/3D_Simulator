import type { DeviceInstance } from '../devices/specs';
import type { DeviceState } from '../devices/logic';

export type ControlKind = 'time' | 'temperature' | 'visitor' | 'car' | 'knob';

export type VisitorPhase = 'away' | 'arriving' | 'waiting' | 'entering' | 'inside' | 'leaving';

export interface WorldSnapshot {
  hour: number;
  daylight: number;
  temperature: number;
  knob: number;
  carDistance: number;
  crashed: boolean;
  visitor: VisitorPhase;
  pressed: Record<string, boolean>;
  serial: string;
}

/** Tools an objective can use to check what is happening in the world. */
export interface CheckApi {
  dev(id: string): DeviceState;
  world: WorldSnapshot;
  /** True once `cond` has stayed true for `seconds` in a row */
  held(cond: boolean, seconds: number, slot?: number): boolean;
  /** How many times `cond` has switched from false to true */
  count(cond: boolean, slot?: number): number;
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
  controls: ControlKind[];
  starterCode: string;
  solutionCode: string;
  solutionWires: [string, string][];
  hints: string[];
  /** Completed in order: each one unlocks after the previous one */
  objectives: Objective[];
  /** World settings applied when the mission is opened */
  setup?: Partial<{ hour: number; temperature: number; knob: number; carDistance: number }>;
}

export interface WorldDef {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  devices: DeviceInstance[];
  missions: Mission[];
}
