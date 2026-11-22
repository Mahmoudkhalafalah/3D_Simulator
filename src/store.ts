import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Wire } from './sim/circuit';
import { getWorld } from './worlds';
import { defaultInputs, type Mission, type WorldDef, type WorldInputs } from './worlds/types';
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
  showCourse: boolean;
  hintIndex: number;
  toolchain: 'unknown' | 'ready' | 'missing' | 'offline';
  simSpeed: number;
  /** Which 3D panel is enlarged */
  focus: 'world' | 'bench' | null;

  // wiring interaction
  pending: string | null;
  selectedWire: string | null;
  hoverPin: string | null;

  // world controls (see WorldInputs)
  hour: number;
  autoTime: boolean;
  temperature: number;
  humidity: number;
  values: Record<string, number>;
  pressed: Record<string, boolean>;
  keys: Record<string, string | null>;
  /** Bumped whenever a mission is (re)opened, so the world simulation restarts */
  epoch: number;

  set: (partial: Partial<State>) => void;
  setCode: (code: string) => void;
  setWires: (wires: Wire[]) => void;
  setPressed: (id: string, value: boolean) => void;
  setValue: (key: string, value: number) => void;
  setKey: (deviceId: string, key: string | null) => void;
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
      showCourse: false,
      hintIndex: 0,
      toolchain: 'unknown',
      simSpeed: 1,
      focus: null,

      pending: null,
      selectedWire: null,
      hoverPin: null,

      ...defaultInputs(),
      autoTime: false,
      epoch: 0,

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
      setValue: (key, value) => {
        if (key === 'temperature' || key === 'humidity') set({ [key]: value });
        else set({ values: { ...get().values, [key]: value } });
      },
      setKey: (deviceId, key) => set({ keys: { ...get().keys, [deviceId]: key } }),
      openMission: (missionId) => {
        const world = getWorld(get().worldId);
        const mission = world.missions.find((m) => m.id === missionId) ?? world.missions[0];
        const { values, ...setup } = mission.setup ?? {};
        const base = defaultInputs();
        set({
          hour: typeof setup.hour === 'number' ? setup.hour : base.hour,
          temperature: typeof setup.temperature === 'number' ? setup.temperature : base.temperature,
          humidity: typeof setup.humidity === 'number' ? setup.humidity : base.humidity,
          values: { ...(values ?? {}) },
          keys: {},
          autoTime: false,
          epoch: get().epoch + 1,
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

/** The player's inputs as the world simulation sees them. */
export function currentInputs(): WorldInputs {
  const s = useStore.getState();
  return { hour: s.hour, temperature: s.temperature, humidity: s.humidity, values: s.values, pressed: s.pressed, keys: s.keys };
}

export function missionDevices(world: WorldDef, mission: Mission) {
  return world.devices.filter((d) => mission.devices.includes(d.id));
}
