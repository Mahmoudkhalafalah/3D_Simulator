import type { WorldDef } from '../types';
import { SMART_HOME_MISSIONS } from './missions';

export const SMART_HOME: WorldDef = {
  id: 'smartHome',
  title: 'Smart House',
  emoji: '🏠',
  tagline: 'Lights, doorbells, automatic doors and a parking sensor for the garage.',
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
};
