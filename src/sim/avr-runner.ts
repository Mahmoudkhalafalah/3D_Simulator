// Runs a compiled Arduino Uno program on the avr8js ATmega328P emulator and
// measures what happens on every pin (level, PWM duty, pulse width, frequency).
import {
  AVRADC,
  AVREEPROM,
  AVRIOPort,
  AVRTWI,
  AVRTimer,
  AVRUSART,
  CPU,
  EEPROMMemoryBackend,
  NoopTWIEventHandler,
  PinState,
  adcConfig,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
} from 'avr8js';
import { loadHex } from './hex';
import { UNO_IO, type PortName } from './board-uno';

export const CLOCK_HZ = 16_000_000;
const FLASH_BYTES = 0x8000;

export type PinMode = 'in' | 'pullup' | 'out';

/** What a pin is doing, as seen from outside the chip. */
export interface PinReading {
  mode: PinMode;
  /** Current output level (only meaningful when mode === 'out') */
  level: 0 | 1;
  /** Fraction of the last frame the pin was HIGH (PWM brightness / motor speed) */
  duty: number;
  /** Width of the last complete HIGH pulse in microseconds, or 0 if none recently (servos) */
  pulseUs: number;
  /** Square-wave frequency in Hz, or 0 if the pin is not toggling (buzzers) */
  freqHz: number;
}

class PinTracker {
  mode: PinMode = 'in';
  level: 0 | 1 = 0;
  private eff = 0;
  private lastChange = 0;
  private winStart = 0;
  private highAcc = 0;
  private lastRise = -1;
  private lastFall = -1;
  private pulseCycles = 0;
  private periodCycles = 0;
  reading: PinReading = { mode: 'in', level: 0, duty: 0, pulseUs: 0, freqHz: 0 };

  /** Returns +1 for a rising edge, -1 for falling, 0 for no change. */
  set(mode: PinMode, level: 0 | 1, now: number): number {
    this.mode = mode;
    this.level = level;
    const eff = mode === 'out' ? level : 0;
    if (eff === this.eff) return 0;
    if (this.eff === 1) this.highAcc += now - Math.max(this.lastChange, this.winStart);
    if (eff === 1) {
      if (this.lastRise >= 0) this.periodCycles = now - this.lastRise;
      this.lastRise = now;
    } else {
      if (this.lastRise >= 0) this.pulseCycles = now - this.lastRise;
      this.lastFall = now;
    }
    this.eff = eff;
    this.lastChange = now;
    return eff === 1 ? 1 : -1;
  }

  closeWindow(now: number): void {
    if (this.eff === 1) this.highAcc += now - Math.max(this.lastChange, this.winStart);
    const span = now - this.winStart;
    const duty = span > 0 ? Math.min(1, this.highAcc / span) : this.eff;
    const pulseRecent = this.lastFall >= 0 && now - this.lastFall < CLOCK_HZ * 0.1;
    const period = this.periodCycles;
    const toggling = period > 0 && this.lastRise >= 0 && now - this.lastRise < Math.max(2 * period, CLOCK_HZ * 0.03);
    this.reading = {
      mode: this.mode,
      level: this.level,
      duty: this.mode === 'out' ? duty : 0,
      pulseUs: pulseRecent ? (this.pulseCycles / CLOCK_HZ) * 1e6 : 0,
      freqHz: toggling ? CLOCK_HZ / period : 0,
    };
    this.highAcc = 0;
    this.winStart = now;
  }
}

export type EdgeListener = (level: 0 | 1, cycles: number) => void;
export type ChangeListener = (mode: PinMode, level: 0 | 1, cycles: number) => void;

export const EEPROM_BYTES = 1024;

export class AVRRunner {
  readonly cpu: CPU;
  readonly ports: Record<PortName, AVRIOPort>;
  readonly adc: AVRADC;
  readonly usart: AVRUSART;
  /** I2C (Wire library). The engine plugs in an event handler that talks to I2C modules. */
  readonly twi: AVRTWI;
  /** EEPROM contents: survive restarts, like on a real board */
  readonly eeprom: EEPROMMemoryBackend;
  readonly pins: PinTracker[] = UNO_IO.map(() => new PinTracker());
  onSerialByte: ((byte: number) => void) | null = null;
  /** Called whenever an IO pin changes mode (e.g. pinMode INPUT_PULLUP) so inputs can be re-resolved. */
  onModeChange: ((io: number) => void) | null = null;
  private edgeListeners = new Map<number, Set<EdgeListener>>();
  private changeListeners = new Map<number, Set<ChangeListener>>();
  private rxQueue: number[] = [];

  constructor(hex: string, eeprom?: Uint8Array) {
    const flash = new Uint8Array(FLASH_BYTES);
    loadHex(hex, flash);
    this.cpu = new CPU(new Uint16Array(flash.buffer));
    new AVRTimer(this.cpu, timer0Config);
    new AVRTimer(this.cpu, timer1Config);
    new AVRTimer(this.cpu, timer2Config);
    this.ports = {
      B: new AVRIOPort(this.cpu, portBConfig),
      C: new AVRIOPort(this.cpu, portCConfig),
      D: new AVRIOPort(this.cpu, portDConfig),
    };
    this.adc = new AVRADC(this.cpu, adcConfig);
    this.usart = new AVRUSART(this.cpu, usart0Config, CLOCK_HZ);
    this.usart.onByteTransmit = (b) => this.onSerialByte?.(b);
    this.usart.onRxComplete = () => this.pumpRx();
    this.twi = new AVRTWI(this.cpu, twiConfig, CLOCK_HZ);
    this.twi.eventHandler = new NoopTWIEventHandler(this.twi);
    this.eeprom = new EEPROMMemoryBackend(EEPROM_BYTES);
    if (eeprom) this.eeprom.memory.set(eeprom.subarray(0, EEPROM_BYTES));
    new AVREEPROM(this.cpu, this.eeprom);

    for (const name of ['B', 'C', 'D'] as PortName[]) {
      const port = this.ports[name];
      const pins = UNO_IO.filter((p) => p.port === name);
      port.addListener(() => {
        const now = this.cpu.cycles;
        for (const p of pins) {
          const st = port.pinState(p.bit);
          const mode: PinMode = st === PinState.Input ? 'in' : st === PinState.InputPullUp ? 'pullup' : 'out';
          const level: 0 | 1 = st === PinState.High ? 1 : 0;
          const tracker = this.pins[p.io];
          const oldMode = tracker.mode;
          const oldLevel = tracker.level;
          const edge = tracker.set(mode, level, now);
          if (mode !== oldMode) this.onModeChange?.(p.io);
          if (mode !== oldMode || level !== oldLevel) {
            const cs = this.changeListeners.get(p.io);
            if (cs) for (const l of cs) l(mode, level, now);
          }
          if (edge !== 0) {
            const ls = this.edgeListeners.get(p.io);
            if (ls) for (const l of ls) l(edge > 0 ? 1 : 0, now);
          }
        }
      });
    }
  }

  get cycles(): number {
    return this.cpu.cycles;
  }

  run(cycles: number): void {
    const cpu = this.cpu;
    const end = cpu.cycles + cycles;
    while (cpu.cycles < end) {
      avrInstruction(cpu);
      cpu.tick();
    }
  }

  /** Finish the measurement window and compute readings for every pin. */
  sample(): void {
    const now = this.cpu.cycles;
    for (const t of this.pins) t.closeWindow(now);
  }

  reading(io: number): PinReading {
    return this.pins[io].reading;
  }

  mode(io: number): PinMode {
    return this.pins[io].mode;
  }

  level(io: number): 0 | 1 {
    return this.pins[io].level;
  }

  /** Drive an input pin from outside (a button, sensor, ...). */
  setInput(io: number, level: boolean): void {
    const p = UNO_IO[io];
    this.ports[p.port].setPin(p.bit, level);
  }

  /** Apply an analog voltage to a pin (A0-A5 are read by analogRead, others see a digital level). */
  setVoltage(io: number, volts: number): void {
    const p = UNO_IO[io];
    if (p.adc !== undefined) this.adc.channelValues[p.adc] = volts;
    this.ports[p.port].setPin(p.bit, volts > 2.5);
  }

  onEdge(io: number, listener: EdgeListener): () => void {
    let set = this.edgeListeners.get(io);
    if (!set) this.edgeListeners.set(io, (set = new Set()));
    set.add(listener);
    return () => set!.delete(listener);
  }

  /** Listen for any change of mode or level on a pin (bidirectional protocols like DHT11, keypads). */
  onChange(io: number, listener: ChangeListener): () => void {
    let set = this.changeListeners.get(io);
    if (!set) this.changeListeners.set(io, (set = new Set()));
    set.add(listener);
    return () => set!.delete(listener);
  }

  /** Run `callback` after `delayCycles` CPU cycles (precise timing for sensors like HC-SR04). */
  schedule(callback: () => void, delayCycles: number): void {
    this.cpu.addClockEvent(callback, Math.max(1, Math.round(delayCycles)));
  }

  serialWrite(text: string): void {
    for (let i = 0; i < text.length; i++) this.rxQueue.push(text.charCodeAt(i) & 0xff);
    this.pumpRx();
  }

  private pumpRx(): void {
    if (this.rxQueue.length && this.usart.rxEnable && !this.usart.rxBusy) {
      if (this.usart.writeByte(this.rxQueue[0])) this.rxQueue.shift();
    }
  }
}
