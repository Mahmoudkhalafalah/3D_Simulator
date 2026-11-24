// The Robot Arena's play mat: walls, boxes, the black line track, the tunnel, the school
// zone, the garage and the maze. Pure geometry in centimetres, shared by the robot's
// physics (sim.ts) and the 3D scene, so what the robot "feels" is exactly what kids see.
//
// Mat coordinates: x to the right, y away from the camera, heading 0° = +x, 90° = +y.

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Wall extends Rect {
  kind: 'wall' | 'box';
  /** The box the cat can push away (Don't Crash mission) */
  removable?: boolean;
}

/** A rounded-rectangle line track: straights of length 2a joined by half circles of radius r. */
export interface Oval {
  cx: number;
  cy: number;
  a: number;
  r: number;
}

export type LayoutId = 'open' | 'square' | 'school' | 'bumper' | 'wall' | 'tunnel' | 'track' | 'maze' | 'garage' | 'playground';

export interface Layout {
  id: LayoutId;
  /** Where the robot starts (heading in degrees) */
  start: { x: number; y: number; heading: number };
  walls: Wall[];
  track?: Oval;
  tunnel?: Rect;
  school?: Rect;
  /** A finish line across the mat at this x */
  finishX?: number;
  /** The yellow line and parking box of the first mission */
  park?: Rect;
  /** A dashed square drawn on the mat (Square Dance) */
  guide?: [number, number][];
  /** Inside of the garage (its walls are in `walls`) */
  garage?: Rect;
  /** The treasure corner of the maze */
  treasure?: Rect;
}

/** The mat inside the arena's border walls. */
export const ARENA: Rect = { x1: -130, y1: -90, x2: 130, y2: 90 };

/** Width of the black line (cm) */
export const LINE_WIDTH = 3;

const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({ x1, y1, x2, y2, kind: 'wall' });

const GARAGE_WALLS = [wall(66, 30, 72, 90), wall(122, 30, 128, 90)];
const GARAGE: Rect = { x1: 72, y1: 30, x2: 122, y2: 90 };

export const LAYOUTS: Record<LayoutId, Layout> = {
  open: {
    id: 'open',
    start: { x: -100, y: 0, heading: 0 },
    walls: [],
    park: { x1: -50, y1: -28, x2: 10, y2: 28 },
  },
  square: {
    id: 'square',
    start: { x: -30, y: -40, heading: 0 },
    walls: [],
    guide: [
      [-30, -40],
      [20, -40],
      [20, 10],
      [-30, 10],
    ],
  },
  school: {
    id: 'school',
    start: { x: -112, y: 0, heading: 0 },
    walls: [],
    school: { x1: -80, y1: -32, x2: -10, y2: 32 },
    finishX: 95,
  },
  bumper: {
    id: 'bumper',
    start: { x: -20, y: -10, heading: 20 },
    walls: [],
  },
  wall: {
    id: 'wall',
    start: { x: -100, y: 0, heading: 0 },
    walls: [{ x1: 10, y1: -25, x2: 40, y2: 25, kind: 'box', removable: true }],
  },
  tunnel: {
    id: 'tunnel',
    start: { x: -112, y: 0, heading: 0 },
    walls: [],
    tunnel: { x1: -10, y1: -24, x2: 50, y2: 24 },
  },
  track: {
    id: 'track',
    start: { x: -12, y: -40, heading: 0 },
    walls: [],
    track: { cx: 0, cy: 0, a: 45, r: 40 },
  },
  maze: {
    id: 'maze',
    start: { x: -105, y: -60, heading: 0 },
    walls: [wall(-130, -32, 40, -28), wall(-40, 28, 130, 32)],
    treasure: { x1: -130, y1: 32, x2: -40, y2: 90 },
  },
  garage: {
    id: 'garage',
    start: { x: -90, y: -50, heading: 0 },
    walls: GARAGE_WALLS,
    garage: GARAGE,
  },
  playground: {
    id: 'playground',
    start: { x: -40, y: -40, heading: 0 },
    walls: [{ x1: 50, y1: -72, x2: 72, y2: -50, kind: 'box' }, { x1: 88, y1: -22, x2: 110, y2: 0, kind: 'box' }, ...GARAGE_WALLS],
    track: { cx: -40, cy: 0, a: 30, r: 40 },
    tunnel: { x1: -62, y1: -60, x2: -22, y2: -20 },
    garage: GARAGE,
  },
};

export const inRect = (r: Rect | undefined, x: number, y: number, margin = 0) =>
  !!r && x >= r.x1 + margin && x <= r.x2 - margin && y >= r.y1 + margin && y <= r.y2 - margin;

// ---------------------------------------------------------------- the line track

export const trackLength = (o: Oval) => 4 * o.a + 2 * Math.PI * o.r;

/**
 * Where a point is along the track: `s` = centimetres from the start (the middle of the
 * bottom straight, driving anticlockwise) and `d` = distance from the centre of the line.
 */
export function trackProject(o: Oval, px: number, py: number): { s: number; d: number } {
  const { cx, cy, a, r } = o;
  const L = trackLength(o);
  let best = { s: 0, d: Infinity };
  const consider = (s: number, d: number) => {
    if (d < best.d) best = { s: ((s % L) + L) % L, d };
  };
  // bottom straight, driving towards +x
  const t = Math.min(a, Math.max(-a, px - cx));
  consider(t >= 0 ? t : L + t, Math.hypot(px - (cx + t), py - (cy - r)));
  // right half circle
  if (px >= cx + a) {
    const phi = Math.atan2(py - cy, px - (cx + a));
    consider(a + (phi + Math.PI / 2) * r, Math.abs(Math.hypot(px - (cx + a), py - cy) - r));
  }
  // top straight, driving towards -x
  const u = Math.min(2 * a, Math.max(0, cx + a - px));
  consider(a + Math.PI * r + u, Math.hypot(px - (cx + a - u), py - (cy + r)));
  // left half circle
  if (px <= cx - a) {
    let phi = Math.atan2(py - cy, px - (cx - a));
    if (phi < 0) phi += 2 * Math.PI;
    consider(3 * a + Math.PI * r + (phi - Math.PI / 2) * r, Math.abs(Math.hypot(px - (cx - a), py - cy) - r));
  }
  return best;
}

/** Points along the centre of the track, for drawing it. */
export function trackPoints(o: Oval, step = 2): [number, number][] {
  const { cx, cy, a, r } = o;
  const pts: [number, number][] = [];
  const L = trackLength(o);
  for (let s = 0; s <= L + 0.01; s += step) {
    let q = s;
    if (q < a) pts.push([cx + q, cy - r]);
    else if ((q -= a) < Math.PI * r) {
      const phi = -Math.PI / 2 + q / r;
      pts.push([cx + a + r * Math.cos(phi), cy + r * Math.sin(phi)]);
    } else if ((q -= Math.PI * r) < 2 * a) pts.push([cx + a - q, cy + r]);
    else if ((q -= 2 * a) < Math.PI * r) {
      const phi = Math.PI / 2 + q / r;
      pts.push([cx - a + r * Math.cos(phi), cy + r * Math.sin(phi)]);
    } else pts.push([cx - a + (q - Math.PI * r), cy - r]);
  }
  return pts;
}

// ---------------------------------------------------------------- rays

/** Distance along a ray to a rectangle (Infinity if it misses; 0 if the ray starts inside). */
export function rayRect(ox: number, oy: number, dx: number, dy: number, r: Rect): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const [o, d, lo, hi] of [
    [ox, dx, r.x1, r.x2],
    [oy, dy, r.y1, r.y2],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < Math.max(0, tmin)) return Infinity;
  return Math.max(0, tmin);
}

/** Distance from a point inside the arena to its border walls along a ray. */
export function rayArena(ox: number, oy: number, dx: number, dy: number): number {
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (ARENA.x2 - ox) / dx);
  if (dx < -1e-9) t = Math.min(t, (ARENA.x1 - ox) / dx);
  if (dy > 1e-9) t = Math.min(t, (ARENA.y2 - oy) / dy);
  if (dy < -1e-9) t = Math.min(t, (ARENA.y1 - oy) / dy);
  return Math.max(0, t);
}
