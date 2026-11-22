import { once, type Scenario } from '../scenario';

const at = once;

export const TRAFFIC_TOWN_SCENARIOS: Record<string, Scenario> = {
  railLights: { duration: 8 },
  trafficLight: { duration: 12 },
  beepingCrossing: {
    duration: 16,
    script: (t, _w, sim) => {
      if (at(t, 0.5)) sim.action('walker');
    },
  },
  pushToCross: {
    duration: 23,
    script: (t, _w, sim) => {
      if (at(t, 3.5)) sim.action('walker');
    },
  },
  countdown: { duration: 14 },
  railBarrier: {
    duration: 16,
    script: (t, _w, sim) => {
      if (at(t, 1)) sim.action('train');
    },
  },
  carParkGate: {
    duration: 16,
    script: (t, _w, sim) => {
      if (at(t, 3)) sim.action('parkCar');
    },
  },
  streetLights: {
    duration: 10,
    script: (t, w) => {
      w.hour = t < 3 ? 12 : t < 6.5 ? 16.5 : 22;
    },
  },
  emergencyStop: {
    duration: 10,
    script: (t, _w, sim) => {
      if (at(t, 4.5)) sim.action('ball');
    },
  },
};
