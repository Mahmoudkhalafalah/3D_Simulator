import type { WorldDef } from './types';
import { SMART_HOME } from './smartHome';

export const WORLDS: WorldDef[] = [SMART_HOME];

/** Worlds on the roadmap, shown as "coming soon" on the welcome screen. */
export const UPCOMING_WORLDS = [
  { emoji: '🚦', title: 'Traffic Town', tagline: 'Traffic lights, pedestrian crossings and a railway barrier.' },
  { emoji: '🌱', title: 'Smart Garden', tagline: 'Soil sensors, automatic watering and a weather station.' },
  { emoji: '🤖', title: 'Robot Arena', tagline: 'Drive a robot car, follow lines and dodge obstacles.' },
];

export function getWorld(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
