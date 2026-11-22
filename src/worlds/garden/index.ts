import type { WorldDef } from '../types';
import { GARDEN_MISSIONS } from './missions';
import { GardenSim } from './sim';

export const GARDEN: WorldDef = {
  id: 'garden',
  title: 'Smart Garden',
  emoji: '🌱',
  tagline: 'Soil sensors, automatic watering, a weather screen and a greenhouse with a motorised roof.',
  help: 'Hold the greenhouse buttons to press them. Water the plant with the button below. Drag to look around.',
  devices: [
    { id: 'soilSensor', type: 'soil', name: 'Soil sensor', emoji: '🌱' },
    { id: 'soilLight', type: 'trafficLight', name: 'Moisture light', emoji: '🚦' },
    { id: 'pump', type: 'relay', name: 'Water pump relay', emoji: '💧' },
    { id: 'weather', type: 'dht', name: 'Weather sensor', emoji: '🌡️' },
    { id: 'gardenLcd', type: 'lcd', name: 'Garden screen', emoji: '📟' },
    { id: 'greenhouseLcd', type: 'lcdI2c', name: 'Greenhouse screen', emoji: '🖥️' },
    { id: 'alertLight', type: 'rgbLed', name: 'Alert light', emoji: '🚨' },
    { id: 'alarm', type: 'buzzer', name: 'Heat alarm', emoji: '🔔' },
    { id: 'roofMotor', type: 'motor', name: 'Roof motor', emoji: '🪟' },
    { id: 'openButton', type: 'button', name: 'Open button', emoji: '🔼' },
    { id: 'closeButton', type: 'button', name: 'Close button', emoji: '🔽' },
    { id: 'growSensor', type: 'ldr', name: 'Light sensor', emoji: '☀️' },
    { id: 'growLight', type: 'rgbLed', name: 'Grow light', emoji: '💜' },
  ],
  missions: GARDEN_MISSIONS,
  controls: {
    time: { type: 'time' },
    temperature: { type: 'slider', key: 'temperature', emoji: '🌡️', title: 'Temperature', min: 5, max: 45, step: 0.5, format: (v) => `${v.toFixed(1)} °C` },
    humidity: { type: 'slider', key: 'humidity', emoji: '💨', title: 'Air humidity', min: 10, max: 95, step: 1, format: (v) => `${Math.round(v)} %` },
    water: { type: 'action', emoji: '💧', label: 'Water the plant', action: 'water' },
    dry: { type: 'action', emoji: '☀️', label: 'Dry the soil', action: 'dry' },
  },
  createSim: (setup) => new GardenSim(setup),
  camera: { position: [0, 9, 13], target: [0, 0.8, 0] },
};
