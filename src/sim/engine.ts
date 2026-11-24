// The simulation engine: one or two Arduinos, a set of modules and the wires between them.
// Each frame it lets modules sense the world, feeds their signals to the chips,
// runs the chips for the elapsed time, and measures what the chips did.
import type { TWIEventHandler } from 'avr8js';
import { AVRRunner, CLOCK_HZ, type PinMode, type PinReading } from './avr-runner';
import { analyzeCircuit, type CircuitAnalysis, type NetInfo, type Wire } from './circuit';
import { createLogic, type DeviceCtx, type DeviceLogic, type DeviceState, type SenseMap, type WorldSense } from '../devices/logic';
import { pinRef, type DeviceInstance } from '../devices/specs';
import { BOARD_IDS, IO_PER_BOARD, UNO_IO } from './board-uno';

const HIGH: PinReading = { mode: 'out', level: 1, duty: 1, pulseUs: 0, freqHz: 0 };
const LOW: PinReading = { mode: 'out', level: 0, duty: 0, pulseUs: 0, freqHz: 0 };
const SDA_IO = 18; // A4
const SCL_IO = 19; // A5
/** Two boards run in lockstep, this many clock cycles (5 us) at a time, so signals between them arrive on time. */
const SLICE = 80;

interface PinSub {
  deviceId: string;
  pin: string;
  kind: 'edge' | 'change';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (...args: any[]) => void;
  unsubs: (() => void)[];
}

/** Bytes sent from one Arduino's TX to the other's RX. */
export interface LinkStats {
  bytes: number;
  garbled: number;
  /** Clean bytes in a row since the last garbled one */
  cleanStreak: number;
}

export class SimEngine {
  readonly runners: AVRRunner[];
  analysis: CircuitAnalysis;
  time = 0;
  /** A byte the program printed with Serial (board 0 = Arduino A, 1 = Arduino B) */
  onSerial: ((byte: number, board: number) => void) | null = null;
  readonly link: LinkStats = { bytes: 0, garbled: 0, cleanStreak: 0 };
  private logic = new Map<string, DeviceLogic>();
  private ctxs = new Map<string, DeviceCtx>();
  private drives = new Map<string, number>();
  private subs: PinSub[] = [];
  private crossUnsubs: (() => void)[] = [];
  private senseNow: WorldSense;

  constructor(
    hexes: string | string[],
    private devices: DeviceInstance[],
    wires: Wire[],
    private sense: () => SenseMap,
    eeproms?: Uint8Array | (Uint8Array | undefined)[],
  ) {
    const list = Array.isArray(hexes) ? hexes : [hexes];
    const roms = Array.isArray(eeproms) ? eeproms : [eeproms];
    this.runners = list.map((hex, b) => {
      const r = new AVRRunner(hex, roms[b]);
      r.onSerialByte = (byte) => {
        this.onSerial?.(byte, b);
        this.bridgeSerial(b, byte);
      };
      r.onModeChange = (io) => this.resolveIo(b * IO_PER_BOARD + io);
      r.twi.eventHandler = this.i2cBus(b);
      return r;
    });
    this.analysis = analyzeCircuit(devices, wires, this.runners.length);
    this.senseNow = { ...sense(), time: 0 };

    for (const d of devices) {
      const logic = createLogic(d.type);
      this.logic.set(d.id, logic);
      this.ctxs.set(d.id, this.makeCtx(d));
    }
    for (const d of devices) this.logic.get(d.id)!.attach?.(this.ctxs.get(d.id)!);
    this.linkBoards();
    this.resolveAll();
  }

  /** Arduino A (the only board in most missions) */
  get runner(): AVRRunner {
    return this.runners[0];
  }

  /** Wires changed while running: rebuild nets but keep the programs running (like moving a jumper). */
  rewire(wires: Wire[]): void {
    this.analysis = analyzeCircuit(this.devices, wires, this.runners.length);
    for (const sub of this.subs) this.subscribe(sub);
    this.linkBoards();
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
    if (this.runners.length === 1) this.runner.run(cycles);
    else {
      for (let done = 0; done < cycles; done += SLICE) {
        const n = Math.min(SLICE, cycles - done);
        for (const r of this.runners) r.run(n);
      }
    }
    for (const r of this.runners) r.sample();
    return cycles;
  }

  /** What a pin is doing, by global IO number (Arduino B's pins start at 20). */
  pin(io: number): PinReading {
    return this.board(io).reading(io % IO_PER_BOARD);
  }

  /** EEPROM contents of a board, to keep them for the next run */
  eeprom(board = 0): Uint8Array {
    return this.runners[board].eeprom.memory.slice();
  }

  // ------------------------------------------------------------ helpers for global IO numbers
  private board(io: number): AVRRunner {
    return this.runners[Math.floor(io / IO_PER_BOARD)];
  }
  private mode(io: number): PinMode {
    return this.board(io).mode(io % IO_PER_BOARD);
  }
  private level(io: number): 0 | 1 {
    return this.board(io).level(io % IO_PER_BOARD);
  }
  private setVoltage(io: number, volts: number): void {
    this.board(io).setVoltage(io % IO_PER_BOARD, volts);
  }
  /** Signals only travel between boards that share a ground */
  private visible(io: number, from: number): boolean {
    return this.analysis.commonGround || Math.floor(io / IO_PER_BOARD) === Math.floor(from / IO_PER_BOARD);
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
          if (engine.mode(io) === 'out') return engine.pin(io);
        }
        return null;
      },
      level(pin) {
        const net = engine.net(ref(pin));
        if (!net) return null;
        if (net.hasGnd) return 0;
        if (net.has5V || net.has3V3) return 1;
        for (const io of net.ios) {
          if (engine.mode(io) === 'out') return engine.level(io);
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
        // Clock events run on Arduino A's clock (both boards stay in step)
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
      const r = this.board(io);
      const local = io % IO_PER_BOARD;
      sub.unsubs.push(sub.kind === 'edge' ? r.onEdge(local, sub.cb) : r.onChange(local, sub.cb));
    }
  }

  /** Wires between the two boards: when one board changes such a pin, the other board sees it at once. */
  private linkBoards(): void {
    this.crossUnsubs.forEach((u) => u());
    this.crossUnsubs = [];
    if (this.runners.length < 2) return;
    for (const net of this.analysis.nets) {
      const boards = new Set(net.ios.map((io) => Math.floor(io / IO_PER_BOARD)));
      if (boards.size < 2) continue;
      for (const io of net.ios) {
        this.crossUnsubs.push(this.board(io).onChange(io % IO_PER_BOARD, () => this.resolveNet(net)));
      }
    }
  }

  /** Hardware Serial between boards: a byte sent on one board's TX (pin 1) arrives at the other's RX (pin 0). */
  private bridgeSerial(from: number, byte: number): void {
    if (this.runners.length < 2 || !this.analysis.commonGround) return;
    const tx = this.net(pinRef(BOARD_IDS[from], 'D1'));
    if (!tx) return;
    this.runners.forEach((to, b) => {
      if (b === from || !tx.ios.includes(b * IO_PER_BOARD + 0) || !to.usart.rxEnable) return;
      const a = this.runners[from].usart.baudRate;
      const ratio = a / to.usart.baudRate;
      let v = byte;
      if (Math.abs(ratio - 1) > 0.04) {
        // The two boards disagree about the speed: the receiver samples the bits at the wrong moments
        v = ((byte ^ 0xa5) * 7 + Math.round(ratio * 13)) & 0xff;
        this.link.garbled++;
        this.link.cleanStreak = 0;
      } else this.link.cleanStreak++;
      this.link.bytes++;
      to.serialWriteByte(v);
    });
  }

  /** The Wire library talks to whichever powered module sits on this board's A4 (SDA) and A5 (SCL). */
  private i2cBus(board: number): TWIEventHandler {
    let target: DeviceLogic['i2c'] | null = null;
    return {
      start: () => this.runners[board].twi.completeStart(),
      stop: () => {
        target = null;
        this.runners[board].twi.completeStop();
      },
      connectToSlave: (addr) => {
        target = null;
        const onBus = (id: string, pin: string, io: number) => !!this.net(pinRef(id, pin))?.ios.includes(board * IO_PER_BOARD + io);
        for (const d of this.devices) {
          const t = this.logic.get(d.id)?.i2c;
          if (t && t.address === addr && this.analysis.devices[d.id]?.powerOk && onBus(d.id, 'SDA', SDA_IO) && onBus(d.id, 'SCL', SCL_IO)) target = t;
        }
        this.runners[board].twi.completeConnect(!!target);
      },
      writeByte: (value) => this.runners[board].twi.completeWrite(target ? target.write(value) : false),
      readByte: () => this.runners[board].twi.completeRead(target?.read?.() ?? 0xff),
    };
  }

  private resolveIo(io: number): void {
    const b = Math.floor(io / IO_PER_BOARD);
    const local = io % IO_PER_BOARD;
    const name = local >= 14 ? `A${local - 14}` : `D${local}`;
    const net = this.net(pinRef(BOARD_IDS[b], name));
    if (net) this.resolveNet(net);
    else this.runners[b].setVoltage(UNO_IO[local].io, this.runners[b].mode(local) === 'pullup' ? 5 : 0);
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
    let driver = -1;
    if (source === null) {
      for (const io of net.ios) {
        if (this.mode(io) === 'out') {
          source = this.level(io) ? 5 : 0;
          driver = io;
          break;
        }
      }
    }
    for (const io of net.ios) {
      const mode = this.mode(io);
      if (mode === 'out') continue;
      const seen = source !== null && (driver < 0 || this.visible(io, driver)) ? source : null;
      this.setVoltage(io, seen ?? (mode === 'pullup' ? 5 : 0));
    }
  }

  private resolveAll(): void {
    for (const net of this.analysis.nets) if (net.ios.length) this.resolveNet(net);
  }
}
