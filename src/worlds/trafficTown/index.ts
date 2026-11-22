import type { WorldDef } from '../types';
import { TRAFFIC_TOWN_MISSIONS } from './missions';
import { TrafficSim } from './sim';

export const TRAFFIC_TOWN: WorldDef = {
  id: 'trafficTown',
  title: 'Traffic Town',
  emoji: '🚦',
  tagline: 'Traffic lights, a beeping crossing, a railway barrier and a car park gate.',
  help: 'Click the crossing and emergency buttons to press them. Drag to look around.',
  devices: [
    { id: 'carLight', type: 'trafficLight', name: 'Traffic light', emoji: '🚦' },
    { id: 'walkLamp', type: 'led', name: 'Walk light', emoji: '🚶', color: '#22c55e' },
    { id: 'crossButton', type: 'button', name: 'Crossing button', emoji: '🔘' },
    { id: 'crossBeeper', type: 'buzzer', name: 'Crossing beeper', emoji: '🔊' },
    { id: 'countdown', type: 'sevenSeg', name: 'Countdown display', emoji: '🔢' },
    { id: 'railLampL', type: 'led', name: 'Rail lamp (left)', emoji: '🚨', color: '#ef4444' },
    { id: 'railLampR', type: 'led', name: 'Rail lamp (right)', emoji: '🚨', color: '#ef4444' },
    { id: 'trainSensor', type: 'ir', name: 'Train sensor', emoji: '👁️' },
    { id: 'railBarrier', type: 'servo', name: 'Railway barrier', emoji: '🚧' },
    { id: 'railBell', type: 'buzzer', name: 'Railway bell', emoji: '🔔' },
    { id: 'gateSensor', type: 'ultrasonic', name: 'Car park sensor', emoji: '📏' },
    { id: 'gateBarrier', type: 'servo', name: 'Car park gate', emoji: '🅿️' },
    { id: 'streetSensor', type: 'ldr', name: 'Street light sensor', emoji: '☀️' },
    { id: 'streetLamps', type: 'led', name: 'Street lamps', emoji: '💡', color: '#ffd166' },
    { id: 'emergencyButton', type: 'button', name: 'Emergency button', emoji: '🛑' },
  ],
  missions: TRAFFIC_TOWN_MISSIONS,
  controls: {
    time: { type: 'time' },
    walker: { type: 'action', emoji: '🚶', label: 'Send a pedestrian', action: 'walker', busy: (s) => (s.walker !== 'away' ? 'Pedestrian on the way…' : null) },
    train: { type: 'action', emoji: '🚂', label: 'Call a train', action: 'train', busy: (s) => (s.trainActive ? 'Train coming…' : null) },
    parkCar: {
      type: 'action',
      emoji: '🚗',
      label: 'Car to the car park',
      action: 'parkCar',
      busy: (s) => (s.parkCar !== 'away' && s.parkCar !== 'parked' ? 'Car on its way…' : null),
    },
    ball: { type: 'action', emoji: '⚽', label: 'Ball on the road!', action: 'ball', busy: (s) => (s.childOnRoad ? 'Child on the road!' : null) },
  },
  createSim: (setup) => new TrafficSim(setup),
  camera: { position: [-2, 17, 25], target: [0, 0, 1] },
};
