// All sounds are synthesised with Web Audio, so there are no audio files to download.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}
const voices = new Map<string, Voice>();

export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.02);
}

/** A continuous tone, e.g. a buzzer. freq 0 = silent. */
export function setTone(id: string, freq: number, volume = 0.05, type: OscillatorType = 'square'): void {
  if (!ctx || !master) return;
  let v = voices.get(id);
  if (!v) {
    if (freq <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    osc.start();
    v = { osc, gain };
    voices.set(id, v);
  }
  const t = ctx.currentTime;
  if (freq > 0) {
    v.osc.frequency.setTargetAtTime(freq, t, 0.002);
    v.gain.gain.setTargetAtTime(volume, t, 0.004);
  } else {
    v.gain.gain.setTargetAtTime(0, t, 0.004);
  }
}

export function silenceAll(): void {
  if (!ctx) return;
  for (const v of voices.values()) v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
}

/** Relay "click": a very short burst of noise */
export function click(): void {
  if (!ctx || !master) return;
  const len = Math.floor(ctx.sampleRate * 0.025);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  src.buffer = buffer;
  src.connect(gain).connect(master);
  src.start();
}

function note(freq: number, start: number, dur: number, volume = 0.12, type: OscillatorType = 'triangle') {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function playSuccess(): void {
  [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.11, 0.35));
}

export function playObjective(): void {
  note(880, 0, 0.15, 0.08);
  note(1320, 0.08, 0.25, 0.08);
}

export function playBump(): void {
  note(90, 0, 0.3, 0.3, 'sawtooth');
}

export function playPop(): void {
  note(600, 0, 0.06, 0.05, 'sine');
}
