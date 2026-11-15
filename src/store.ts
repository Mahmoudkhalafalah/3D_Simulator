import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Wire } from './sim/circuit';
import { getWorld } from './worlds';
import type { Mission, WorldDef } from './worlds/types';
import type { FriendlyDiagnostic } from './ui/friendly';

export interface Project {
  code: string;
  wires: Wire[];
}

export type RunStatus = 'stopped' | 'compiling' | 'running';
export type BottomTab = 'helper' | 'serial' | 'errors';

interface State {
  worldId: string;
  missionId: string;
  projects: Record<string, Project>;
  completed: Record<string, boolean>;
  welcomeSeen: boolean;
  muted: boolean;

  status: RunStatus;
  /** The code that is currently running (to warn when the editor has changed) */
  runningCode: string | null;
  diagnostics: FriendlyDiagnostic[];
  compileOutput: string;
  serial: string;
  bottomTab: BottomTab;
  objectivesDone: boolean[];
  celebrate: boolean;
  showMissions: boolean;
  showWelcome: boolean;
  showSolution: boolean;
  hintIndex: number;
  toolchain: 'unknown' | 'ready' | 'missing' | 'offline';
  simSpeed: number;
  /** Which 3D panel is enlarged */
  focus: 'world' | 'bench' | null;

  // wiring interaction
  pending: string | null;
  selectedWire: string | null;
  hoverPin: string | null;

  // world controls
  hour: number;
  autoTime: boolean;
  temperature: number;
  knob: number;
  carDistance: number;
  pressed: Record<string, boolean>;

  set: (partial: Partial<State>) => void;
  setCode: (code: string) => void;
  setWires: (wires: Wire[]) => void;
  setPressed: (id: string, value: boolean) => void;
  openMission: (missionId: string) => void;
  appendSerial: (text: string) => void;
}

export const projectKey = (worldId: string, missionId: string) => `${worldId}/${missionId}`;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      worldId: 'smartHome',
      missionId: 'blink',
      projects: {},
      completed: {},
      welcomeSeen: false,
      muted: false,

      status: 'stopped',
      runningCode: null,
      diagnostics: [],
      compileOutput: '',
      serial: '',
      bottomTab: 'helper',
      objectivesDone: [],
      celebrate: false,
      showMissions: false,
      showWelcome: true,
      showSolution: false,
      hintIndex: 0,
      toolchain: 'unknown',
      simSpeed: 1,
      focus: null,

      pending: null,
      selectedWire: null,
      hoverPin: null,

      hour: 12,
      autoTime: false,
      temperature: 24,
      knob: 0.5,
      carDistance: 350,
      pressed: {},

      set: (partial) => set(partial),
      setCode: (code) => {
        const { worldId, missionId, projects } = get();
        const key = projectKey(worldId, missionId);
        const current = projects[key] ?? defaultProject(getWorld(worldId), missionId);
        set({ projects: { ...projects, [key]: { ...current, code } } });
      },
      setWires: (wires) => {
        const { worldId, missionId, projects } = get();
        const key = projectKey(worldId, missionId);
        const current = projects[key] ?? defaultProject(getWorld(worldId), missionId);
        set({ projects: { ...projects, [key]: { ...current, wires } } });
      },
      setPressed: (id, value) => set({ pressed: { ...get().pressed, [id]: value } }),
      openMission: (missionId) => {
        const world = getWorld(get().worldId);
        const mission = world.missions.find((m) => m.id === missionId) ?? world.missions[0];
        set({
          missionId: mission.id,
          objectivesDone: mission.objectives.map(() => false),
          showMissions: false,
          showSolution: false,
          hintIndex: 0,
          diagnostics: [],
          compileOutput: '',
          serial: '',
          pending: null,
          selectedWire: null,
          celebrate: false,
          pressed: {},
          bottomTab: 'helper',
          ...(mission.setup ?? {}),
        });
      },
      appendSerial: (text) => {
        const next = get().serial + text;
        set({ serial: next.length > 20000 ? next.slice(-15000) : next });
      },
    }),
    {
      name: 'circuit-world',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        worldId: s.worldId,
        missionId: s.missionId,
        projects: s.projects,
        completed: s.completed,
        welcomeSeen: s.welcomeSeen,
        muted: s.muted,
      }),
    },
  ),
);

export function defaultProject(world: WorldDef, missionId: string): Project {
  const mission = world.missions.find((m) => m.id === missionId) ?? world.missions[0];
  return { code: mission.starterCode, wires: [] };
}

export function useWorld(): WorldDef {
  return getWorld(useStore((s) => s.worldId));
}

export function useMission(): Mission {
  const world = useWorld();
  const id = useStore((s) => s.missionId);
  return world.missions.find((m) => m.id === id) ?? world.missions[0];
}

export function useProject(): Project {
  const world = useWorld();
  const key = useStore((s) => projectKey(s.worldId, s.missionId));
  const project = useStore((s) => s.projects[key]);
  const missionId = useStore((s) => s.missionId);
  return project ?? defaultProject(world, missionId);
}

export function currentProject(): Project {
  const s = useStore.getState();
  return s.projects[projectKey(s.worldId, s.missionId)] ?? defaultProject(getWorld(s.worldId), s.missionId);
}

export function currentMission(): Mission {
  const s = useStore.getState();
  const world = getWorld(s.worldId);
  return world.missions.find((m) => m.id === s.missionId) ?? world.missions[0];
}

export function missionDevices(world: WorldDef, mission: Mission) {
  return world.devices.filter((d) => mission.devices.includes(d.id));
}
