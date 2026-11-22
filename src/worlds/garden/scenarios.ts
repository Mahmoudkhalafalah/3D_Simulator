import { between, type Scenario } from '../scenario';

const at = (t: number, when: number) => between(t, when, when + 0.02);

export const GARDEN_SCENARIOS: Record<string, Scenario> = {
  thirstyPlant: {
    duration: 9,
    script: (t, _w, sim) => {
      if (at(t, 4) || at(t, 4.6)) sim.action('water');
    },
  },
  soilLight: {
    duration: 9,
    script: (t, _w, sim) => {
      if (at(t, 2.5) || at(t, 5.5)) sim.action('water');
    },
  },
  autoWater: { duration: 32 },
  weatherStation: {
    duration: 10,
    script: (t, w) => {
      if (t > 5) {
        w.temperature = 31;
        w.humidity = 80;
      }
    },
  },
  gardenScreen: {
    duration: 12,
    script: (t, w) => {
      if (t > 6) {
        w.temperature = 30;
        w.humidity = 75;
      }
    },
  },
  greenhouseScreen: { duration: 6 },
  heatAlert: {
    duration: 13,
    script: (t, w) => {
      w.temperature = t < 4 ? 15 : t < 8 ? 23 : 33;
    },
  },
  greenhouseRoof: {
    duration: 13,
    script: (t, w) => {
      w.pressed.openButton = between(t, 1, 5);
      w.pressed.closeButton = between(t, 7, 12);
    },
  },
  growLight: {
    duration: 7,
    script: (t, w) => {
      w.hour = t < 3 ? 12 : 22;
    },
  },
};
