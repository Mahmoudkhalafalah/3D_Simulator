// Default sensor readings, built from the player's inputs. Worlds override the
// sensors their actors affect (the car in front of the parking sensor, the train ...).
import type { SenseMap } from '../devices/logic';
import type { WorldInputs } from './types';

/** 0 at night, 1 in bright daylight. */
export function daylight(hour: number): number {
  const s = Math.sin(((hour - 6) / 12) * Math.PI);
  return Math.min(1, Math.max(0, s * 1.4));
}

export function baseSense(inputs: WorldInputs): SenseMap {
  const v = inputs.values;
  return {
    pressed: (id) => !!inputs.pressed[id],
    light: () => daylight(inputs.hour),
    knob: (id) => v[id] ?? 0.5,
    temperature: () => inputs.temperature,
    humidity: () => inputs.humidity,
    motion: () => false,
    distance: () => 400,
    obstacle: () => false,
    moisture: (id) => v[id] ?? 0.5,
    sound: (id) => v[id] ?? 0,
    key: (id) => inputs.keys[id] ?? null,
    axis: (id, axis) => v[`${id}.${axis}`] ?? 0.5,
    line: () => false,
  };
}

/** Override some sensors of a base map. */
export function withSense(base: SenseMap, over: Partial<SenseMap>): SenseMap {
  return { ...base, ...over };
}

/** Buttons as the world sees them: pressed by the player OR by someone in the world (a visitor ringing the bell...). */
export function pressedNow(devices: { id: string; type: string }[], inputs: WorldInputs, sense: SenseMap | null): Record<string, boolean> {
  const out = { ...inputs.pressed };
  if (sense) for (const d of devices) if (d.type === 'button' || d.type === 'joystick') out[d.id] = sense.pressed(d.id);
  return out;
}
