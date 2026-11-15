/** Parse an Intel HEX file (output of avr-gcc) into a flash image. */
export function loadHex(source: string, target: Uint8Array): void {
  let base = 0;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line[0] !== ':') continue;
    const count = parseInt(line.substring(1, 3), 16);
    const addr = parseInt(line.substring(3, 7), 16);
    const type = parseInt(line.substring(7, 9), 16);
    if (type === 0x00) {
      for (let i = 0; i < count; i++) {
        target[base + addr + i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
      }
    } else if (type === 0x02) {
      base = parseInt(line.substring(9, 13), 16) << 4;
    } else if (type === 0x04) {
      base = parseInt(line.substring(9, 13), 16) << 16;
    } else if (type === 0x01) {
      break;
    }
  }
}
