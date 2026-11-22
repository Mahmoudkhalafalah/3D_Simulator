// Traffic Town's living parts: cars that obey the traffic light and the railway barrier,
// a pedestrian at the crossing, a train, a car visiting the car park and a child chasing
// a ball. Pure logic, shared by the app and the tests.
import type { DeviceState } from '../../devices/logic';
import { baseSense, withSense } from '../sense';
import type { MissionSetup, WorldInputs, WorldSim } from '../types';

// ---- town layout (metres). The main road runs along x; +z is towards the viewer. ----
export const LANE_Z = 1.0; // eastbound lane at +z, westbound at -z
export const CROSSING_X = 0;
export const STOP_EAST = -2.0; // where eastbound car fronts stop for the crossing
export const STOP_WEST = 2.0;
export const RAIL_X = 12;
export const RAIL_STOP_EAST = 9.6;
export const RAIL_STOP_WEST = 14.4;
export const TRAIN_LENGTH = 14;
export const TRAIN_SENSOR_Z = -16;
export const PARK_X = -8; // car park driveway
export const GATE_Z = 6.4; // car park barrier
export const GATE_SENSOR_Z = 6.6;
export const CAR_LEN = 4.0;
const CRUISE = 5;
const SPAWN_X = 27;

export interface Car {
  id: number;
  x: number;
  dir: 1 | -1;
  speed: number;
  color: string;
  wheel: number;
}

export type WalkerPhase = 'away' | 'arriving' | 'waiting' | 'crossing' | 'leaving';
export interface Walker {
  phase: WalkerPhase;
  x: number;
  z: number;
  rot: number;
  walk: number;
  t: number;
  pressing: boolean;
  safe: boolean;
}

export type ParkPhase = 'away' | 'driving' | 'turning' | 'approach' | 'waiting' | 'entering' | 'parked';
export interface ParkCar {
  phase: ParkPhase;
  x: number;
  z: number;
  rot: number;
  t: number;
  speed: number;
}

export interface Train {
  active: boolean;
  /** z of the locomotive's front; the train travels towards +z */
  z: number;
  speed: number;
  onRoad: boolean;
  safe: boolean;
}

export interface Child {
  phase: 'away' | 'pending' | 'running' | 'back';
  z: number;
  x: number;
  ballZ: number;
  t: number;
}

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#f8fafc', '#0ea5e9', '#e11d48'];

/** Read a traffic light module: which colours are lit. Off (no program) means "no signal". */
export function lightOf(st: DeviceState | undefined) {
  const [r = 0, y = 0, g = 0] = st?.levels ?? [];
  return { red: r > 0.5, yellow: y > 0.5, green: g > 0.5, off: r <= 0.5 && y <= 0.5 && g <= 0.5 };
}

export class TrafficSim implements WorldSim {
  time = 0;
  cars: Car[] = [];
  walker: Walker = { phase: 'away', x: -14, z: 3.0, rot: Math.PI / 2, walk: 0, t: 0, pressing: false, safe: true };
  train: Train = { active: false, z: -60, speed: 6, onRoad: false, safe: true };
  park: ParkCar = { phase: 'away', x: -26, z: LANE_Z, rot: Math.PI / 2, t: 0, speed: 0 };
  child: Child = { phase: 'away', z: 3.2, x: -3.5, ballZ: 3.0, t: 0 };

  safeCrossings = 0;
  unsafeCrossings = 0;
  buttonPresses = 0;
  safeTrains = 0;
  unsafeTrains = 0;
  parked = 0;
  gateHits = 0;
  emergencies = 0;
  lastReaction: number | null = null;
  private emergencyAt = -1;
  private prevPressed: Record<string, boolean> = {};
  private nextId = 1;
  private spawnTimer = { 1: 0.5, [-1]: 2.5 } as Record<number, number>;
  private traffic: boolean;
  private events: string[] = [];

  constructor(setup: MissionSetup = {}) {
    this.traffic = setup.traffic !== false;
    if (this.traffic) {
      // a few cars already on the road
      this.cars.push(this.newCar(1, -14), this.newCar(-1, 9));
    }
  }

  private newCar(dir: 1 | -1, x = -dir * SPAWN_X): Car {
    return { id: this.nextId++, x, dir, speed: CRUISE, color: COLORS[this.nextId % COLORS.length], wheel: 0 };
  }

  // ------------------------------------------------------------------ helpers
  private light(states: Record<string, DeviceState>) {
    return lightOf(states.carLight);
  }

  private barrierOpen(states: Record<string, DeviceState>, id: string) {
    const st = states[id];
    return !st || st.angle >= 60;
  }

  get pedestrianOnRoad(): boolean {
    return (this.walker.phase === 'crossing' && Math.abs(this.walker.z) < 2.6) || (this.child.phase === 'running' && Math.abs(this.child.z) < 2.6);
  }

  // ------------------------------------------------------------------ step
  step(dt: number, inputs: WorldInputs, states: Record<string, DeviceState>): void {
    this.time += dt;
    const pressed = (id: string) => !!inputs.pressed[id] || (id === 'crossButton' && this.walker.pressing) || (id === 'emergencyButton' && this.child.phase === 'running' && this.child.t < 0.3);
    for (const id of ['crossButton', 'emergencyButton']) {
      const now = pressed(id);
      if (now && !this.prevPressed[id]) {
        if (id === 'crossButton') this.buttonPresses++;
        if (id === 'emergencyButton') {
          this.emergencies++;
          this.emergencyAt = this.time;
          this.lastReaction = null;
        }
      }
      this.prevPressed[id] = now;
    }
    const light = this.light(states);
    if (this.emergencyAt >= 0 && light.red && !light.green && !light.yellow) {
      this.lastReaction = this.time - this.emergencyAt;
      this.emergencyAt = -1;
    }

    this.stepTrain(dt, states);
    this.stepCars(dt, states);
    this.stepWalker(dt, states);
    this.stepPark(dt, states);
    this.stepChild(dt, states);
  }

  private stepTrain(dt: number, states: Record<string, DeviceState>) {
    const t = this.train;
    if (!t.active) return;
    t.z += t.speed * dt;
    const onRoad = t.z >= -2.6 && t.z - TRAIN_LENGTH <= 2.6;
    if (onRoad) {
      const st = states.railBarrier;
      if (!st || st.angle > 25) {
        if (t.safe) this.events.push('horn');
        t.safe = false;
      }
    }
    if (t.onRoad && !onRoad) {
      if (t.safe) this.safeTrains++;
      else this.unsafeTrains++;
    }
    t.onRoad = onRoad;
    if (t.z - TRAIN_LENGTH > 55) t.active = false;
  }

  private stopLines(car: Car, states: Record<string, DeviceState>): number[] {
    const lines: number[] = [];
    const front = car.x + car.dir * (CAR_LEN / 2);
    const light = this.light(states);
    // Traffic light at the crossing
    const stopX = car.dir === 1 ? STOP_EAST : STOP_WEST;
    const before = (front - stopX) * car.dir < 0.05;
    if (before) {
      const dist = (stopX - front) * car.dir;
      const mustStop = light.red || (light.yellow && dist > 2.5) || this.pedestrianOnRoad;
      if (mustStop) lines.push(stopX);
    }
    // Railway barrier
    const railX = car.dir === 1 ? RAIL_STOP_EAST : RAIL_STOP_WEST;
    if ((front - railX) * car.dir < 0.05 && (!this.barrierOpen(states, 'railBarrier') || this.train.onRoad || (this.train.active && Math.abs(this.train.z) < 6))) {
      lines.push(railX);
    }
    return lines;
  }

  private stepCars(dt: number, states: Record<string, DeviceState>) {
    if (this.traffic) {
      for (const dir of [1, -1] as const) {
        this.spawnTimer[dir] -= dt;
        if (this.spawnTimer[dir] <= 0) {
          const lane = this.cars.filter((c) => c.dir === dir);
          const last = lane.reduce<Car | null>((m, c) => (!m || c.x * -dir > m.x * -dir ? c : m), null);
          if (lane.length < 5 && (!last || Math.abs(last.x + dir * SPAWN_X) > 7)) this.cars.push(this.newCar(dir));
          this.spawnTimer[dir] = 3.5 + ((this.nextId * 1.7) % 3);
        }
      }
    }
    for (const car of this.cars) {
      const front = car.x + car.dir * (CAR_LEN / 2);
      let gap = Infinity;
      for (const line of this.stopLines(car, states)) gap = Math.min(gap, (line - front) * car.dir);
      for (const other of this.cars) {
        if (other === car || other.dir !== car.dir) continue;
        const ahead = (other.x - car.x) * car.dir;
        if (ahead > 0) gap = Math.min(gap, ahead - CAR_LEN - 1.4);
      }
      // the car on its way to the car park is part of the eastbound traffic until it turns
      if (car.dir === 1 && (this.park.phase === 'driving' || this.park.phase === 'turning')) {
        const ahead = this.park.x - car.x;
        if (ahead > 0) gap = Math.min(gap, ahead - CAR_LEN - 1.4);
      }
      const want = gap === Infinity ? CRUISE : Math.max(0, Math.min(CRUISE, Math.sqrt(2 * 6 * Math.max(0, gap - 0.1))));
      car.speed += Math.max(-10 * dt, Math.min(4 * dt, want - car.speed));
      if (gap < 0.02) car.speed = Math.min(car.speed, 0);
      car.speed = Math.max(0, car.speed);
      car.x += car.dir * car.speed * dt;
      car.wheel += car.speed * dt;
    }
    this.cars = this.cars.filter((c) => Math.abs(c.x) < SPAWN_X + 2);
  }

  private stepWalker(dt: number, states: Record<string, DeviceState>) {
    const w = this.walker;
    w.t += dt;
    const light = this.light(states);
    const walkLamp = states.walkLamp;
    const mayWalk = walkLamp ? walkLamp.brightness > 0.5 : states.carLight ? light.red : true;
    switch (w.phase) {
      case 'arriving':
        w.x += 1.4 * dt;
        w.walk += dt;
        if (w.x >= 0.7) {
          Object.assign(w, { x: 0.7, phase: 'waiting', t: 0, rot: Math.PI });
        }
        break;
      case 'waiting':
        w.pressing = !!states.crossButton && w.t > 0.4 && w.t < 0.8;
        if (w.t > 1 && mayWalk) {
          w.phase = 'crossing';
          w.pressing = false;
          // Safe if the cars had a red light when the pedestrian stepped onto the road
          w.safe = !states.carLight || light.red;
          if (!w.safe) this.events.push('honk');
        } else if (w.t > 40) w.phase = 'leaving';
        break;
      case 'crossing':
        w.z -= 1.4 * dt;
        w.walk += dt;
        if (w.z <= -3.0) {
          if (w.safe) this.safeCrossings++;
          else this.unsafeCrossings++;
          Object.assign(w, { phase: 'leaving', rot: Math.PI / 2 });
        }
        break;
      case 'leaving':
        w.x += 1.4 * dt;
        w.walk += dt;
        if (w.x > 16) Object.assign(w, { phase: 'away', x: -8, z: 3.0, rot: Math.PI / 2 });
        break;
    }
  }

  private stepPark(dt: number, states: Record<string, DeviceState>) {
    const p = this.park;
    p.t += dt;
    const gateOpen = this.barrierOpen(states, 'gateBarrier');
    const gateAngle = states.gateBarrier?.angle ?? 90;
    switch (p.phase) {
      case 'driving':
        p.x += 5 * dt;
        if (p.x >= PARK_X - 2) Object.assign(p, { phase: 'turning', t: 0 });
        break;
      case 'turning': {
        // quarter turn to the right, into the driveway
        const k = Math.min(1, p.t / 1.2);
        const a = (k * Math.PI) / 2;
        p.x = PARK_X - 2 + 2 * Math.sin(a);
        p.z = LANE_Z + 2 * (1 - Math.cos(a));
        p.rot = Math.PI / 2 - a;
        if (k >= 1) Object.assign(p, { phase: 'approach', rot: 0, x: PARK_X });
        break;
      }
      case 'approach': {
        const stopFront = GATE_Z - 0.5;
        const front = p.z + CAR_LEN / 2;
        p.z += Math.min(2.5 * dt, Math.max(0, stopFront - front));
        if (stopFront - front < 0.01) Object.assign(p, { phase: 'waiting', t: 0 });
        break;
      }
      case 'waiting':
        if (gateOpen) Object.assign(p, { phase: 'entering', t: 0 });
        else if (p.t > 30) Object.assign(p, { phase: 'away' });
        break;
      case 'entering': {
        const under = p.z + CAR_LEN / 2 > GATE_Z - 0.2 && p.z - CAR_LEN / 2 < GATE_Z + 0.2;
        if (under && gateAngle < 40) {
          if (p.speed > 0) {
            this.gateHits++;
            this.events.push('bump');
          }
          p.speed = 0;
          break;
        }
        p.speed = 2.2;
        p.z += p.speed * dt;
        if (p.z > 11) {
          Object.assign(p, { phase: 'parked', t: 0 });
          this.parked++;
        }
        break;
      }
      case 'parked':
        if (p.t > 5) Object.assign(p, { phase: 'away' });
        break;
    }
  }

  private stepChild(dt: number, states: Record<string, DeviceState>) {
    const c = this.child;
    c.t += dt;
    const light = this.light(states);
    switch (c.phase) {
      case 'pending':
        // the ball rolls out while cars have a green light (the dangerous moment)
        if (!states.carLight || light.green || c.t > 12) Object.assign(c, { phase: 'running', t: 0, z: 3.2, ballZ: 3.0 });
        break;
      case 'running':
        c.ballZ = Math.max(-3.2, c.ballZ - 3.2 * dt);
        if (c.t > 0.5) c.z = Math.max(-1.6, c.z - 2.4 * dt);
        if (c.z <= -1.6 && c.t > 4) Object.assign(c, { phase: 'back', t: 0 });
        break;
      case 'back':
        c.z += 2.4 * dt;
        c.ballZ = c.z - 0.3;
        if (c.z >= 3.2) Object.assign(c, { phase: 'away' });
        break;
    }
  }

  // ------------------------------------------------------------------ sensors
  sense(inputs: WorldInputs) {
    const base = baseSense(inputs);
    return withSense(base, {
      pressed: (id) =>
        base.pressed(id) || (id === 'crossButton' && this.walker.pressing) || (id === 'emergencyButton' && this.child.phase === 'running' && this.child.t < 0.3),
      obstacle: (id) => {
        if (id !== 'trainSensor' || !this.train.active) return false;
        return this.train.z >= TRAIN_SENSOR_Z - 0.5 && this.train.z - TRAIN_LENGTH <= TRAIN_SENSOR_Z + 0.5;
      },
      distance: (id) => {
        if (id !== 'gateSensor') return 400;
        const p = this.park;
        if (!['approach', 'waiting', 'entering'].includes(p.phase)) return 400;
        const d = (GATE_SENSOR_Z - (p.z + CAR_LEN / 2)) * 100;
        return d < 2 ? 2 : d;
      },
    });
  }

  snapshot() {
    return {
      walker: this.walker.phase,
      safeCrossings: this.safeCrossings,
      unsafeCrossings: this.unsafeCrossings,
      buttonPresses: this.buttonPresses,
      trainActive: this.train.active,
      trainOnRoad: this.train.onRoad,
      safeTrains: this.safeTrains,
      unsafeTrains: this.unsafeTrains,
      parkCar: this.park.phase,
      parked: this.parked,
      gateHits: this.gateHits,
      emergencies: this.emergencies,
      lastReaction: this.lastReaction,
      childOnRoad: this.child.phase === 'running',
    };
  }

  action(name: string): void {
    if (name === 'walker' && this.walker.phase === 'away') Object.assign(this.walker, { phase: 'arriving', x: -8, z: 3.0, rot: Math.PI / 2, t: 0, safe: true });
    if (name === 'train' && !this.train.active) Object.assign(this.train, { active: true, z: -45, onRoad: false, safe: true });
    if (name === 'parkCar' && (this.park.phase === 'away' || this.park.phase === 'parked')) Object.assign(this.park, { phase: 'driving', x: -26, z: LANE_Z, rot: Math.PI / 2, t: 0, speed: 0 });
    if (name === 'ball' && this.child.phase === 'away') Object.assign(this.child, { phase: 'pending', t: 0 });
  }

  drainEvents(): string[] {
    return this.events.splice(0);
  }
}
