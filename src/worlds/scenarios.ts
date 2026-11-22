// Test play-throughs for every world (used by tests/sim.test.ts only).
import type { Scenario } from './scenario';
import { SMART_HOME_SCENARIOS } from './smartHome/scenarios';
import { TRAFFIC_TOWN_SCENARIOS } from './trafficTown/scenarios';

export const SCENARIOS: Record<string, Record<string, Scenario>> = {
  smartHome: SMART_HOME_SCENARIOS,
  trafficTown: TRAFFIC_TOWN_SCENARIOS,
};
