// The 3D scene of each world. Kept apart from the world definitions so the automated
// tests (which run in Node, without a browser) never load any 3D code.
import type { ComponentType } from 'react';
import { SmartHomeScene } from './smartHome/Scene';
import { TrafficTownScene } from './trafficTown/Scene';
import { GardenScene } from './garden/Scene';
import { LabScene } from './lab/Scene';
import { RobotScene } from './robot/Scene';

export const SCENES: Record<string, ComponentType> = {
  smartHome: SmartHomeScene,
  trafficTown: TrafficTownScene,
  garden: GardenScene,
  lab: LabScene,
  robot: RobotScene,
};
