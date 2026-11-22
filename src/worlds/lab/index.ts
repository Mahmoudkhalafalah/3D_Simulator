import type { WorldDef } from '../types';
import { LAB_MISSIONS } from './missions';
import { LabSim } from './sim';

export const SECRET_LAB: WorldDef = {
  id: 'lab',
  title: 'Secret Lab',
  emoji: '🔬',
  tagline: 'A keypad vault, a security camera, a robot arm, binary lights and the lab computer.',
  help: 'Click the arm button to press it. Use the keypad and joystick below. Drag to look around.',
  devices: [
    { id: 'thiefSensor', type: 'pir', name: 'Motion sensor', emoji: '👀' },
    { id: 'alarmLamp', type: 'led', name: 'Alarm lamp', emoji: '🚨', color: '#ef4444' },
    { id: 'labAlarm', type: 'buzzer', name: 'Siren', emoji: '📢' },
    { id: 'bit0', type: 'led', name: 'Bit 0 (×1)', emoji: '1️⃣', color: '#facc15' },
    { id: 'bit1', type: 'led', name: 'Bit 1 (×2)', emoji: '2️⃣', color: '#facc15' },
    { id: 'bit2', type: 'led', name: 'Bit 2 (×4)', emoji: '4️⃣', color: '#facc15' },
    { id: 'bit3', type: 'led', name: 'Bit 3 (×8)', emoji: '8️⃣', color: '#facc15' },
    { id: 'clapSensor', type: 'sound', name: 'Sound sensor', emoji: '👂' },
    { id: 'labLights', type: 'relay', name: 'Lab lights relay', emoji: '💡' },
    { id: 'handSensor', type: 'ultrasonic', name: 'Hand sensor', emoji: '✋' },
    { id: 'theremin', type: 'buzzer', name: 'Theremin speaker', emoji: '🎵' },
    { id: 'armServo', type: 'servo', name: 'Arm servo', emoji: '🦾' },
    { id: 'armButton', type: 'button', name: 'Arm button', emoji: '🔘' },
    { id: 'keypad', type: 'keypad', name: 'Vault keypad', emoji: '🔢' },
    { id: 'doorScreen', type: 'lcdI2c', name: 'Vault screen', emoji: '🖥️' },
    { id: 'vaultLock', type: 'servo', name: 'Vault lock', emoji: '🔐' },
    { id: 'stick', type: 'joystick', name: 'Joystick', emoji: '🕹️' },
    { id: 'camPan', type: 'servo', name: 'Camera pan', emoji: '↔️' },
    { id: 'camTilt', type: 'servo', name: 'Camera tilt', emoji: '↕️' },
  ],
  missions: LAB_MISSIONS,
  controls: {
    thief: { type: 'action', emoji: '🦹', label: 'Send the thief', action: 'thief', busy: (s) => (s.thief !== 'away' ? 'Thief in the lab!' : null) },
    clap: { type: 'action', emoji: '👏', label: 'Clap!', action: 'clap' },
    talk: { type: 'action', emoji: '🗣️', label: 'Talk', action: 'talk', busy: (s) => (s.talking ? 'Talking…' : null) },
    hand: { type: 'slider', key: 'hand', emoji: '✋', title: 'Hand above the theremin', min: 5, max: 100, step: 1, format: (v) => (v >= 95 ? 'no hand' : `${Math.round(v)} cm`) },
    keypad: { type: 'keypad', device: 'keypad', title: 'Vault keypad' },
    stick: { type: 'joystick', device: 'stick', title: 'Joystick' },
    power: { type: 'action', emoji: '⚡', label: 'Power off & on', action: 'power' },
  },
  createSim: (setup) => new LabSim(setup),
  camera: { position: [0, 7, 10.5], target: [0, 1.2, -0.5] },
};
