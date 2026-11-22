// The HD44780 controller inside every 16x2 character LCD. It receives 4-bit transfers
// (from D4-D7 directly, or through an I2C backpack) and keeps the screen memory.

export interface LcdView {
  /** 2 rows x 16 character codes, as shown on the glass (after scrolling) */
  rows: number[][];
  /** Custom characters 0-7: 8 rows of 5 pixels each, 64 bytes */
  cgram: number[];
  on: boolean;
  backlight: boolean;
  cursor: { row: number; col: number; underline: boolean; blink: boolean } | null;
  /** Changes whenever anything on the screen changes */
  rev: number;
}

export class HD44780 {
  private ddram = new Uint8Array(128).fill(0x20);
  private cgram = new Uint8Array(64);
  private ac = 0;
  private cg = false;
  private inc = true;
  private autoShift = false;
  private on = false;
  private cursorOn = false;
  private blinkOn = false;
  private shift = 0;
  private fourBit = false;
  private high: number | null = null;
  private backlightOn = true;
  private cached: LcdView | null = null;
  rev = 0;

  set backlight(v: boolean) {
    if (v !== this.backlightOn) {
      this.backlightOn = v;
      this.rev++;
    }
  }

  /** One transfer on D4-D7, latched when E falls. */
  nibble(rs: boolean, n: number): void {
    if (!this.fourBit) {
      // Still in 8-bit mode after power-up: only the top 4 data lines are wired.
      if (!rs) this.command(n << 4);
      this.high = null;
      return;
    }
    if (this.high === null) {
      this.high = n & 0xf;
      return;
    }
    const v = (this.high << 4) | (n & 0xf);
    this.high = null;
    if (rs) this.data(v);
    else this.command(v);
  }

  private move(dir: number): void {
    let a = this.ac + dir;
    if (dir > 0) {
      if (a === 0x28) a = 0x40;
      else if (a >= 0x68) a = 0x00;
    } else if (a === 0x3f) a = 0x27;
    else if (a < 0) a = 0x67;
    this.ac = a & 0x7f;
  }

  command(v: number): void {
    if (v & 0x80) {
      this.cg = false;
      this.ac = v & 0x7f;
    } else if (v & 0x40) {
      this.cg = true;
      this.ac = v & 0x3f;
    } else if (v & 0x20) {
      this.fourBit = !(v & 0x10);
      this.high = null;
    } else if (v & 0x10) {
      const right = !!(v & 0x04);
      if (v & 0x08) this.shift += right ? -1 : 1;
      else this.move(right ? 1 : -1);
    } else if (v & 0x08) {
      this.on = !!(v & 0x04);
      this.cursorOn = !!(v & 0x02);
      this.blinkOn = !!(v & 0x01);
    } else if (v & 0x04) {
      this.inc = !!(v & 0x02);
      this.autoShift = !!(v & 0x01);
    } else if (v & 0x02) {
      this.ac = 0;
      this.shift = 0;
      this.cg = false;
    } else if (v & 0x01) {
      this.ddram.fill(0x20);
      this.ac = 0;
      this.shift = 0;
      this.inc = true;
      this.cg = false;
    }
    this.rev++;
  }

  data(v: number): void {
    if (this.cg) {
      this.cgram[this.ac & 0x3f] = v & 0x1f;
      this.ac = (this.ac + 1) & 0x3f;
    } else {
      this.ddram[this.ac] = v;
      this.move(this.inc ? 1 : -1);
      if (this.autoShift) this.shift += this.inc ? 1 : -1;
    }
    this.rev++;
  }

  view(): LcdView {
    if (this.cached && this.cached.rev === this.rev) return this.cached;
    const wrap = (i: number) => ((i % 40) + 40) % 40;
    const rows = [0, 1].map((r) => Array.from({ length: 16 }, (_, c) => this.ddram[(r ? 0x40 : 0) + wrap(c + this.shift)]));
    let cursor: LcdView['cursor'] = null;
    if ((this.cursorOn || this.blinkOn) && !this.cg) {
      const row = this.ac >= 0x40 ? 1 : 0;
      const col = wrap(this.ac - (row ? 0x40 : 0) - this.shift);
      if (col < 16) cursor = { row, col, underline: this.cursorOn, blink: this.blinkOn };
    }
    this.cached = { rows, cgram: Array.from(this.cgram), on: this.on, backlight: this.backlightOn, cursor, rev: this.rev };
    return this.cached;
  }

  /** Plain text of both rows, for objectives and tests. */
  text(): string[] {
    return this.view().rows.map((r) => String.fromCharCode(...r.map((c) => (c >= 0x20 && c < 0x7f ? c : 0x20))));
  }
}
