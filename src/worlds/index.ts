import type { WorldDef } from './types';
import { SMART_HOME } from './smartHome';
import { TRAFFIC_TOWN } from './trafficTown';
import { GARDEN } from './garden';
import { SECRET_LAB } from './lab';
import { ROBOT_ARENA } from './robot';

export const WORLDS: WorldDef[] = [SMART_HOME, TRAFFIC_TOWN, GARDEN, SECRET_LAB, ROBOT_ARENA];

/** Worlds on the roadmap, shown as "coming soon" on the welcome screen. */
export const UPCOMING_WORLDS: { emoji: string; title: string; tagline: string }[] = [];

export function getWorld(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
