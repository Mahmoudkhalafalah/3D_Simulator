// Textures drawn with a 2D canvas, so the app needs no image files.
import * as THREE from 'three';
import { UNO_PINS, UNO_SIZE } from '../sim/board-uno';

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const cache = new Map<string, THREE.Texture>();
export function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = make()));
  return t;
}

const FONT = '"Nunito", "Segoe UI", sans-serif';

/** Silkscreen for the Uno: header labels, logo, LEDs. */
export function unoTexture(): THREE.Texture {
  return cached('uno', () => {
    const W = 1400;
    const H = Math.round((W * UNO_SIZE.d) / UNO_SIZE.w);
    return canvasTexture(W, H, (g) => {
      const px = (x: number) => (x / UNO_SIZE.w + 0.5) * W;
      const py = (z: number) => (z / UNO_SIZE.d + 0.5) * H;
      g.fillStyle = '#00878f';
      g.fillRect(0, 0, W, H);
      // copper traces
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 5;
      for (let i = 0; i < 28; i++) {
        g.beginPath();
        const y = 160 + ((i * 37) % (H - 320));
        g.moveTo(300 + ((i * 53) % 400), y);
        g.lineTo(700 + ((i * 71) % 500), y);
        g.lineTo(760 + ((i * 71) % 500), y + 40);
        g.stroke();
      }
      // mounting holes
      for (const [x, y] of [[14, 2.5], [15.3, 50.7], [66.1, 7.6], [66.1, 35.5]]) {
        g.fillStyle = '#d9d9d9';
        g.beginPath();
        g.arc(px((x - 34.3) / 10), py(-(y - 26.65) / 10), 34, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1f2937';
        g.beginPath();
        g.arc(px((x - 34.3) / 10), py(-(y - 26.65) / 10), 22, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // header labels (rotated, like the real board)
      for (const p of UNO_PINS) {
        const top = p.z < 0;
        const text = p.name.startsWith('D') ? (([3, 5, 6, 9, 10, 11].includes(p.io!) ? '~' : '') + p.io) : p.name.replace(/^GND\d/, 'GND').replace('3V3', '3.3V');
        g.save();
        g.translate(px(p.x), py(p.z) + (top ? 70 : -70));
        g.rotate(-Math.PI / 2);
        g.font = `bold ${text.length > 3 ? 26 : 32}px ${FONT}`;
        g.textAlign = top ? 'right' : 'left';
        g.fillText(text, top ? 30 : -30, 0);
        g.restore();
      }
      g.font = `900 30px ${FONT}`;
      g.fillText('DIGITAL (PWM ~)', px(1.4), py(-1.2));
      g.fillText('POWER', px(0.25), py(1.35));
      g.fillText('ANALOG IN', px(2.29), py(1.35));
      // logo
      g.font = `900 120px ${FONT}`;
      g.fillText('UNO', px(1.0), py(0.05));
      g.font = `bold 34px ${FONT}`;
      g.fillText('CIRCUIT WORLD', px(1.0), py(0.55));
      // LED labels
      g.font = `bold 26px ${FONT}`;
      g.textAlign = 'left';
      g.fillText('L', px(-0.68), py(-1.74));
      g.fillText('TX', px(-0.68), py(-1.49));
      g.fillText('RX', px(-0.68), py(-1.24));
      g.fillText('ON', px(2.9), py(-0.83));
    });
  });
}

/** Silkscreen for a module PCB: its name and pin letters. */
export function moduleTexture(title: string, pins: string[], color: string): THREE.Texture {
  return cached(`mod:${title}:${pins.join(',')}:${color}`, () =>
    canvasTexture(512, 512, (g) => {
      g.fillStyle = color;
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 6;
      g.strokeRect(14, 14, 484, 484);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = `900 46px ${FONT}`;
      g.fillText(title.toUpperCase(), 256, 470);
    }),
  );
}

export function matTexture(): THREE.Texture {
  return cached('mat', () => {
    const t = canvasTexture(512, 512, (g) => {
      g.fillStyle = '#2f6b5a';
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.lineWidth = 2;
      for (let i = 0; i <= 512; i += 32) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 512);
        g.moveTo(0, i);
        g.lineTo(512, i);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 3;
      g.strokeRect(0, 0, 512, 512);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 8);
    return t;
  });
}

/** Small text sprite texture, e.g. a thermometer display. */
export function displayTexture(text: string, bg = '#0b1220', fg = '#7dd3fc'): THREE.CanvasTexture {
  return canvasTexture(256, 128, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 64px ${FONT}`;
    g.fillText(text, 128, 68);
  });
}
