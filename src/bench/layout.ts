// Where everything sits on the workbench (units: cm) and where each pin is in 3D.
import { UNO_PINS } from '../sim/board-uno';
import { RAIL_HOLES } from '../sim/circuit';
import { DEVICE_SPECS, type DeviceInstance } from '../devices/specs';

export type Vec3 = [number, number, number];

/** The Uno is drawn a little larger than life so its pins are easy to click. */
export const UNO_SCALE = 1.4;
export const UNO_POS: Vec3 = [0, 0, -6.2];
export const PCB_T = 0.16;
export const HEADER_H = 0.85;

export const RAIL_POS: Vec3 = [0, 0, 1.0];
export const RAIL_PITCH = 0.42;
export const RAIL_H = 0.8;
export const RAIL_ROW_DZ = 0.34;

export const MODULE_PIN_PITCH = 0.5;
export const MODULE_BASE_Y = 0.25;
export const MODULE_PIN_TOP = 1.25;

export function railHoleX(i: number): number {
  const group = Math.floor(i / 5);
  const total = RAIL_HOLES + Math.floor((RAIL_HOLES - 1) / 5);
  return (i + group - (total - 1) / 2) * RAIL_PITCH;
}

export const RAIL_LENGTH = (RAIL_HOLES + Math.floor((RAIL_HOLES - 1) / 5)) * RAIL_PITCH + 0.8;

export interface ModulePlacement {
  device: DeviceInstance;
  pos: Vec3;
}

export function layoutModules(devices: DeviceInstance[]): ModulePlacement[] {
  const n = devices.length;
  const rows = Math.max(1, Math.ceil(n / 7));
  const perRow = Math.ceil(n / rows);
  return devices.map((device, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - row * perRow);
    const col = i % perRow;
    const spacing = inRow <= 2 ? 7 : 5.6;
    return { device, pos: [(col - (inRow - 1) / 2) * spacing, 0, 4.6 + row * 5.6] };
  });
}

/** Total width the camera has to fit: the rail or the widest row of modules. */
export function benchWidth(placements: ModulePlacement[]): number {
  const modules = placements.reduce((w, p) => Math.max(w, Math.abs(p.pos[0]) * 2 + 5), 0);
  return Math.max(RAIL_LENGTH + 4, modules);
}

export function modulePinLocal(device: DeviceInstance, pinName: string): Vec3 {
  const spec = DEVICE_SPECS[device.type];
  const idx = spec.pins.findIndex((p) => p.name === pinName);
  const n = spec.pins.length;
  return [(idx - (n - 1) / 2) * MODULE_PIN_PITCH, MODULE_PIN_TOP, -spec.size[1] / 2 + 0.25];
}

const unoPinByName = new Map(UNO_PINS.map((p) => [p.name, p]));

/** World position (top of the pin, where a jumper wire plugs in) of any pin reference. */
export function pinPosition(ref: string, placements: ModulePlacement[]): Vec3 | null {
  const [part, pin] = ref.split(':');
  if (part === 'uno') {
    const p = unoPinByName.get(pin);
    if (!p) return null;
    return [UNO_POS[0] + p.x * UNO_SCALE, (PCB_T + HEADER_H) * UNO_SCALE, UNO_POS[2] + p.z * UNO_SCALE];
  }
  if (part === 'rail') {
    const i = Number(pin.slice(1));
    const dz = pin[0] === 'P' ? -RAIL_ROW_DZ : RAIL_ROW_DZ;
    return [RAIL_POS[0] + railHoleX(i), RAIL_H, RAIL_POS[2] + dz];
  }
  const m = placements.find((pl) => pl.device.id === part);
  if (!m) return null;
  const local = modulePinLocal(m.device, pin);
  return [m.pos[0] + local[0], local[1], m.pos[2] + local[2]];
}

export function benchDepth(placements: ModulePlacement[]): number {
  return placements.reduce((z, p) => Math.max(z, p.pos[2] + 3), 6);
}
