// The Robot Arena's living part: a two-wheeled robot car driven by two L293D motor
// drivers, bumping into walls, following lines and looking around with its ultrasonic
// "eyes". Pure logic, shared by the app and the automated tests.
import type { DeviceState } from '../../devices/logic';
import { baseSense, daylight, withSense } from '../sense';
import type { MissionSetup, WorldInputs, WorldSim } from '../types';
import { ARENA, LAYOUTS, LINE_WIDTH, inRect, rayArena, rayRect, trackLength, trackProject, type Layout, type LayoutId, type Wall } from './arena';

/** Wheel speed at full power (cm/s), like a small TT-motor robot kit */
export const VMAX = 32;
/** Distance between the two wheels (cm) */
export const WHEEL_BASE = 13;
/** The robot's body for bumping into things: a circle of radius R, C cm ahead of the wheels */
const BODY_R = 10;
const BODY_C = 1.5;
/** Front of the bumper, the ultrasonic sensor and the line sensors, measured from the wheels' axle */
export const FRONT = 11.5;
export const EYE = 9;
export const LINE_AHEAD = 9;
export const LINE_SIDE = 3;
/** Small gap that still counts as touching (the bumper stays pressed against a wall) */
const TOUCH = 0.25;
/** Ultrasonic sensors see a cone of about ±8°, not a thin laser line */
const CONE = [-8, 0, 8].map((d) => (d * Math.PI) / 180);

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

export class RobotSim implements WorldSim {
  layout: Layout;
  time = 0;
  /** Position of the middle of the wheel axle (cm) and heading (radians, 0 = +x) */
  x = 0;
  y = 0;
  heading = 0;
  /** Wheel speeds (cm/s) and the robot's forward speed and turning speed */
  wl = 0;
  wr = 0;
  v = 0;
  w = 0;
  odometer = 0;
  turned = 0;
  // bumping
  bumper = false;
  touching = false;
  bumps = 0;
  sinceBump = 99;
  crashes = 0;
  backedUp = 0;
  bounces = 0;
  private bounceCounted = true;
  // square dance
  sides = 0;
  goodTurns = 0;
  lastTurn = 0;
  private turnAcc = 0;
  private turning = false;
  private runAcc = 0;
  private runCounted = false;
  // school zone
  zoneEntered = false;
  zoneMax = 0;
  zonePassed = false;
  fastAfter = 0;
  speeding = false;
  // line track
  progress = 0;
  bestProgress = 0;
  offTrack = false;
  private lastS = -1;
  // the cat's box
  boxPresent = true;
  boxGoneAt = -1;
  /** Where the eyes look: 90 = straight ahead (the head servo's angle) */
  eyeAngle = 90;
  lookedLeft = false;
  lookedRight = false;
  /** The robot's path on the mat, as x,y pairs */
  trail: number[] = [];
  /** Changes every time the robot is put back on the start (the 3D trail starts again) */
  resets = 0;
  private hour = 12;
  private events: string[] = [];

  constructor(setup: MissionSetup = {}) {
    const id = (typeof setup.layout === 'string' ? setup.layout : 'open') as LayoutId;
    this.layout = LAYOUTS[id] ?? LAYOUTS.open;
    this.reset();
  }

  /** Put the robot back on its start spot and clear the scores. */
  reset(): void {
    const s = this.layout.start;
    Object.assign(this, {
      time: 0,
      x: s.x,
      y: s.y,
      heading: rad(s.heading),
      wl: 0,
      wr: 0,
      v: 0,
      w: 0,
      odometer: 0,
      turned: 0,
      bumper: false,
      touching: false,
      bumps: 0,
      sinceBump: 99,
      crashes: 0,
      backedUp: 0,
      bounces: 0,
      bounceCounted: true,
      sides: 0,
      goodTurns: 0,
      lastTurn: 0,
      turnAcc: 0,
      turning: false,
      runAcc: 0,
      runCounted: false,
      zoneEntered: false,
      zoneMax: 0,
      zonePassed: false,
      fastAfter: 0,
      speeding: false,
      progress: 0,
      bestProgress: 0,
      offTrack: false,
      lastS: -1,
      boxPresent: true,
      boxGoneAt: -1,
      lookedLeft: false,
      lookedRight: false,
      trail: [s.x, s.y],
    });
    this.resets++;
  }

  onStart(): void {
    this.reset();
  }

  get walls(): Wall[] {
    return this.layout.walls.filter((w) => !(w.removable && !this.boxPresent));
  }

  private dir(extra = 0): [number, number] {
    return [Math.cos(this.heading + extra), Math.sin(this.heading + extra)];
  }

  /** A point on the robot: `ahead` cm forward of the axle and `left` cm to its left. */
  point(ahead: number, left = 0): [number, number] {
    const [c, s] = this.dir();
    return [this.x + ahead * c - left * s, this.y + ahead * s + left * c];
  }

  /** Distance from (ox, oy) along a direction to the nearest wall or box. */
  ray(ox: number, oy: number, angle: number): number {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let t = rayArena(ox, oy, dx, dy);
    for (const w of this.walls) t = Math.min(t, rayRect(ox, oy, dx, dy, w));
    return t;
  }

  /** What the ultrasonic eyes measure right now (cm). */
  measure(): number {
    const [ox, oy] = this.point(EYE);
    const look = this.heading + rad(this.eyeAngle - 90);
    return Math.min(...CONE.map((c) => this.ray(ox, oy, look + c)));
  }

  /** Gap between the front of the bumper and whatever is straight ahead (cm). */
  frontGap(): number {
    const [ox, oy] = this.point(FRONT);
    return this.ray(ox, oy, this.heading);
  }

  /** Is this line sensor above the black line? */
  onLine(side: 'left' | 'right'): boolean {
    const t = this.layout.track;
    if (!t) return false;
    const [px, py] = this.point(LINE_AHEAD, side === 'left' ? LINE_SIDE : -LINE_SIDE);
    return trackProject(t, px, py).d < LINE_WIDTH / 2;
  }

  /** Light on top of the robot: daylight, except inside the tunnel. */
  light(): number {
    const day = daylight(this.hour);
    const t = this.layout.tunnel;
    const [px, py] = this.point(2);
    if (!t || !inRect(t, px, py)) return day;
    const depth = Math.min(px - t.x1, t.x2 - px);
    return day * (depth > 8 ? 0.04 : 1 - (0.96 * depth) / 8);
  }

  inTunnel(): boolean {
    const [px, py] = this.point(2);
    return inRect(this.layout.tunnel, px, py);
  }

  /** Push the body out of walls and boxes. Returns the directions of everything it touches. */
  private collide(): [number, number][] {
    const contacts: [number, number][] = [];
    const [c, s] = this.dir();
    let cx = this.x + BODY_C * c;
    let cy = this.y + BODY_C * s;
    const push = (dx: number, dy: number) => {
      this.x += dx;
      this.y += dy;
      cx += dx;
      cy += dy;
    };
    // the border walls: [how far inside the wall the body is, push x, push y, direction of the wall]
    const borders: [number, number, number, number, number][] = [
      [ARENA.x1 - (cx - BODY_R), 1, 0, -1, 0],
      [cx + BODY_R - ARENA.x2, -1, 0, 1, 0],
      [ARENA.y1 - (cy - BODY_R), 0, 1, 0, -1],
      [cy + BODY_R - ARENA.y2, 0, -1, 0, 1],
    ];
    for (const [depth, px, py, nx, ny] of borders) {
      if (depth <= -TOUCH) continue;
      contacts.push([nx, ny]);
      if (depth > 0) push(px * depth, py * depth);
    }
    // walls and boxes on the mat
    for (const w of this.walls) {
      const qx = Math.min(w.x2, Math.max(w.x1, cx));
      const qy = Math.min(w.y2, Math.max(w.y1, cy));
      const dx = cx - qx;
      const dy = cy - qy;
      const d = Math.hypot(dx, dy);
      if (d >= BODY_R + TOUCH) continue;
      if (d > 1e-6) {
        contacts.push([-dx / d, -dy / d]);
        if (d < BODY_R) push((dx / d) * (BODY_R - d), (dy / d) * (BODY_R - d));
      } else {
        // the centre is inside the box: leave by the nearest side
        const out = [
          [w.x1 - BODY_R - cx, 0, -1, 0],
          [w.x2 + BODY_R - cx, 0, 1, 0],
          [0, w.y1 - BODY_R - cy, 0, -1],
          [0, w.y2 + BODY_R - cy, 0, 1],
        ].sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]))[0];
        push(out[0], out[1]);
        contacts.push([-out[2], -out[3]]);
      }
    }
    return contacts;
  }

  step(dt: number, inputs: WorldInputs, states: Record<string, DeviceState>): void {
    this.time += dt;
    this.hour = inputs.hour;
    this.sinceBump += dt;
    const neck = states.neck;
    this.eyeAngle = neck?.powered ? neck.angle : 90;
    if (this.eyeAngle > 150) this.lookedLeft = true;
    if (this.eyeAngle < 30) this.lookedRight = true;

    this.wl = (states.leftMotor?.speed ?? 0) * VMAX;
    this.wr = (states.rightMotor?.speed ?? 0) * VMAX;
    this.v = (this.wl + this.wr) / 2;
    this.w = (this.wr - this.wl) / WHEEL_BASE;

    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    let bumper = false;
    let touching = false;
    let hitSpeed = 0;
    for (let i = 0; i < n; i++) {
      const px = this.x;
      const py = this.y;
      this.heading += this.w * h;
      const [c, s] = this.dir();
      this.x += this.v * c * h;
      this.y += this.v * s * h;
      for (const [nx, ny] of this.collide()) {
        touching = true;
        const facing = nx * c + ny * s; // 1 = the wall is straight ahead
        if (facing > 0.45) bumper = true; // the bumper bar covers the whole front
        hitSpeed = Math.max(hitSpeed, this.v * facing);
      }
      const moved = Math.hypot(this.x - px, this.y - py);
      this.odometer += moved;
      if (this.v < -1) this.backedUp += moved;
    }
    this.turned += Math.abs(this.w * dt);

    // Bumps: a crash is hitting something while driving into it
    if (touching && !this.touching && hitSpeed > 8) {
      this.crashes++;
      this.events.push('bump');
    }
    this.touching = touching;
    if (bumper && !this.bumper) {
      this.bumps++;
      this.sinceBump = 0;
      this.backedUp = 0;
      this.bounceCounted = false;
    }
    this.bumper = bumper;
    if (!this.bounceCounted && this.backedUp >= 8) {
      this.bounces++;
      this.bounceCounted = true;
    }

    this.trackMoves(dt);
    this.trackZones();
    const [lx, ly] = [this.trail[this.trail.length - 2], this.trail[this.trail.length - 1]];
    if (Math.hypot(this.x - lx, this.y - ly) > 1.5) {
      this.trail.push(this.x, this.y);
      if (this.trail.length > 3000) this.trail.splice(0, 2);
    }
  }

  /** Straight runs and on-the-spot turns (Square Dance). */
  private trackMoves(dt: number): void {
    const turningNow = Math.abs(this.w) > 0.4;
    if (turningNow) {
      this.turnAcc += this.w * dt;
      this.turning = true;
    } else if (this.turning) {
      this.lastTurn = deg(Math.abs(this.turnAcc));
      if (this.lastTurn >= 65 && this.lastTurn <= 115) this.goodTurns++;
      this.turnAcc = 0;
      this.turning = false;
    }
    if (Math.abs(this.v) > 4 && !turningNow) {
      this.runAcc += Math.abs(this.v) * dt;
      if (!this.runCounted && this.runAcc >= 35) {
        this.sides++;
        this.runCounted = true;
      }
    } else if (Math.abs(this.v) < 2 || turningNow) {
      this.runAcc = 0;
      this.runCounted = false;
    }
  }

  private trackZones(): void {
    const L = this.layout;
    const speed = Math.abs(this.v) / VMAX;
    if (L.school) {
      if (inRect(L.school, this.x, this.y)) {
        this.zoneEntered = true;
        this.zoneMax = Math.max(this.zoneMax, speed);
        if (speed > 0.55 && !this.speeding) {
          this.speeding = true;
          this.events.push('flash');
        }
      } else if (this.zoneEntered && this.x > L.school.x2) {
        this.zonePassed = true;
        this.fastAfter = Math.max(this.fastAfter, speed);
      }
    }
    if (L.track) {
      const [px, py] = this.point(LINE_AHEAD);
      const { s, d } = trackProject(L.track, px, py);
      const len = trackLength(L.track);
      if (d > 14) {
        this.offTrack = true;
        this.progress = 0;
        this.lastS = -1;
      } else if (d < 6) {
        this.offTrack = false;
        if (this.lastS >= 0) {
          let ds = s - this.lastS;
          if (ds > len / 2) ds -= len;
          if (ds < -len / 2) ds += len;
          this.progress += ds;
          this.bestProgress = Math.max(this.bestProgress, this.progress);
        }
        this.lastS = s;
      }
    }
  }

  sense(inputs: WorldInputs) {
    return withSense(baseSense(inputs), {
      pressed: (id) => (id === 'bumper' ? this.bumper : !!inputs.pressed[id]),
      distance: () => this.measure(),
      line: (id) => this.onLine(id === 'lineLeft' ? 'left' : 'right'),
      light: () => this.light(),
    });
  }

  snapshot() {
    const start = this.layout.start;
    return {
      layout: this.layout.id,
      robot: { x: this.x, y: this.y, heading: deg(this.heading), v: this.v, w: this.w, speed: Math.abs(this.v) / VMAX },
      stopped: Math.abs(this.wl) < 0.3 && Math.abs(this.wr) < 0.3,
      odometer: this.odometer,
      turned: deg(this.turned),
      bumper: this.bumper,
      bumps: this.bumps,
      sinceBump: this.sinceBump,
      bounces: this.bounces,
      crashes: this.crashes,
      sides: this.sides,
      goodTurns: this.goodTurns,
      lastTurn: this.lastTurn,
      startDist: Math.hypot(this.x - start.x, this.y - start.y),
      inZone: inRect(this.layout.school, this.x, this.y),
      zoneEntered: this.zoneEntered,
      zoneMax: this.zoneMax,
      zonePassed: this.zonePassed,
      fastAfter: this.fastAfter,
      speeding: this.speeding,
      inTunnel: this.inTunnel(),
      progress: this.progress,
      bestProgress: this.bestProgress,
      lapLength: this.layout.track ? trackLength(this.layout.track) : 0,
      offTrack: this.offTrack,
      boxPresent: this.boxPresent,
      boxGoneFor: this.boxGoneAt < 0 ? 0 : this.time - this.boxGoneAt,
      frontGap: this.frontGap(),
      eyeAngle: this.eyeAngle,
      lookedLeft: this.lookedLeft,
      lookedRight: this.lookedRight,
      inPark: inRect(this.layout.park, this.x, this.y, 6),
      inGarage: inRect(this.layout.garage, this.x, this.y, 6),
      treasure: inRect(this.layout.treasure, this.x, this.y, 10),
    };
  }

  action(name: string): void {
    if (name === 'reset') this.reset();
    if (name === 'box' && this.boxPresent) {
      this.boxPresent = false;
      this.boxGoneAt = this.time;
      this.events.push('pop');
    }
  }

  drainEvents(): string[] {
    return this.events.splice(0);
  }
}
