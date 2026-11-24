import type { WorldDef } from '../types';
import { ROBOT_MISSIONS } from './missions';
import { RobotSim } from './sim';

export const ROBOT_ARENA: WorldDef = {
  id: 'robot',
  title: 'Robot Arena',
  emoji: '🤖',
  tagline: 'Build a robot car: dance, follow lines, dodge boxes, find the way out of a maze and drive it with a joystick.',
  help: 'Watch the robot drive on the mat. 🔄 puts it back on the start. Drag to look around.',
  devices: [
    { id: 'leftMotor', type: 'motor', name: 'Left wheel motor', emoji: '⬅️' },
    { id: 'rightMotor', type: 'motor', name: 'Right wheel motor', emoji: '➡️' },
    { id: 'bumper', type: 'button', name: 'Bumper switch', emoji: '🛡️' },
    { id: 'horn', type: 'buzzer', name: 'Horn', emoji: '📯' },
    { id: 'eyes', type: 'ultrasonic', name: 'Robot eyes', emoji: '👀' },
    { id: 'neck', type: 'servo', name: 'Head servo', emoji: '↔️' },
    { id: 'lineLeft', type: 'line', name: 'Left line sensor', emoji: '◀️' },
    { id: 'lineRight', type: 'line', name: 'Right line sensor', emoji: '▶️' },
    { id: 'lightSensor', type: 'ldr', name: 'Light sensor', emoji: '☀️' },
    { id: 'headlights', type: 'led', name: 'Headlights', emoji: '💡', color: '#fff7d6' },
    { id: 'remote', type: 'joystick', name: 'Remote joystick', emoji: '🕹️' },
  ],
  missions: ROBOT_MISSIONS,
  controls: {
    reset: { type: 'action', emoji: '🔄', label: 'Back to start', action: 'reset' },
    follow: { type: 'toggle', emoji: '🎥', label: 'Follow the robot', key: 'follow' },
    box: { type: 'action', emoji: '📦', label: 'Move the box', action: 'box', busy: (s) => (s.boxPresent === false ? 'The cat moved the box' : null) },
    remote: { type: 'joystick', device: 'remote', title: 'Remote joystick' },
    time: { type: 'time' },
  },
  createSim: (setup) => new RobotSim(setup),
  camera: { position: [0, 15.5, 18.5], target: [0, 0, 2.3] },
};
