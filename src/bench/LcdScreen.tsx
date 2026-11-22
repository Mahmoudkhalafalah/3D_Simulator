// Draws a 16x2 character LCD from the module's screen memory. Used on the workbench
// and in the 3D worlds (the same screen appears on the garden's weather station).
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { live } from '../sim/session';
import type { LcdView } from '../devices/hd44780';

const DOT = 4;
const CELL_W = 6 * DOT;
const CELL_H = 9 * DOT;
const PAD = 3 * DOT;
const W = 16 * CELL_W + PAD * 2;
const H = 2 * CELL_H + PAD * 2;

export type LcdStyle = 'green' | 'blue';

const PALETTE: Record<LcdStyle, { on: string; off: string; ink: string; dot: string; offInk: string }> = {
  green: { on: '#a3d65c', off: '#4b5e2a', ink: '#1d2e0b', dot: 'rgba(0,0,0,0.07)', offInk: '#2f3c1a' },
  blue: { on: '#2f6df6', off: '#14295e', ink: '#f0f6ff', dot: 'rgba(255,255,255,0.08)', offInk: '#2a3f74' },
};

/** Characters from the HD44780 ROM that are not plain ASCII. */
const ROM: Record<number, string> = { 0xdf: '°', 0xa5: '•', 0x7e: '→', 0x7f: '←', 0xe4: 'µ', 0xf4: 'Ω', 0xff: '█' };

function draw(g: CanvasRenderingContext2D, view: LcdView | null, style: LcdStyle, blinkOn: boolean) {
  const p = PALETTE[style];
  const lit = !!view && view.backlight;
  g.fillStyle = lit ? p.on : p.off;
  g.fillRect(0, 0, W, H);
  // the faint 5x8 dot grid of every character cell
  g.fillStyle = p.dot;
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 16; c++)
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 5; x++) g.fillRect(PAD + c * CELL_W + x * DOT, PAD + r * CELL_H + y * DOT, DOT - 1, DOT - 1);
  if (!view || !view.on) return;
  const ink = lit ? p.ink : p.offInk;
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${8.6 * DOT}px "Courier New", Consolas, monospace`;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 16; c++) {
      const code = view.rows[r][c];
      const x0 = PAD + c * CELL_W;
      const y0 = PAD + r * CELL_H;
      if (code < 8) {
        // custom character from CGRAM
        for (let y = 0; y < 8; y++) {
          const bits = view.cgram[code * 8 + y];
          for (let x = 0; x < 5; x++) if (bits & (1 << (4 - x))) g.fillRect(x0 + x * DOT, y0 + y * DOT, DOT - 0.5, DOT - 0.5);
        }
        continue;
      }
      const ch = ROM[code] ?? (code >= 0x20 && code < 0x7e ? String.fromCharCode(code) : '');
      if (ch && ch !== ' ') g.fillText(ch, x0 + 2.5 * DOT, y0 + 4.3 * DOT);
    }
  }
  const cur = view.cursor;
  if (cur) {
    const x0 = PAD + cur.col * CELL_W;
    const y0 = PAD + cur.row * CELL_H;
    if (cur.blink && blinkOn) {
      g.globalAlpha = 0.85;
      g.fillRect(x0, y0, 5 * DOT, 8 * DOT);
      g.globalAlpha = 1;
    } else if (cur.underline) g.fillRect(x0, y0 + 7 * DOT, 5 * DOT, DOT);
  }
}

/** A flat LCD screen (lying in the XY plane) showing what the module's screen memory holds. */
export function LcdScreen({ deviceId, width, style }: { deviceId: string; width: number; style: LcdStyle }) {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas, tex };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const g = useMemo(() => canvas.getContext('2d')!, [canvas]);
  const last = useMemo(() => ({ key: '' }), []);
  useFrame(({ clock }) => {
    const view = live.states[deviceId]?.display ?? null;
    const blink = Math.floor(clock.elapsedTime * 2) % 2 === 0;
    const key = view ? `${view.rev}:${view.backlight}:${view.on}:${view.cursor?.blink ? blink : ''}` : 'off';
    if (key === last.key) return;
    last.key = key;
    draw(g, view, style, blink);
    tex.needsUpdate = true;
  });
  const height = (width * H) / W;
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
