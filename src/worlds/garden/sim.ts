// The Smart Garden's living parts: soil that dries in the sun and gets wet from the pump
// or a watering can, a plant that wilts or drowns, and a greenhouse roof moved by a motor.
// Pure logic, shared by the app and the tests.
import type { DeviceState } from '../../devices/logic';
import { baseSense, withSense } from '../sense';
import type { MissionSetup, WorldInputs, WorldSim } from '../types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class GardenSim implements WorldSim {
  time = 0;
  /** 0 = bone dry, 1 = soaking wet */
  moisture: number;
  /** How fast the soil dries (moisture per second at 25 °C) */
  dryRate: number;
  /** Water poured with the watering can that is still soaking in */
  soaking = 0;
  /** 1 = healthy, 0 = very unhappy */
  health = 1;
  /** Greenhouse roof window: 0 = closed, 1 = fully open */
  roof = 0;
  pumpOn = false;
  pumpRuns = 0;
  flooded = false;
  waterings = 0;
  private events: string[] = [];

  constructor(setup: MissionSetup = {}) {
    this.moisture = typeof setup.moisture === 'number' ? setup.moisture : 0.55;
    this.dryRate = typeof setup.dryRate === 'number' ? setup.dryRate : 0.006;
    if (typeof setup.roof === 'number') this.roof = setup.roof;
  }

  step(dt: number, inputs: WorldInputs, states: Record<string, DeviceState>): void {
    this.time += dt;
    // Water from the watering can soaks in over about a second
    const soak = Math.min(this.soaking, 0.6 * dt);
    this.soaking -= soak;
    // The pump (behind a relay) waters the bed
    const pump = !!states.pump?.on;
    if (pump && !this.pumpOn) this.pumpRuns++;
    this.pumpOn = pump;
    const heat = 1 + Math.max(0, inputs.temperature - 25) / 10;
    this.moisture = clamp(this.moisture + soak + (pump ? 0.1 * dt : 0) - this.dryRate * heat * dt, 0, 1);
    if (this.moisture > 0.97) this.flooded = true;

    // The plant: thirsty below 18%, drowning above 95%
    const bad = this.moisture < 0.18 || this.moisture > 0.95;
    this.health = clamp(this.health + (bad ? -0.06 : 0.08) * dt, 0, 1);

    // Greenhouse roof: the L293D motor turns a screw that opens or closes the window
    const motor = states.roofMotor?.speed ?? 0;
    this.roof = clamp(this.roof + motor * 0.25 * dt, 0, 1);
  }

  sense(inputs: WorldInputs) {
    const base = baseSense(inputs);
    return withSense(base, {
      moisture: () => this.moisture,
    });
  }

  snapshot() {
    return {
      moisture: this.moisture,
      health: this.health,
      roof: this.roof,
      pumpOn: this.pumpOn,
      pumpRuns: this.pumpRuns,
      flooded: this.flooded,
      waterings: this.waterings,
    };
  }

  action(name: string): void {
    if (name === 'water') {
      this.soaking += 0.35;
      this.waterings++;
      this.events.push('pop');
    }
    if (name === 'dry') this.moisture = clamp(this.moisture - 0.3, 0, 1);
  }

  drainEvents(): string[] {
    return this.events.splice(0);
  }
}
