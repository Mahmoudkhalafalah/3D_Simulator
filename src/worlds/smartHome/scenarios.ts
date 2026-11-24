import { between, type Scenario } from '../scenario';
import type { SmartHomeSim } from './actors';

export const SMART_HOME_SCENARIOS: Record<string, Scenario> = {
  blink: { duration: 7 },
  doorbell: {
    duration: 11,
    script: (t, _w, sim) => {
      if (between(t, 0.5, 0.52)) sim.action('visitor'); // the visitor rings the doorbell
    },
  },
  nightlight: {
    duration: 6,
    script: (t, w) => {
      w.hour = t < 3 ? 22 : 12;
    },
  },
  dimmer: {
    duration: 6,
    script: (t, w) => {
      w.values.dimmer = t < 2 ? 0.5 : t < 4 ? 1 : 0;
    },
  },
  welcome: {
    duration: 16,
    script: (t, _w, sim) => {
      if (between(t, 0.5, 0.52)) sim.action('visitor');
    },
  },
  fan: {
    duration: 8,
    script: (t, w) => {
      w.temperature = t < 1 ? 22 : t < 4 ? 31 : 23;
    },
  },
  lampswitch: {
    duration: 6,
    script: (t, w) => {
      w.pressed.lightSwitch = between(t, 1, 1.25) || between(t, 3.2, 3.45);
    },
  },
  parking: {
    duration: 10,
    script: (t, _w, sim) => {
      const home = sim as SmartHomeSim;
      if (t < 2) home.carDistance = 350 - t * 135; // drive in to 80 cm
      else if (t < 3) home.carDistance = 80;
      else if (t < 6) home.carDistance = 260; // back up, far away
      else home.carDistance = 20; // park
    },
  },
};
