// Checks mission objectives in order. Shared by the app and the automated tests.
import { emptyState, type DeviceState } from '../devices/logic';
import type { CheckApi, Mission, WorldSnapshot } from './types';

export class MissionChecker {
  private mem = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private notes: Record<string, any> = {};

  reset(): void {
    this.mem.clear();
    this.notes = {};
  }

  /**
   * Evaluate the first unfinished objective.
   * Returns its index if it was just completed, otherwise -1.
   */
  step(mission: Mission, done: boolean[], states: Record<string, DeviceState>, world: WorldSnapshot, dt: number): number {
    const index = done.indexOf(false);
    if (index < 0 || index >= mission.objectives.length) return -1;
    const mem = this.mem;
    const api: CheckApi = {
      dev: (id) => states[id] ?? emptyState(),
      world,
      mem: this.notes,
      dt,
      held(cond, seconds, slot = 0) {
        const key = `${mission.id}:${index}:h${slot}`;
        const t = cond ? (mem.get(key) ?? 0) + dt : 0;
        mem.set(key, t);
        return t >= seconds;
      },
      count(cond, slot = 0) {
        const key = `${mission.id}:${index}:c${slot}`;
        const prev = mem.get(key + 'p') ?? 0;
        let n = mem.get(key) ?? 0;
        if (cond && !prev) n++;
        mem.set(key + 'p', cond ? 1 : 0);
        mem.set(key, n);
        return n;
      },
    };
    return mission.objectives[index].check(api) ? index : -1;
  }
}
