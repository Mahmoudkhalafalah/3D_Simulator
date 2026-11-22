import { between, once, type Scenario } from '../scenario';
import type { WorldInputs } from '../types';

const at = once;

/** Type keys on the vault keypad: each key held 0.15 s, with 0.15 s between keys. */
function typeKeys(w: WorldInputs, t: number, start: number, keys: string): boolean {
  const i = Math.floor((t - start) / 0.3);
  if (t < start || i >= keys.length) return false;
  w.keys.keypad = (t - start) % 0.3 < 0.15 ? keys[i] : null;
  return true;
}

export const LAB_SCENARIOS: Record<string, Scenario> = {
  snackCalculator: { duration: 1.5 },
  gradeRobot: { duration: 1.5 },
  loopMachine: { duration: 2 },
  binaryBracelet: { duration: 1.5 },
  binaryCounter: { duration: 10 },
  catchThief: {
    duration: 12,
    script: (t, _w, sim) => {
      if (at(t, 3)) sim.action('thief');
    },
  },
  clapLights: {
    duration: 10,
    script: (t, _w, sim) => {
      if (at(t, 1) || at(t, 3.5)) sim.action('clap');
      if (at(t, 6)) sim.action('talk');
    },
  },
  theremin: {
    duration: 6.5,
    script: (t, w) => {
      w.values.hand = t < 2 ? 100 : t < 4 ? 10 : 50;
    },
  },
  robotArm: {
    duration: 11,
    script: (t, w) => {
      w.pressed.armButton = between(t, 2.5, 2.8);
    },
  },
  vault: {
    duration: 11,
    script: (t, w) => {
      w.keys.keypad = null;
      if (!typeKeys(w, t, 2.5, '1111#')) typeKeys(w, t, 6, '1234#');
    },
  },
  rememberCode: {
    duration: 19,
    script: (t, w, sim) => {
      // wait for the screen after each step, like a kid would
      w.keys.keypad = null;
      if (!typeKeys(w, t, 2.5, '1234#')) typeKeys(w, t, 9, 'A5678#');
      if (at(t, 12.5)) sim.action('power');
      typeKeys(w, t, 14.5, '5678#');
    },
  },
  securityCamera: {
    duration: 6.5,
    script: (t, w) => {
      const pose = t < 1.5 ? [0.9, 0.5, 0] : t < 3 ? [0.1, 0.5, 0] : t < 4.5 ? [0.5, 0.9, 0] : [0.9, 0.5, 1];
      w.values['stick.x'] = pose[0];
      w.values['stick.y'] = pose[1];
      w.pressed.stick = pose[2] === 1;
    },
  },
};
