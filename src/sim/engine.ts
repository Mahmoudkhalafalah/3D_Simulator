// The simulation engine: one Arduino, a set of modules and the wires between them.
// Each frame it lets modules sense the world, feeds their signals to the chip,
// runs the chip for the elapsed time, and measures what the chip did.
import type { TWIEventHandler } from 'avr8js';
import { AVRRunner, CLOCK_HZ, type PinReading } from './avr-runner';
import { analyzeCircuit, type CircuitAnalysis, type NetInfo, type Wire } from './circuit';
import { createLogic, type DeviceCtx, type DeviceLogic, type DeviceState, type SenseMap, type WorldSense } from '../devices/logic';
import { pinRef, type DeviceInstance } from '../devices/specs';
import { UNO_IO } from './board-uno';

const HIGH: PinReading = { mode: 'out', level: 1, duty: 1, pulseUs: 0, freqHz: 0 };
const LOW: PinReading = { mode: 'out', level: 0, duty: 0, pulseUs: 0, freqHz: 0 };
const SDA_IO = 18; // A4
const SCL_IO = 19; // A5

interface PinSub {
  deviceId: string;
  pin: string;
  kind: 'edge' | 'change';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (...args: any[]) => void;
  unsubs: (() => void)[];
}

export class SimEngine {
  readonly runner: AVRRunner;
  analysis: CircuitAnalysis;
  time = 0;
  onSerial: ((byte: number) => void) | null = null;
  private logic = new Map<string, DeviceLogic>();
  private ctxs = new Map<string, DeviceCtx>();
  private drives = new Map<string, number>();
  private subs: PinSub[] = [];
  private senseNow: WorldSense;

  constructor(
    hex: string,
    private devices: DeviceInstance[],
    wires: Wire[],
    private sense: () => SenseMap,
    eeprom?: Uint8Array,
  ) {
    this.runner = new AVRRunner(hex, eeprom);
    this.runner.onSerialByte = (b) => this.onSerial?.(b);
    this.runner.onModeChange = (io) => this.resolveIo(io);
    this.runner.twi.eventHandler = this.i2cBus();
    this.analysis = analyzeCircuit(devices, wires);
    this.senseNow = { ...sense(), time: 0 };

    for (const d of devices) {
      const logic = createLogic(d.type);
      this.logic.set(d.id, logic);
      this.ctxs.set(d.id, this.makeCtx(d));
    }
    for (const d of devices) this.logic.get(d.id)!.attach?.(this.ctxs.get(d.id)!);
    this.resolveAll();
  }

  /** Wires changed while running: rebuild nets but keep the program running (like moving a jumper). */
  rewire(wires: Wire[]): void {
    this.analysis = analyzeCircuit(this.devices, wires);
    for (const sub of this.subs) this.subscribe(sub);
    this.resolveAll();
  }

  get states(): Record<string, DeviceState> {
    const out: Record<string, DeviceState> = {};
    for (const [id, l] of this.logic) out[id] = l.state;
    return out;
  }

  /** Advance by dt seconds of simulated time. */
  step(dt: number, maxCycles = Infinity): number {
    this.time += dt;
    this.senseNow = { ...this.sense(), time: this.time };
    for (const [id, l] of this.logic) l.update(this.ctxs.get(id)!, dt);
    this.resolveAll();
    const cycles = Math.min(Math.round(dt * CLOCK_HZ), maxCycles);
    this.runner.run(cycles);
    this.runner.sample();
    return cycles;
  }

  pin(io: number): PinReading {
    return this.runner.reading(io);
  }

  /** EEPROM contents, to keep them for the next run */
  eeprom(): Uint8Array {
    return this.runner.eeprom.memory.slice();
  }

  private net(ref: string): NetInfo | undefined {
    return this.analysis.netOf.get(ref);
  }

  private makeCtx(d: DeviceInstance): DeviceCtx {
    const engine = this;
    const ref = (pin: string) => pinRef(d.id, pin);
    return {
      id: d.id,
      get powered() {
        return !!engine.analysis.devices[d.id]?.powerOk;
      },
      get supply() {
        return engine.analysis.devices[d.id]?.supply ?? 0;
      },
      get world() {
        return engine.senseNow;
      },
      read(pin) {
        const net = engine.net(ref(pin));
        if (!net) return null;
        if (net.hasGnd) return LOW;
        if (net.has5V || net.has3V3) return HIGH;
        for (const io of net.ios) {
          if (engine.runner.mode(io) === 'out') return engine.runner.reading(io);
        }
        return null;
      },
      level(pin) {
        const net = engine.net(ref(pin));
        if (!net) return null;
        if (net.hasGnd) return 0;
        if (net.has5V || net.has3V3) return 1;
        for (const io of net.ios) {
          if (engine.runner.mode(io) === 'out') return engine.runner.level(io);
        }
        return null;
      },
      drive(pin, volts) {
        const r = ref(pin);
        if (volts === null) engine.drives.delete(r);
        else engine.drives.set(r, volts);
        const net = engine.net(r);
        if (net) engine.resolveNet(net);
      },
      onEdge(pin, cb) {
        const sub: PinSub = { deviceId: d.id, pin, kind: 'edge', cb, unsubs: [] };
        engine.subs.push(sub);
        engine.subscribe(sub);
      },
      onChange(pin, cb) {
        const sub: PinSub = { deviceId: d.id, pin, kind: 'change', cb, unsubs: [] };
        engine.subs.push(sub);
        engine.subscribe(sub);
      },
      schedule(cb, delaySeconds) {
        engine.runner.schedule(cb, delaySeconds * CLOCK_HZ);
      },
    };
  }

  private subscribe(sub: PinSub): void {
    sub.unsubs.forEach((u) => u());
    sub.unsubs = [];
    const net = this.net(pinRef(sub.deviceId, sub.pin));
    if (!net) return;
    for (const io of net.ios) {
      sub.unsubs.push(sub.kind === 'edge' ? this.runner.onEdge(io, sub.cb) : this.runner.onChange(io, sub.cb));
    }
  }

  /** The Wire library talks to whichever powered module sits on A4 (SDA) and A5 (SCL). */
  private i2cBus(): TWIEventHandler {
    const twi = this.runner.twi;
    let target: DeviceLogic['i2c'] | null = null;
    const onBus = (id: string, pin: string, io: number) => !!this.net(pinRef(id, pin))?.ios.includes(io);
    return {
      start: () => twi.completeStart(),
      stop: () => {
        target = null;
        twi.completeStop();
      },
      connectToSlave: (addr) => {
        target = null;
        for (const d of this.devices) {
          const t = this.logic.get(d.id)?.i2c;
          if (t && t.address === addr && this.analysis.devices[d.id]?.powerOk && onBus(d.id, 'SDA', SDA_IO) && onBus(d.id, 'SCL', SCL_IO)) target = t;
        }
        twi.completeConnect(!!target);
      },
      writeByte: (value) => twi.completeWrite(target ? target.write(value) : false),
      readByte: () => twi.completeRead(target?.read?.() ?? 0xff),
    };
  }

  private resolveIo(io: number): void {
    const p = UNO_IO[io];
    const name = io >= 14 ? `A${io - 14}` : `D${io}`;
    const net = this.net(pinRef('uno', name));
    if (net) this.resolveNet(net);
    else this.runner.setVoltage(p.io, this.runner.mode(io) === 'pullup' ? 5 : 0);
  }

  /** Work out the voltage every Arduino input pin on this net sees. */
  private resolveNet(net: NetInfo): void {
    if (net.ios.length === 0) return;
    let source: number | null = null;
    for (const r of net.refs) {
      const v = this.drives.get(r);
      if (v !== undefined) {
        source = v;
        break;
      }
    }
    if (source === null) {
      if (net.hasGnd) source = 0;
      else if (net.has5V) source = 5;
      else if (net.has3V3) source = 3.3;
    }
    if (source === null) {
      for (const io of net.ios) {
        if (this.runner.mode(io) === 'out') {
          source = this.runner.level(io) ? 5 : 0;
          break;
        }
      }
    }
    for (const io of net.ios) {
      if (this.runner.mode(io) === 'out') continue;
      const pull = this.runner.mode(io) === 'pullup';
      this.runner.setVoltage(io, source ?? (pull ? 5 : 0));
    }
  }

  private resolveAll(): void {
    for (const net of this.analysis.nets) if (net.ios.length) this.resolveNet(net);
  }
}
