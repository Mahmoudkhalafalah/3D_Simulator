import { between, once, type Scenario } from '../scenario';
import type { RobotSim } from './sim';

/** Steer with the joystick like a kid would: turn towards the next point, then push forward. */
function driver() {
  const route: [number, number][] = [
    [97, -8],
    [97, 62],
  ];
  let leg = 0;
  return (t: number, values: Record<string, number>, r: RobotSim) => {
    if (t < 1 / 120) leg = 0;
    const [tx, ty] = route[leg];
    const dist = Math.hypot(tx - r.x, ty - r.y);
    const last = leg === route.length - 1;
    if (dist < 6) {
      if (!last) leg++;
      values['remote.x'] = 0.5;
      values['remote.y'] = 0.5;
      return;
    }
    let err = Math.atan2(ty - r.y, tx - r.x) - r.heading;
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    if (Math.abs(err) > 0.3) {
      values['remote.x'] = err > 0 ? 0 : 1; // spin on the spot
      values['remote.y'] = 0.5;
    } else {
      values['remote.x'] = 0.5 - Math.max(-0.18, Math.min(0.18, err * 1.5));
      values['remote.y'] = dist < 25 ? 0.75 : 1;
    }
  };
}

const drive = driver();

export const ROBOT_SCENARIOS: Record<string, Scenario> = {
  wakeUp: { duration: 6 },
  squareDance: { duration: 15 },
  bumperCar: { duration: 36 },
  headlights: { duration: 14 },
  dontCrash: {
    duration: 16,
    script: (t, _w, sim) => {
      if (once(t, 7)) sim.action('box'); // the cat pushes the box away
    },
  },
  lineFollower: { duration: 42 },
  schoolZone: { duration: 14 },
  lookBothWays: { duration: 50 },
  remoteControl: {
    duration: 30,
    script: (t, w, sim) => {
      w.pressed.remote = between(t, 0.5, 1);
      if (t < 1.5) return;
      drive(t, w.values, sim as RobotSim);
    },
  },
};
