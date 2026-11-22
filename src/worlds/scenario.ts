import type { WorldInputs, WorldSim } from './types';

/** A scripted play-through used by the automated tests to check a mission's solution. */
export interface Scenario {
  /** Simulated seconds */
  duration: number;
  /** Called 60 times per simulated second: change inputs, press buttons, trigger actions */
  script?(t: number, inputs: WorldInputs, sim: WorldSim): void;
  /** Text typed into the Serial Monitor at the given times */
  serial?: [number, string][];
  /** Times when the board is switched off and on again (EEPROM is kept) */
  powerCycles?: number[];
}

export const between = (t: number, a: number, b: number) => t >= a && t < b;
