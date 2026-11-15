// Turns wires into electrical nets and checks the circuit for mistakes,
// explaining each problem in kid-friendly language.
import { UNO_PINS, ioName } from './board-uno';
import { DEVICE_SPECS, pinRef, type DeviceInstance } from '../devices/specs';

export interface Wire {
  id: string;
  a: string;
  b: string;
  color: string;
}

export const RAIL_HOLES = 30;
export const RAIL_PLUS = Array.from({ length: RAIL_HOLES }, (_, i) => `P${i}`);
export const RAIL_MINUS = Array.from({ length: RAIL_HOLES }, (_, i) => `N${i}`);

export interface NetInfo {
  id: number;
  refs: string[];
  /** Arduino IO pin numbers on this net */
  ios: number[];
  has5V: boolean;
  has3V3: boolean;
  hasGnd: boolean;
  hasRailPlus: boolean;
  hasRailMinus: boolean;
}

export type IssueLevel = 'error' | 'warn' | 'info';

export interface CircuitIssue {
  level: IssueLevel;
  text: string;
  /** Pins to highlight in red */
  refs: string[];
}

export interface DeviceWiring {
  /** Wired correctly for power (ignores whether the board is running) */
  powerOk: boolean;
  reversed: boolean;
  supply: number;
  wired: boolean;
}

export interface CircuitAnalysis {
  netOf: Map<string, NetInfo>;
  nets: NetInfo[];
  devices: Record<string, DeviceWiring>;
  issues: CircuitIssue[];
  shorted: boolean;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    while (p !== x) {
      const gp = this.parent.get(p)!;
      this.parent.set(x, gp);
      x = p;
      p = this.parent.get(x)!;
    }
    return x;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function allRefs(devices: DeviceInstance[]): string[] {
  return [
    ...UNO_PINS.map((p) => pinRef('uno', p.name)),
    ...RAIL_PLUS.map((p) => pinRef('rail', p)),
    ...RAIL_MINUS.map((p) => pinRef('rail', p)),
    ...devices.flatMap((d) => DEVICE_SPECS[d.type].pins.map((p) => pinRef(d.id, p.name))),
  ];
}

const boardPinByName = new Map(UNO_PINS.map((p) => [p.name, p]));

export function describeRef(ref: string, devices: DeviceInstance[]): string {
  const [part, pin] = ref.split(':');
  if (part === 'uno') return `Arduino ${boardPinByName.get(pin)?.label ?? pin}`;
  if (part === 'rail') return pin.startsWith('P') ? 'red + rail' : 'blue - rail';
  const dev = devices.find((d) => d.id === part);
  return dev ? `${dev.name} ${pin}` : ref;
}

export function analyzeCircuit(devices: DeviceInstance[], wires: Wire[]): CircuitAnalysis {
  const uf = new UnionFind();
  const refs = allRefs(devices);
  refs.forEach((r) => uf.find(r));

  // Pins connected inside the board / rail itself
  const gnds = UNO_PINS.filter((p) => p.kind === 'gnd').map((p) => pinRef('uno', p.name));
  gnds.forEach((g) => uf.union(g, gnds[0]));
  uf.union('uno:SDA', 'uno:A4');
  uf.union('uno:SCL', 'uno:A5');
  RAIL_PLUS.forEach((p) => uf.union(pinRef('rail', p), 'rail:P0'));
  RAIL_MINUS.forEach((p) => uf.union(pinRef('rail', p), 'rail:N0'));

  const known = new Set(refs);
  for (const w of wires) if (known.has(w.a) && known.has(w.b)) uf.union(w.a, w.b);

  const byRoot = new Map<string, NetInfo>();
  const netOf = new Map<string, NetInfo>();
  for (const r of refs) {
    const root = uf.find(r);
    let net = byRoot.get(root);
    if (!net) {
      net = { id: byRoot.size, refs: [], ios: [], has5V: false, has3V3: false, hasGnd: false, hasRailPlus: false, hasRailMinus: false };
      byRoot.set(root, net);
    }
    net.refs.push(r);
    netOf.set(r, net);
    const [part, pin] = r.split(':');
    if (part === 'uno') {
      const bp = boardPinByName.get(pin)!;
      if (bp.kind === 'io' && !net.ios.includes(bp.io!)) net.ios.push(bp.io!);
      if (bp.kind === 'power5') net.has5V = true;
      if (bp.kind === 'power33') net.has3V3 = true;
      if (bp.kind === 'gnd') net.hasGnd = true;
    } else if (part === 'rail') {
      if (pin.startsWith('P')) net.hasRailPlus = true;
      else net.hasRailMinus = true;
    }
  }
  const nets = [...byRoot.values()];

  const issues: CircuitIssue[] = [];
  const wiredRefs = new Set(wires.flatMap((w) => [w.a, w.b]));
  const devName = (id: string) => devices.find((d) => d.id === id)?.name ?? id;

  // Short circuits: power connected straight to ground
  let shorted = false;
  for (const net of nets) {
    if ((net.has5V || net.has3V3) && net.hasGnd) {
      shorted = true;
      issues.push({
        level: 'error',
        text: '⚡ Short circuit! Power (5V) is connected straight to GND. Remove that wire - in real life this can damage your Arduino.',
        refs: net.refs.filter((r) => wiredRefs.has(r)),
      });
    }
    if (net.has5V && net.has3V3) {
      issues.push({ level: 'error', text: '⚡ 5V and 3.3V are connected together. Keep them apart!', refs: net.refs.filter((r) => wiredRefs.has(r)) });
    }
  }

  // Serial pins
  for (const io of [0, 1]) {
    const ref = `uno:D${io}`;
    if (wiredRefs.has(ref)) {
      issues.push({ level: 'warn', text: `📡 Pin ${io} is used by the Arduino to talk to the computer (Serial). Try a different pin.`, refs: [ref] });
    }
  }

  const deviceWiring: Record<string, DeviceWiring> = {};
  const outputsByNet = new Map<NetInfo, string[]>();

  for (const d of devices) {
    const spec = DEVICE_SPECS[d.type];
    const ref = (pin: string) => pinRef(d.id, pin);
    const wired = spec.pins.some((p) => wiredRefs.has(ref(p.name)));
    const gndPin = spec.pins.find((p) => p.role === 'gnd')!;
    const vccPin = spec.pins.find((p) => p.role === 'vcc');
    const gndNet = netOf.get(ref(gndPin.name))!;
    const vccNet = vccPin ? netOf.get(ref(vccPin.name))! : null;

    const gndOk = gndNet.hasGnd;
    const vccOk = vccNet ? vccNet.has5V || vccNet.has3V3 : true;
    const reversed = !!vccNet && vccNet.hasGnd && (gndNet.has5V || gndNet.has3V3);
    const supply = vccNet ? (vccNet.has5V ? 5 : vccNet.has3V3 ? 3.3 : 0) : 5;
    deviceWiring[d.id] = { powerOk: gndOk && vccOk && !reversed && !shorted, reversed, supply, wired };

    if (!wired) {
      issues.push({ level: 'info', text: `🔌 ${d.name} (${spec.title}) is not connected yet.`, refs: [] });
      continue;
    }
    if (reversed) {
      issues.push({
        level: 'error',
        text: `🔄 ${d.name} is wired backwards! VCC must go to 5V (+) and GND to GND (-).`,
        refs: [ref(gndPin.name), ref(vccPin!.name)],
      });
      continue;
    }
    if (vccPin && !vccOk) {
      const railHint = vccNet!.hasRailPlus ? ' The red + rail is not connected to the Arduino 5V pin yet.' : '';
      issues.push({
        level: 'warn',
        text: `🔋 ${d.name} needs power: connect its ${vccPin.short} (VCC) pin to 5V or the red + rail.${railHint}`,
        refs: [ref(vccPin.name)],
      });
    }
    if (!gndOk) {
      const railHint = gndNet.hasRailMinus ? ' The blue - rail is not connected to an Arduino GND pin yet.' : '';
      const loop = d.type === 'led' || d.type === 'buzzer' ? ' Electricity needs a full loop to flow!' : '';
      issues.push({
        level: 'warn',
        text: `⏚ ${d.name} needs ground: connect its ${gndPin.short} (GND) pin to GND or the blue - rail.${railHint}${loop}`,
        refs: [ref(gndPin.name)],
      });
    }
    if (spec.needs5V && vccNet && !vccNet.has5V && vccNet.has3V3) {
      issues.push({ level: 'warn', text: `💪 ${d.name} needs 5V - 3.3V is too weak for it.`, refs: [ref(vccPin!.name)] });
    }
    for (const p of spec.pins.filter((p) => p.role === 'sig')) {
      const net = netOf.get(ref(p.name))!;
      if (net.ios.length === 0) {
        if (net.has5V || net.has3V3 || net.hasGnd) {
          issues.push({
            level: 'info',
            text: `ℹ️ ${d.name}'s ${p.name} pin goes straight to ${net.hasGnd ? 'GND' : 'power'}, so the Arduino can't ${p.dir === 'out' ? 'read' : 'control'} it.`,
            refs: [ref(p.name)],
          });
        } else {
          issues.push({
            level: 'info',
            text: `🧩 Connect ${d.name}'s ${p.name} pin to an Arduino pin${d.type === 'ldr' || d.type === 'temp' || d.type === 'pot' ? ' (an analog pin like A0)' : ''}.`,
            refs: [ref(p.name)],
          });
        }
      }
      if (p.dir === 'out') {
        const list = outputsByNet.get(net) ?? [];
        list.push(d.id);
        outputsByNet.set(net, list);
      }
    }
  }

  for (const [net, ids] of outputsByNet) {
    if (ids.length > 1) {
      issues.push({
        level: 'warn',
        text: `🗣️ ${ids.map(devName).join(' and ')} are talking on the same wire${net.ios.length ? ` (${ioName(net.ios[0])})` : ''}. Give each sensor its own Arduino pin.`,
        refs: net.refs.filter((r) => wiredRefs.has(r)),
      });
    }
  }

  return { netOf, nets, devices: deviceWiring, issues, shorted };
}
