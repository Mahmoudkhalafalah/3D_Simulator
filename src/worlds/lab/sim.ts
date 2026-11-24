// The Secret Lab's living parts: a sneaky thief, claps and chatter for the sound sensor,
// a hand above the theremin, the robot arm's box, and the codes typed on the vault keypad.
// Pure logic, shared by the app and the tests.
import type { DeviceState } from '../../devices/logic';
import { baseSense, withSense } from '../sense';
import type { MissionSetup, WorldInputs, WorldSim } from '../types';

export type ThiefPhase = 'away' | 'sneaking' | 'searching' | 'fleeing';
export type BoxPlace = 'A' | 'carried' | 'B' | 'dropped';

export const DEFAULT_CODE = '1234';

export class LabSim implements WorldSim {
  time = 0;
  // thief
  thief: { phase: ThiefPhase; x: number; z: number; t: number; walk: number; alarmTime: number } = { phase: 'away', x: 6, z: 1.5, t: 0, walk: 0, alarmTime: 0 };
  scared = 0;
  thefts = 0;
  // sound
  private clapT = -10;
  private talkUntil = -10;
  claps = 0;
  // robot arm
  box: BoxPlace = 'A';
  boxT = 0;
  delivered = 0;
  drops = 0;
  carrySpeed = 0;
  private lastArm: number | null = null;
  /** The arm must reach its home position once before it can pick up a box */
  private armReady = false;
  // keypad vault
  typed = '';
  lastEntry = '';
  sinceEntry = 99;
  entries = 0;
  changing = false;
  newCode = '';
  private prevKey: string | null = null;
  /** Every key pressed on the keypad, newest last */
  keyLog = '';
  // power
  powerCycles = 0;
  private events: string[] = [];

  constructor(_setup: MissionSetup = {}) {}

  step(dt: number, inputs: WorldInputs, states: Record<string, DeviceState>): void {
    this.time += dt;
    this.sinceEntry += dt;
    this.stepThief(dt, states);
    this.stepArm(dt, states);
    this.stepKeypad(inputs);
  }

  private stepThief(dt: number, states: Record<string, DeviceState>) {
    const t = this.thief;
    t.t += dt;
    const alarm = (states.labAlarm?.freq ?? 0) > 0;
    switch (t.phase) {
      case 'sneaking':
        t.x -= 0.9 * dt;
        t.walk += dt * 0.6;
        if (t.x <= 2.2) Object.assign(t, { phase: 'searching', t: 0 });
        break;
      case 'searching':
        if (alarm) t.alarmTime += dt;
        if (t.alarmTime > 0.8) {
          Object.assign(t, { phase: 'fleeing', t: 0 });
          this.scared++;
          this.events.push('pop');
        } else if (t.t > 10) {
          // got away with a gadget...
          Object.assign(t, { phase: 'fleeing', t: 0 });
          this.thefts++;
        }
        break;
      case 'fleeing':
        t.x += 3 * dt;
        t.walk += dt * 1.8;
        if (t.x > 6.5) Object.assign(t, { phase: 'away', x: 6, t: 0 });
        break;
    }
  }

  private stepArm(dt: number, states: Record<string, DeviceState>) {
    const arm = states.armServo;
    if (!arm) return;
    const a = arm.angle;
    const speed = this.lastArm === null ? 0 : Math.abs(a - this.lastArm) / Math.max(dt, 1e-3);
    this.lastArm = a;
    this.boxT += dt;
    if (a > 80 && a < 100) this.armReady = true;
    if (this.box === 'A' && a < 8 && this.armReady) {
      this.box = 'carried';
      this.carrySpeed = 0;
    } else if (this.box === 'carried') {
      this.carrySpeed = Math.max(this.carrySpeed, speed);
      if (speed > 220) {
        this.box = 'dropped';
        this.boxT = 0;
        this.drops++;
        this.events.push('bump');
      } else if (a > 172) {
        this.box = 'B';
        this.boxT = 0;
        this.delivered++;
      }
    } else if ((this.box === 'B' || this.box === 'dropped') && this.boxT > 3 && a > 20) {
      this.box = 'A'; // a helper puts a new box on the pick-up pad
    }
  }

  private stepKeypad(inputs: WorldInputs) {
    const k = inputs.keys.keypad ?? null;
    if (k && k !== this.prevKey) this.keyLog = (this.keyLog + k).slice(-32);
    if (k && k !== this.prevKey) {
      if (k === 'A') {
        this.changing = true;
        this.typed = '';
      } else if (k === '*') {
        this.typed = '';
      } else if (k === '#') {
        if (this.changing) {
          if (this.typed.length >= 4) this.newCode = this.typed;
          this.changing = false;
        } else {
          this.lastEntry = this.typed;
          this.entries++;
          this.sinceEntry = 0;
        }
        this.typed = '';
      } else if (/[0-9]/.test(k)) {
        this.typed += k;
      }
    }
    this.prevKey = k;
  }

  private loudness(): number {
    const sinceClap = this.time - this.clapT;
    const clap = sinceClap >= 0 && sinceClap < 0.15 ? 1 : 0;
    const talk = this.time < this.talkUntil ? 0.25 + 0.1 * Math.sin(this.time * 23) : 0;
    return Math.max(clap, talk);
  }

  sense(inputs: WorldInputs) {
    const base = baseSense(inputs);
    return withSense(base, {
      motion: (id) => id === 'thiefSensor' && (this.thief.phase === 'searching' || (this.thief.phase === 'sneaking' && this.thief.x < 4.5)),
      sound: () => this.loudness(),
      distance: (id) => {
        if (id !== 'handSensor') return 400;
        const hand = inputs.values.hand ?? 100;
        return hand >= 95 ? 400 : hand;
      },
      light: () => 0.6,
    });
  }

  snapshot() {
    return {
      thief: this.thief.phase,
      thiefIn: this.thief.phase === 'searching',
      scared: this.scared,
      thefts: this.thefts,
      loud: this.loudness() > 0.45,
      claps: this.claps,
      box: this.box,
      delivered: this.delivered,
      drops: this.drops,
      carrySpeed: this.carrySpeed,
      typed: this.typed,
      lastEntry: this.lastEntry,
      sinceEntry: this.sinceEntry,
      entries: this.entries,
      newCode: this.newCode,
      powerCycles: this.powerCycles,
      talking: this.time < this.talkUntil,
      keyLog: this.keyLog,
    };
  }

  action(name: string): void {
    if (name === 'thief' && this.thief.phase === 'away') Object.assign(this.thief, { phase: 'sneaking', x: 6, t: 0, alarmTime: 0 });
    if (name === 'clap') {
      this.clapT = this.time;
      this.claps++;
    }
    if (name === 'talk') this.talkUntil = this.time + 2.5;
    if (name === 'power') {
      this.powerCycles++;
      this.events.push('power');
    }
  }

  drainEvents(): string[] {
    return this.events.splice(0);
  }
}
