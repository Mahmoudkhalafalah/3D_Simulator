// The Smart Garden in 3D: a vegetable bed with a soil sensor and sprinkler, a weather
// station with an LCD, and a greenhouse with a motorised roof window, an I2C screen,
// a purple grow light and an alert beacon.
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { live } from '../../sim/session';
import { useStore } from '../../store';
import { emptyState } from '../../devices/logic';
import { LcdScreen } from '../../bench/LcdScreen';
import { SkyAndLights, Tree, Bush } from '../smartHome/Environment';
import { MissionLabel, Rings } from '../shared/models';
import { GardenSim } from './sim';

type V3 = [number, number, number];
const st = (id: string) => live.states[id] ?? emptyState();
const FALLBACK = new GardenSim();
const garden = () => (live.sim instanceof GardenSim ? live.sim : FALLBACK);

function Box({ pos, size, color, cast = true, opacity }: { pos: V3; size: V3; color: string; cast?: boolean; opacity?: number }) {
  return (
    <mesh position={pos} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

function Bulb({ pos, color, get, r = 0.12 }: { pos: V3; color: string; get: () => number; r?: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.05 + get() * 5;
  });
  return (
    <mesh position={pos}>
      <sphereGeometry args={[r, 16, 12]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.05} toneMapped={false} />
    </mesh>
  );
}

function clickable(id: string) {
  const up = () => useStore.getState().setPressed(id, false);
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      useStore.getState().setPressed(id, true);
    },
    onPointerUp: up,
    onPointerLeave: up,
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = ''),
  };
}

// ------------------------------------------------------------------ ground
function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#7cc464" />
      </mesh>
      {/* stepping-stone path */}
      {[-0.2, 0.9, 2.0, 3.1, 4.2, 5.3].map((z, i) => (
        <mesh key={z} position={[0.9 + (i % 2) * 0.25, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[0.38, 14]} />
          <meshStandardMaterial color="#d6d3d1" />
        </mesh>
      ))}
      {/* fence */}
      {Array.from({ length: 23 }, (_, i) => -11 + i).map((x) => (
        <Box key={x} pos={[x, 0.45, -5.2]} size={[0.12, 0.9, 0.12]} color="#f5f5f4" />
      ))}
      <Box pos={[0, 0.6, -5.2]} size={[22, 0.08, 0.06]} color="#f5f5f4" />
      <Box pos={[0, 0.3, -5.2]} size={[22, 0.08, 0.06]} color="#f5f5f4" />
      {[-9.5, 8.5, -10, 9.8].map((x, i) => (
        <Tree key={x} position={[x, 0, i < 2 ? -7 : 3]} scale={1.1} />
      ))}
      {[-8.5, -6, 6.5, 8, -9.6].map((x, i) => (
        <Bush key={x} position={[x, 0.3, i % 2 ? -4.4 : 5]} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ the vegetable bed
const DRY = new THREE.Color('#c09a66');
const WET = new THREE.Color('#4a3222');

function Soil() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.color.copy(DRY).lerp(WET, garden().moisture);
  });
  return (
    <group position={[-3.5, 0, 1.8]}>
      <Box pos={[0, 0.17, 0]} size={[5, 0.34, 2]} color="#8b5a2b" />
      <mesh position={[0, 0.345, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.7, 1.7]} />
        <meshStandardMaterial ref={mat} color="#8b6b45" roughness={1} />
      </mesh>
    </group>
  );
}

const HEALTHY = new THREE.Color('#3f9b4b');
const SICK = new THREE.Color('#a8a24a');

function Plant({ x, z, phase }: { x: number; z: number; phase: number }) {
  const stem = useRef<THREE.Group>(null);
  const leaves = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(({ clock }) => {
    const h = garden().health;
    if (stem.current) {
      stem.current.rotation.z = (1 - h) * 0.9 + Math.sin(clock.elapsedTime * 1.3 + phase) * 0.03;
      stem.current.scale.y = 0.75 + h * 0.25;
    }
    for (const m of leaves.current) m?.color.copy(SICK).lerp(HEALTHY, h);
  });
  const leafPos: V3[] = [
    [0.18, 0.45, 0],
    [-0.18, 0.65, 0.05],
    [0.15, 0.85, -0.05],
    [-0.12, 1.0, 0],
  ];
  return (
    <group position={[x, 0.34, z]}>
      <group ref={stem}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 1.1, 8]} />
          <meshStandardMaterial color="#4d7c0f" />
        </mesh>
        {leafPos.map((p, i) => (
          <mesh key={i} position={p} rotation={[0, i, 0.5]} castShadow>
            <sphereGeometry args={[0.17, 10, 8]} />
            <meshStandardMaterial ref={(m) => void (m && (leaves.current[i] = m))} color="#3f9b4b" flatShading />
          </mesh>
        ))}
        {[
          [0.12, 0.6, 0.12],
          [-0.1, 0.8, 0.1],
        ].map((p, i) => (
          <mesh key={i} position={p as V3} castShadow>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color="#ef4444" roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SoilSensor() {
  return (
    <group position={[-1.7, 0.34, 2.4]}>
      {[-0.05, 0.05].map((x) => (
        <Box key={x} pos={[x, 0.1, 0]} size={[0.035, 0.3, 0.02]} color="#d4a017" />
      ))}
      <Box pos={[0, 0.32, 0]} size={[0.2, 0.18, 0.04]} color="#0f766e" />
      <Bulb pos={[0.06, 0.38, 0.03]} color="#22c55e" r={0.02} get={() => (st('soilSensor').on ? 1 : 0)} />
      <MissionLabel device="soilSensor" text="🌱 soil sensor" position={[0, 0.85, 0]} width={1.9} />
    </group>
  );
}

function MoistureLight() {
  const colors = ['#ef4444', '#facc15', '#22c55e'];
  return (
    <group position={[-0.6, 0, 2.95]}>
      <Box pos={[0, 0.5, 0]} size={[0.06, 1.0, 0.06]} color="#a16207" />
      <Box pos={[0, 1.15, 0]} size={[0.22, 0.6, 0.14]} color="#111827" />
      {colors.map((c, i) => (
        <Bulb key={c} pos={[0, 1.33 - i * 0.18, 0.075]} color={c} r={0.06} get={() => st('soilLight').levels[i] ?? 0} />
      ))}
      <MissionLabel device="soilLight" text="🚦 moisture light" position={[0, 1.75, 0]} width={2.1} />
    </group>
  );
}

/** Falling water drops in a box above the bed. */
function Drops({ active, center, size, count = 50 }: { active: () => boolean; center: V3; size: V3; count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, () => [Math.random(), Math.random(), Math.random()]), [count]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const im = mesh.current;
    if (!im) return;
    im.visible = active();
    if (!im.visible) return;
    const t = clock.elapsedTime;
    seeds.forEach(([a, b, c], i) => {
      const fall = (t * 1.4 + c) % 1;
      m.makeTranslation(center[0] + (a - 0.5) * size[0], center[1] + size[1] / 2 - fall * size[1], center[2] + (b - 0.5) * size[2]);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} visible={false}>
      <sphereGeometry args={[0.035, 6, 4]} />
      <meshStandardMaterial color="#60a5fa" transparent opacity={0.85} />
    </instancedMesh>
  );
}

function Watering() {
  const can = useRef<THREE.Group>(null);
  const pouring = () => garden().soaking > 0.01;
  useFrame(() => {
    if (can.current) can.current.visible = pouring();
  });
  return (
    <group>
      {/* tank, pump and sprinkler */}
      <group position={[-7.4, 0, 1.2]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.65, 0.65, 1.5, 24]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <Box pos={[0.9, 0.25, 0.6]} size={[0.5, 0.5, 0.5]} color="#0e7490" />
        <Bulb pos={[0.9, 0.55, 0.86]} color="#22c55e" r={0.05} get={() => (st('pump').on ? 1 : 0)} />
        <MissionLabel device="pump" text="💧 pump" position={[0.9, 1.0, 0.6]} width={1.3} />
      </group>
      {/* hose along the ground */}
      <Box pos={[-5.25, 0.05, 0.55]} size={[3.8, 0.08, 0.08]} color="#16a34a" />
      <group position={[-3.4, 0, 0.55]}>
        <Box pos={[0, 0.85, 0]} size={[0.07, 1.7, 0.07]} color="#475569" />
        <mesh position={[0, 1.72, 0.05]} rotation={[0.6, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.12, 0.14, 12]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>
      <Drops active={() => !!st('pump').on} center={[-3.5, 1.05, 1.8]} size={[4.2, 1.4, 1.5]} count={80} />
      {/* watering can when the player waters the plant */}
      <group ref={can} position={[-3.0, 1.9, 1.7]} rotation={[0, 0, -0.6]} visible={false}>
        <mesh castShadow>
          <cylinderGeometry args={[0.25, 0.28, 0.45, 16]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
        <mesh position={[-0.38, 0.05, 0]} rotation={[0, 0, 1.1]}>
          <cylinderGeometry args={[0.03, 0.05, 0.5, 8]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </group>
      <Drops active={pouring} center={[-3.55, 0.9, 1.7]} size={[0.4, 1.0, 0.4]} count={24} />
    </group>
  );
}

// ------------------------------------------------------------------ weather station
function WeatherStation() {
  return (
    <group position={[-1.2, 0, -2.3]}>
      <Box pos={[0, 0.95, 0]} size={[0.1, 1.9, 0.1]} color="#e5e7eb" />
      {/* Stevenson screen with the DHT11 inside */}
      <Box pos={[0, 1.95, 0]} size={[0.5, 0.42, 0.42]} color="#f8fafc" />
      <Box pos={[0, 2.19, 0]} size={[0.6, 0.06, 0.52]} color="#cbd5e1" />
      <group position={[0, 1.92, 0.215]}>
        <Box pos={[0, 0, 0]} size={[0.16, 0.2, 0.03]} color="#38bdf8" />
        <Rings active={() => live.running && live.engineTime - st('weather').ping < 0.4} color="#38bdf8" radius={0.12} speed={3} />
      </group>
      {/* the 16x2 LCD */}
      <Box pos={[0, 1.3, 0.04]} size={[1.45, 0.48, 0.06]} color="#14532d" />
      <group position={[0, 1.3, 0.075]}>
        <LcdScreen deviceId="gardenLcd" width={1.35} style="green" />
      </group>
      <MissionLabel device="weather" text="🌡️ weather sensor" position={[0.75, 2.45, 0]} width={1.3} />
    </group>
  );
}

// ------------------------------------------------------------------ greenhouse
const GH: V3 = [3.6, 0, -1.2];
const GH_W = 4.4;
const GH_D = 3.6;
const GH_H = 2.0;

function Greenhouse() {
  const pane = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const glass = { color: '#dbeafe', opacity: 0.28 };
  useFrame((_, dt) => {
    if (pane.current) pane.current.rotation.x = -garden().roof * 0.95;
    if (wheel.current) wheel.current.rotation.x += st('roofMotor').speed * dt * 10;
  });
  const posts: V3[] = [
    [-GH_W / 2, GH_H / 2, -GH_D / 2],
    [GH_W / 2, GH_H / 2, -GH_D / 2],
    [-GH_W / 2, GH_H / 2, GH_D / 2],
    [GH_W / 2, GH_H / 2, GH_D / 2],
  ];
  return (
    <group position={GH}>
      <Box pos={[0, 0.03, 0]} size={[GH_W + 0.2, 0.06, GH_D + 0.2]} color="#a8a29e" cast={false} />
      {posts.map((p, i) => (
        <Box key={i} pos={p} size={[0.1, GH_H, 0.1]} color="#f8fafc" />
      ))}
      {/* glass walls (front has a door gap) */}
      <Box pos={[0, GH_H / 2, -GH_D / 2]} size={[GH_W, GH_H, 0.03]} color={glass.color} opacity={glass.opacity} cast={false} />
      <Box pos={[-GH_W / 2, GH_H / 2, 0]} size={[0.03, GH_H, GH_D]} color={glass.color} opacity={glass.opacity} cast={false} />
      <Box pos={[GH_W / 2, GH_H / 2, 0]} size={[0.03, GH_H, GH_D]} color={glass.color} opacity={glass.opacity} cast={false} />
      <Box pos={[-1.25, GH_H / 2, GH_D / 2]} size={[1.9, GH_H, 0.03]} color={glass.color} opacity={glass.opacity} cast={false} />
      <Box pos={[1.25, GH_H / 2, GH_D / 2]} size={[1.9, GH_H, 0.03]} color={glass.color} opacity={glass.opacity} cast={false} />
      {/* roof frame and fixed glass */}
      <Box pos={[0, GH_H, 0]} size={[GH_W + 0.1, 0.08, GH_D + 0.1]} color="#f8fafc" opacity={0.9} cast={false} />
      {/* the window that the motor opens: hinged at its back edge */}
      <group ref={pane} position={[0, GH_H + 0.06, -0.9]}>
        <Box pos={[0, 0, 0.9]} size={[2.2, 0.05, 1.8]} color="#bfdbfe" opacity={0.6} />
        <Box pos={[0, 0.02, 1.78]} size={[2.2, 0.06, 0.06]} color="#f8fafc" />
      </group>
      {/* roof motor on the hinge */}
      <group position={[-1.3, GH_H + 0.18, -0.9]}>
        <Box pos={[0, 0, 0]} size={[0.32, 0.22, 0.22]} color="#facc15" />
        <group ref={wheel} position={[0.22, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.06, 16]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <Box pos={[0.03, 0.08, 0]} size={[0.02, 0.08, 0.04]} color="#facc15" />
        </group>
        <MissionLabel device="roofMotor" text="🪟 roof motor" position={[0, 0.55, 0]} width={1.8} />
      </group>
      {/* inside: a table of seedlings and the grow light */}
      <Box pos={[0, 0.45, -0.6]} size={[3, 0.08, 1.2]} color="#a16207" />
      {[-1.1, -0.4, 0.3, 1.0].map((x) =>
        [-0.9, -0.3].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.49, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.14, 0.1, 0.2, 12]} />
              <meshStandardMaterial color="#c2410c" />
            </mesh>
            <mesh position={[0, 0.2, 0]} castShadow>
              <sphereGeometry args={[0.13, 10, 8]} />
              <meshStandardMaterial color="#4cb35a" flatShading />
            </mesh>
          </group>
        )),
      )}
      <GrowLight />
      <RoofButtons />
      {/* I2C screen on the front wall */}
      <group position={[1.25, 1.35, GH_D / 2 + 0.03]}>
        <Box pos={[0, 0, 0]} size={[1.1, 0.4, 0.06]} color="#1e3a8a" />
        <group position={[0, 0, 0.035]}>
          <LcdScreen deviceId="greenhouseLcd" width={1.0} style="blue" />
        </group>
        <MissionLabel device="greenhouseLcd" text="🖥️ I2C screen" position={[0, 0.5, 0.1]} width={1.8} />
      </group>
      {/* light sensor on the roof */}
      <group position={[1.9, GH_H + 0.05, 1.5]}>
        <Box pos={[0, 0.03, 0]} size={[0.22, 0.05, 0.18]} color="#7c3aed" />
        <mesh position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.03, 14]} />
          <meshStandardMaterial color="#e9b872" />
        </mesh>
        <MissionLabel device="growSensor" text="☀️ light sensor" position={[0, 0.5, 0]} width={1.9} />
      </group>
    </group>
  );
}

function GrowLight() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const [r = 0, g = 0, b = 0] = st('growLight').levels;
    const max = Math.max(r, g, b);
    c.setRGB(r, g, b);
    if (mat.current) {
      mat.current.emissive.copy(max > 0 ? c : mat.current.color);
      mat.current.emissiveIntensity = max > 0 ? 1 + max * 3 : 0.05;
    }
    if (light.current) {
      light.current.color.copy(c);
      light.current.intensity = max * 10;
    }
  });
  return (
    <group position={[0, 1.65, -0.6]}>
      <Box pos={[0, 0.2, 0]} size={[0.02, 0.4, 0.02]} color="#334155" />
      <mesh>
        <boxGeometry args={[2.2, 0.08, 0.2]} />
        <meshStandardMaterial ref={mat} color="#e2e8f0" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, -0.3, 0]} distance={4} decay={1.4} intensity={0} />
      <MissionLabel device="growLight" text="💜 grow light" position={[0, 0.55, 0.8]} width={1.8} />
    </group>
  );
}

function RoofButtons() {
  const open = useRef<THREE.Mesh>(null);
  const close = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (open.current) open.current.position.z = live.sense?.pressed('openButton') ? 0.04 : 0.07;
    if (close.current) close.current.position.z = live.sense?.pressed('closeButton') ? 0.04 : 0.07;
  });
  return (
    <group position={[-0.25, 1.1, GH_D / 2 + 0.05]}>
      <Box pos={[0, 0, 0]} size={[0.3, 0.55, 0.06]} color="#f8fafc" />
      <mesh ref={open} position={[0, 0.12, 0.07]} rotation={[Math.PI / 2, 0, 0]} {...clickable('openButton')}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 18]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      <mesh ref={close} position={[0, -0.12, 0.07]} rotation={[Math.PI / 2, 0, 0]} {...clickable('closeButton')}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 18]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <MissionLabel device="openButton" text="🔼 open · 🔽 close" position={[0, 0.55, 0.2]} width={2.3} />
    </group>
  );
}

function AlertBeacon() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const [r = 0, g = 0, b = 0] = st('alertLight').levels;
    const max = Math.max(r, g, b);
    c.setRGB(r, g, b);
    if (mat.current) {
      mat.current.emissive.copy(max > 0 ? c : mat.current.color);
      mat.current.emissiveIntensity = max > 0 ? 1 + max * 3 : 0.05;
    }
    if (light.current) {
      light.current.color.copy(c);
      light.current.intensity = max * 8;
    }
  });
  return (
    <group position={[6.6, 0, 1.4]}>
      <Box pos={[0, 1.05, 0]} size={[0.1, 2.1, 0.1]} color="#64748b" />
      <mesh position={[0, 2.25, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 14]} />
        <meshStandardMaterial ref={mat} color="#f1f5f9" transparent opacity={0.92} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 2.25, 0.3]} distance={6} decay={1.5} intensity={0} />
      <group position={[0, 1.55, 0.08]}>
        <Box pos={[0, 0, 0]} size={[0.2, 0.2, 0.1]} color="#111827" />
        <group position={[0, 0, 0.07]}>
          <Rings active={() => st('alarm').freq > 0} radius={0.12} speed={4} />
        </group>
      </group>
      <MissionLabel device="alertLight" text="🚨 alert light" position={[0, 2.85, 0]} width={1.9} />
    </group>
  );
}

export function GardenScene() {
  return (
    <>
      <SkyAndLights shadowSize={14} />
      <Ground />
      <Soil />
      {[-5.2, -4.1, -3.0, -1.9].map((x, i) => (
        <Plant key={x} x={x} z={1.5 + (i % 2) * 0.5} phase={i} />
      ))}
      <SoilSensor />
      <MoistureLight />
      <Watering />
      <WeatherStation />
      <Greenhouse />
      <AlertBeacon />
    </>
  );
}
