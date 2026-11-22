// A world with no moving actors: every sensor reads straight from the player's inputs.
import type { DeviceState } from '../devices/logic';
import { baseSense } from './sense';
import type { WorldInputs, WorldSim } from './types';

export class SandboxSim implements WorldSim {
  step(_dt: number, _inputs: WorldInputs, _states: Record<string, DeviceState>): void {}
  sense(inputs: WorldInputs) {
    return baseSense(inputs);
  }
  snapshot() {
    return {};
  }
  action(): void {}
}
