import type { WorldDef } from '../types';
import { SMART_HOME_MISSIONS } from './missions';
import { SmartHomeSim } from './actors';

export const SMART_HOME: WorldDef = {
  id: 'smartHome',
  title: 'Smart House',
  emoji: '🏠',
  tagline: 'Lights, doorbells, automatic doors and a parking sensor for the garage.',
  help: 'Click the doorbell or light switch to press them. Drag to look around.',
  devices: [
    { id: 'porchLight', type: 'led', name: 'Porch light', emoji: '💡', color: '#ffd166' },
    { id: 'doorbell', type: 'button', name: 'Doorbell', emoji: '🔘' },
    { id: 'chime', type: 'buzzer', name: 'Chime', emoji: '🔔' },
    { id: 'motion', type: 'pir', name: 'Motion sensor', emoji: '👀' },
    { id: 'door', type: 'servo', name: 'Door motor', emoji: '🚪' },
    { id: 'lightSensor', type: 'ldr', name: 'Roof light sensor', emoji: '☀️' },
    { id: 'roomLamp', type: 'relay', name: 'Room lamp relay', emoji: '🛋️' },
    { id: 'lightSwitch', type: 'button', name: 'Light switch', emoji: '🎚️' },
    { id: 'fan', type: 'fan', name: 'Fan', emoji: '🌀' },
    { id: 'thermo', type: 'temp', name: 'Thermometer', emoji: '🌡️' },
    { id: 'dimmer', type: 'pot', name: 'Dimmer knob', emoji: '🎛️' },
    { id: 'parking', type: 'ultrasonic', name: 'Parking sensor', emoji: '📏' },
    { id: 'beeper', type: 'buzzer', name: 'Garage beeper', emoji: '📢' },
  ],
  missions: SMART_HOME_MISSIONS,
  controls: {
    time: { type: 'time' },
    temperature: { type: 'slider', key: 'temperature', emoji: '🌡️', title: 'Room temperature', min: 10, max: 40, step: 0.5, format: (v) => `${v.toFixed(1)} °C` },
    knob: { type: 'slider', key: 'dimmer', emoji: '🎛️', title: 'Dimmer knob', min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
    car: {
      type: 'hold',
      emoji: '🚗',
      title: 'Car',
      buttons: [
        { label: '⬆ Drive in', action: 'car', arg: 1 },
        { label: '⬇ Back up', action: 'car', arg: -1 },
      ],
      readout: (s) => `${Math.round(Number(s.carDistance))} cm`,
    },
    visitor: {
      type: 'action',
      emoji: '🚶',
      label: 'Send a visitor',
      action: 'visitor',
      busy: (s) => (s.visitor !== 'away' ? 'Visitor is here…' : null),
    },
  },
  createSim: (setup) => new SmartHomeSim(setup),
  camera: { position: [2.5, 11, 13.5], target: [0, 0.6, -0.3] },
};
