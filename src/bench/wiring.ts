// Creating and removing jumper wires.
import { useStore, currentProject, currentMission } from '../store';
import { getWorld } from '../worlds';
import { DEVICE_SPECS } from '../devices/specs';
import { UNO_PINS } from '../sim/board-uno';
import { RAIL_HOLES, type Wire } from '../sim/circuit';
import { playPop } from '../audio/sound';

const SIGNAL_COLORS = ['#f59e0b', '#16a34a', '#2563eb', '#a855f7', '#ea580c', '#0891b2', '#db2777', '#eab308'];

function roleOf(ref: string): 'gnd' | 'power' | 'sig' {
  const [part, pin] = ref.split(':');
  if (part === 'rail') return pin.startsWith('P') ? 'power' : 'gnd';
  if (part === 'uno' || part === 'uno2') {
    const p = UNO_PINS.find((u) => u.name === pin);
    if (p?.kind === 'gnd') return 'gnd';
    if (p?.kind === 'power5' || p?.kind === 'power33') return 'power';
    return 'sig';
  }
  const world = getWorld(useStore.getState().worldId);
  const dev = world.devices.find((d) => d.id === part);
  const role = dev ? DEVICE_SPECS[dev.type].pins.find((p) => p.name === pin)?.role : undefined;
  return role === 'gnd' ? 'gnd' : role === 'vcc' ? 'power' : 'sig';
}

function colorFor(a: string, b: string, wires: Wire[]): string {
  const ra = roleOf(a);
  const rb = roleOf(b);
  if (ra === 'gnd' || rb === 'gnd') return '#1f2937';
  if (ra === 'power' || rb === 'power') return '#dc2626';
  const used = wires.filter((w) => !['#1f2937', '#dc2626'].includes(w.color)).length;
  return SIGNAL_COLORS[used % SIGNAL_COLORS.length];
}

let nextId = Date.now();

export function addWire(a: string, b: string): void {
  if (a === b) return;
  const wires = currentProject().wires;
  if (wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return;
  const wire: Wire = { id: `w${nextId++}`, a, b, color: colorFor(a, b, wires) };
  useStore.getState().setWires([...wires, wire]);
  playPop();
}

export function removeWire(id: string): void {
  useStore.getState().setWires(currentProject().wires.filter((w) => w.id !== id));
  useStore.setState({ selectedWire: null });
}

export function clearWires(): void {
  useStore.getState().setWires([]);
  useStore.setState({ selectedWire: null, pending: null });
}

export function pinClicked(ref: string): void {
  const { pending } = useStore.getState();
  if (!pending) {
    useStore.setState({ pending: ref, selectedWire: null });
  } else if (pending === ref) {
    useStore.setState({ pending: null });
  } else {
    addWire(pending, ref);
    useStore.setState({ pending: null });
  }
}

/** A free hole on a rail row, so menu-made connections don't pile onto one hole. */
export function freeRailHole(row: 'P' | 'N'): string {
  const used = new Set(currentProject().wires.flatMap((w) => [w.a, w.b]));
  for (let i = 0; i < RAIL_HOLES; i++) {
    const ref = `rail:${row}${i}`;
    if (!used.has(ref)) return ref;
  }
  return `rail:${row}0`;
}

/** Put a module from the parts box on the bench. */
export function addPart(id: string): void {
  const parts = currentProject().parts ?? [];
  if (parts.includes(id)) return;
  useStore.getState().patchProject({ parts: [...parts, id] });
  playPop();
}

/** Take a module off the bench, with its wires. */
export function removePart(id: string): void {
  const p = currentProject();
  const positions = { ...(p.positions ?? {}) };
  delete positions[id];
  useStore.getState().patchProject({
    parts: (p.parts ?? []).filter((x) => x !== id),
    wires: p.wires.filter((w) => !w.a.startsWith(`${id}:`) && !w.b.startsWith(`${id}:`)),
    positions,
  });
}

/** Remember where a module was dragged to. */
export function movePart(id: string, x: number, z: number): void {
  const p = currentProject();
  useStore.getState().patchProject({ positions: { ...(p.positions ?? {}), [id]: [x, z] } });
}

/** "Wire it for me": replace the wiring with the mission's solution wiring. */
export function autoWire(): void {
  const mission = currentMission();
  if (useStore.getState().pickParts) {
    const parts = currentProject().parts ?? [];
    useStore.getState().patchProject({ parts: [...parts, ...mission.devices.filter((d) => !parts.includes(d))] });
  }
  const wires: Wire[] = [];
  for (const [a, b] of mission.solutionWires) {
    wires.push({ id: `w${nextId++}`, a, b, color: colorFor(a, b, wires) });
  }
  useStore.getState().setWires(wires);
  useStore.setState({ pending: null, selectedWire: null });
}
