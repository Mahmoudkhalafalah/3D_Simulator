import type { WorldDef } from './types';
import { SMART_HOME } from './smartHome';
import { TRAFFIC_TOWN } from './trafficTown';
import { GARDEN } from './garden';

export const WORLDS: WorldDef[] = [SMART_HOME, TRAFFIC_TOWN, GARDEN];

/** Worlds on the roadmap, shown as "coming soon" on the welcome screen. */
export const UPCOMING_WORLDS = [
  { emoji: '🤖', title: 'Robot Arena', tagline: 'Drive a robot car, follow lines and dodge obstacles.' },
];

export function getWorld(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
