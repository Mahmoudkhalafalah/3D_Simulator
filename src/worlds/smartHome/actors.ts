// The Smart House's living parts: the visitor at the front door and the car in the
// garage. Pure logic, shared by the app and tests.
import type { DeviceState } from '../../devices/logic';
import { baseSense, withSense } from '../sense';
import type { MissionSetup, VisitorPhase, WorldInputs, WorldSim } from '../types';

export const DOOR_X = -2;
export const PORCH_Z = 2.95;
export const STREET_Z = 10;

export interface VisitorState {
  phase: VisitorPhase;
  x: number;
  z: number;
  rot: number;
  t: number;
  walk: number;
  ringing: boolean;
}

export const newVisitor = (): VisitorState => ({ phase: 'away', x: DOOR_X, z: STREET_Z, rot: Math.PI, t: 0, walk: 0, ringing: false });

export function sendVisitor(v: VisitorState): void {
  if (v.phase !== 'away') return;
  Object.assign(v, { phase: 'arriving', x: DOOR_X, z: STREET_Z, rot: Math.PI, t: 0, ringing: false });
}

/** Is the visitor in front of the motion sensor above the door? */
export function visitorMotion(v: VisitorState): boolean {
  if (v.phase === 'waiting') return true;
  if (v.phase === 'arriving' || v.phase === 'leaving') return v.z < 6.5;
  if (v.phase === 'entering') return v.z > 1.6;
  return false;
}

export function stepVisitor(v: VisitorState, dt: number, doorAngle: number): void {
  v.t += dt;
  switch (v.phase) {
    case 'arriving':
      v.z -= 1.4 * dt;
      v.walk += dt;
      if (v.z <= PORCH_Z) {
        v.z = PORCH_Z;
        v.phase = 'waiting';
        v.t = 0;
      }
      break;
    case 'waiting':
      v.ringing = v.t > 0.8 && v.t < 1.4;
      if (doorAngle > 60 && v.t > 0.3) {
        v.phase = 'entering';
        v.ringing = false;
      } else if (v.t > 9) {
        v.phase = 'leaving';
        v.ringing = false;
        v.rot = 0;
      }
      break;
    case 'entering':
      v.z -= 1.2 * dt;
      v.walk += dt;
      if (v.z <= 0.2) {
        v.phase = 'inside';
        v.t = 0;
      }
      break;
    case 'inside':
      if (v.t > 3) Object.assign(v, { phase: 'away', z: STREET_Z, rot: Math.PI });
      break;
    case 'leaving':
      v.z += 1.4 * dt;
      v.walk += dt;
      if (v.z >= STREET_Z) Object.assign(v, { phase: 'away', rot: Math.PI });
      break;
  }
}

export class SmartHomeSim implements WorldSim {
  visitor = newVisitor();
  carDistance = 350;
  carDrive = 0;
  crashed = false;
  crashedAt = -10;
  time = 0;
  private events: string[] = [];

  constructor(setup: MissionSetup = {}) {
    if (typeof setup.carDistance === 'number') this.carDistance = setup.carDistance;
  }

  step(dt: number, _inputs: WorldInputs, states: Record<string, DeviceState>): void {
    this.time += dt;
    if (this.carDrive !== 0) {
      let d = this.carDistance - this.carDrive * 70 * dt;
      if (d <= 3) {
        d = 3;
        if (!this.crashed) {
          this.crashed = true;
          this.crashedAt = this.time;
          this.events.push('bump');
        }
      }
      this.carDistance = Math.min(400, d);
    }
    if (this.crashed && this.carDistance > 12) this.crashed = false;
    stepVisitor(this.visitor, dt, states.door?.angle ?? 0);
  }

  sense(inputs: WorldInputs) {
    const base = baseSense(inputs);
    return withSense(base, {
      pressed: (id) => base.pressed(id) || (id === 'doorbell' && this.visitor.ringing),
      motion: (id) => id === 'motion' && visitorMotion(this.visitor),
      distance: (id) => (id === 'parking' ? this.carDistance : 400),
    });
  }

  snapshot() {
    return { visitor: this.visitor.phase, carDistance: this.carDistance, crashed: this.crashed };
  }

  action(name: string, arg = 0): void {
    if (name === 'visitor') sendVisitor(this.visitor);
    if (name === 'car') this.carDrive = arg;
  }

  drainEvents(): string[] {
    return this.events.splice(0);
  }
}
