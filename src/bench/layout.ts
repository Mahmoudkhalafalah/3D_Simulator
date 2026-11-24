// Where everything sits on the workbench (units: cm) and where each pin is in 3D.
import { UNO_PINS } from '../sim/board-uno';
import { RAIL_HOLES } from '../sim/circuit';
import { DEVICE_SPECS, type DeviceInstance } from '../devices/specs';

export type Vec3 = [number, number, number];

/** The Uno is drawn a little larger than life so its pins are easy to click. */
export const UNO_SCALE = 1.4;
export const UNO_POS: Vec3 = [0, 0, -6.2];

/** Where each Arduino sits: one in the middle, or two side by side (A left, B right). */
export function unoPos(board: number, boards: number): Vec3 {
  return boards > 1 ? [board ? 6.1 : -6.1, 0, UNO_POS[2]] : UNO_POS;
}
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

/** Rows of modules in front of the rail, packed by each module's real width. */
export function layoutModules(devices: DeviceInstance[], positions: Record<string, [number, number]> = {}): ModulePlacement[] {
  const GAP = 2.6;
  const MAX_ROW = 38;
  const rows: DeviceInstance[][] = [[]];
  let rowWidth = 0;
  for (const d of devices) {
    const w = DEVICE_SPECS[d.type].size[0];
    const row = rows[rows.length - 1];
    if (row.length && rowWidth + GAP + w > MAX_ROW) {
      rows.push([d]);
      rowWidth = w;
    } else {
      row.push(d);
      rowWidth += (row.length > 1 ? GAP : 0) + w;
    }
  }
  // Spread short rows out a little so name tags never overlap
  const out: ModulePlacement[] = [];
  let top = 3.3;
  for (const row of rows) {
    const widths = row.map((d) => DEVICE_SPECS[d.type].size[0]);
    const gap = row.length <= 2 ? GAP + 2 : GAP;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
    let x = -total / 2;
    let depth = 0;
    row.forEach((device, i) => {
      const [w, d] = DEVICE_SPECS[device.type].size;
      out.push({ device, pos: [x + w / 2, 0, top + d / 2] });
      x += widths[i] + gap;
      depth = Math.max(depth, d);
    });
    top += depth + 3.0;
  }
  // Modules the kid dragged somewhere else
  for (const p of out) {
    const saved = positions[p.device.id];
    if (saved) p.pos = [saved[0], 0, saved[1]];
  }
  return out;
}

/** Total width the camera has to fit: the rail or the widest row of modules. */
export function benchWidth(placements: ModulePlacement[], boards = 1): number {
  const modules = placements.reduce((w, p) => Math.max(w, (Math.abs(p.pos[0]) + DEVICE_SPECS[p.device.type].size[0] / 2) * 2 + 2), 0);
  return Math.max(RAIL_LENGTH + 4, modules, boards > 1 ? 24 : 0);
}

export function modulePinLocal(device: DeviceInstance, pinName: string): Vec3 {
  const spec = DEVICE_SPECS[device.type];
  const idx = spec.pins.findIndex((p) => p.name === pinName);
  const n = spec.pins.length;
  return [(idx - (n - 1) / 2) * MODULE_PIN_PITCH, MODULE_PIN_TOP, -spec.size[1] / 2 + 0.25];
}

const unoPinByName = new Map(UNO_PINS.map((p) => [p.name, p]));

/** World position (top of the pin, where a jumper wire plugs in) of any pin reference. */
export function pinPosition(ref: string, placements: ModulePlacement[], boards = 1): Vec3 | null {
  const [part, pin] = ref.split(':');
  if (part === 'uno' || part === 'uno2') {
    const p = unoPinByName.get(pin);
    if (!p) return null;
    const pos = unoPos(part === 'uno2' ? 1 : 0, boards);
    return [pos[0] + p.x * UNO_SCALE, (PCB_T + HEADER_H) * UNO_SCALE, pos[2] + p.z * UNO_SCALE];
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
  return placements.reduce((z, p) => Math.max(z, p.pos[2] + DEVICE_SPECS[p.device.type].size[1] / 2 + 1.7), 6);
}
