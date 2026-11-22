// Traffic Town in 3D: a main street with a zebra crossing, a railway level crossing,
// a car park with a gate, street lamps and buildings. Everything reads the live
// simulation every frame.
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { live } from '../../sim/session';
import { useStore } from '../../store';
import { emptyState } from '../../devices/logic';
import { canvasTexture } from '../../bench/textures';
import { SevenSegDigit } from '../../bench/CourseModules';
import { daylight } from '../sense';
import { SkyAndLights, Tree, Bush } from '../smartHome/Environment';
import { CarBody, MissionLabel, Person, Rings } from '../shared/models';
import { CAR_LEN, GATE_SENSOR_Z, GATE_Z, LANE_Z, PARK_X, RAIL_X, TRAIN_LENGTH, TRAIN_SENSOR_Z, TrafficSim, lightOf } from './sim';

type V3 = [number, number, number];
const st = (id: string) => live.states[id] ?? emptyState();
const FALLBACK = new TrafficSim({ traffic: false });
const town = () => (live.sim instanceof TrafficSim ? live.sim : FALLBACK);
const night = () => 1 - daylight(useStore.getState().hour);

function Box({ pos, size, color, cast = true, rot }: { pos: V3; size: V3; color: string; cast?: boolean; rot?: V3 }) {
  return (
    <mesh position={pos} rotation={rot} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** An emissive bulb whose brightness follows get(). */
function Bulb({ pos, color, get, r = 0.14 }: { pos: V3; color: string; get: () => number; r?: number }) {
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
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useStore.getState().setPressed(id, true);
  };
  const up = () => useStore.getState().setPressed(id, false);
  return {
    onPointerDown: down,
    onPointerUp: up,
    onPointerLeave: up,
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = ''),
  };
}

// ---------------------------------------------------------------- ground and roads
function Ground() {
  const zebra = useMemo(() => Array.from({ length: 6 }, (_, i) => -1.85 + i * 0.74), []);
  const sleepers = useMemo(() => Array.from({ length: 120 }, (_, i) => -50 + i * 0.85).filter((z) => Math.abs(z) > 2.4), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#6fbf5a" />
      </mesh>
      {/* main road */}
      <Box pos={[0, 0, 0]} size={[64, 0.04, 4.4]} color="#3f4652" cast={false} />
      {Array.from({ length: 16 }, (_, i) => -30 + i * 4)
        .filter((x) => Math.abs(x) > 3 && Math.abs(x - RAIL_X) > 2.5)
        .map((x) => (
          <Box key={x} pos={[x, 0.025, 0]} size={[2, 0.01, 0.12]} color="#f8fafc" cast={false} />
        ))}
      {/* sidewalks */}
      <Box pos={[0, 0.06, 2.9]} size={[64, 0.12, 1.4]} color="#cbd5e1" cast={false} />
      <Box pos={[0, 0.06, -2.9]} size={[64, 0.12, 1.4]} color="#cbd5e1" cast={false} />
      {/* zebra crossing and stop lines */}
      {zebra.map((z) => (
        <Box key={z} pos={[0, 0.026, z]} size={[2.4, 0.01, 0.42]} color="#f8fafc" cast={false} />
      ))}
      <Box pos={[-2.0, 0.026, 1.1]} size={[0.25, 0.01, 2.1]} color="#f8fafc" cast={false} />
      <Box pos={[2.0, 0.026, -1.1]} size={[0.25, 0.01, 2.1]} color="#f8fafc" cast={false} />
      {/* railway */}
      <Box pos={[RAIL_X, 0.01, 0]} size={[2.6, 0.06, 110]} color="#8b8378" cast={false} />
      {sleepers.map((z) => (
        <Box key={z} pos={[RAIL_X, 0.06, z]} size={[2.1, 0.06, 0.3]} color="#6b4f36" cast={false} />
      ))}
      {[-0.7, 0.7].map((dx) => (
        <Box key={dx} pos={[RAIL_X + dx, 0.12, 0]} size={[0.1, 0.1, 110]} color="#9ca3af" cast={false} />
      ))}
      {/* car park: driveway and lot */}
      <Box pos={[PARK_X, 0.03, 5.2]} size={[2.6, 0.04, 4.8]} color="#4b5563" cast={false} />
      <Box pos={[PARK_X + 1, 0.03, 11]} size={[14, 0.04, 6.8]} color="#4b5563" cast={false} />
      {[-12.5, -9.5, -3.5, -0.5].map((x) => (
        <Box key={x} pos={[x, 0.055, 11.6]} size={[0.1, 0.01, 4]} color="#f8fafc" cast={false} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- buildings and trees
function windowTexture(seed: number) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 3; x++) {
        g.fillStyle = (x + y + seed) % 4 === 0 ? '#fde68a' : '#334155';
        g.fillRect(14 + x * 38, 14 + y * 40, 24, 26);
      }
  });
}

function Building({ x, z, w, h, d, color, seed }: { x: number; z: number; w: number; h: number; d: number; color: string; seed: number }) {
  const tex = useMemo(() => {
    const t = windowTexture(seed);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(w / 2.4)), Math.max(1, Math.round(h / 5)));
    return t;
  }, [seed, w, h]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = night() * 0.6;
  });
  return (
    <group position={[x, h / 2, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.01]}>
        <planeGeometry args={[w - 0.4, h - 0.6]} />
        <meshStandardMaterial ref={mat} map={tex} color={color} emissive="#fde68a" emissiveMap={tex} emissiveIntensity={0} />
      </mesh>
      <Box pos={[0, h / 2 + 0.15, 0]} size={[w + 0.3, 0.3, d + 0.3]} color="#475569" />
    </group>
  );
}

function Scenery() {
  const blocks = [
    { x: -22, w: 6, h: 9, color: '#f4a261' },
    { x: -15, w: 5, h: 6, color: '#e9c46a' },
    { x: -8.5, w: 6, h: 11, color: '#90caf9' },
    { x: -2, w: 5, h: 7, color: '#ef9a9a' },
    { x: 4.5, w: 6, h: 9.5, color: '#a5d6a7' },
    { x: 19, w: 6, h: 8, color: '#ce93d8' },
    { x: 26, w: 5, h: 6, color: '#ffcc80' },
  ];
  return (
    <group>
      {blocks.map((b, i) => (
        <Building key={b.x} x={b.x} z={-8.5} w={b.w} h={b.h} d={6} color={b.color} seed={i} />
      ))}
      {[3, 6.5, 17, 21, 25].map((x, i) => (
        <Tree key={x} position={[x, 0, 6 + (i % 2) * 3]} scale={0.9} />
      ))}
      {[-18, -22.5, 9.5, 15].map((x) => (
        <Tree key={x} position={[x, 0, -4.6]} scale={0.7} />
      ))}
      {[-16, -14.5, 0.8, 2].map((x) => (
        <Bush key={x} position={[x, 0.3, 8]} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- the crossing
function TrafficHead({ pos, rotY }: { pos: V3; rotY: number }) {
  const colors = ['#ef4444', '#facc15', '#22c55e'];
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <Box pos={[0, 0, 0]} size={[0.42, 1.2, 0.36]} color="#111827" />
      {colors.map((c, i) => (
        <Bulb key={c} pos={[0, 0.36 - i * 0.36, 0.19]} color={c} r={0.13} get={() => st('carLight').levels[i] ?? 0} />
      ))}
    </group>
  );
}

function WalkSign({ pos, rotY }: { pos: V3; rotY: number }) {
  const tex = useMemo(
    () =>
      canvasTexture(64, 96, (g) => {
        g.fillStyle = '#052e16';
        g.fillRect(0, 0, 64, 96);
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(34, 18, 8, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 8;
        g.strokeStyle = '#ffffff';
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(32, 30);
        g.lineTo(30, 56);
        g.lineTo(18, 82);
        g.moveTo(30, 56);
        g.lineTo(44, 80);
        g.moveTo(31, 38);
        g.lineTo(16, 50);
        g.moveTo(31, 38);
        g.lineTo(46, 48);
        g.stroke();
      }),
    [],
  );
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.05 + st('walkLamp').brightness * 2.5;
  });
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <Box pos={[0, 0, 0]} size={[0.44, 0.6, 0.2]} color="#111827" />
      <mesh position={[0, 0, 0.105]}>
        <planeGeometry args={[0.34, 0.5]} />
        <meshStandardMaterial ref={mat} map={tex} color="#86efac" emissive="#4ade80" emissiveMap={tex} emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CrossingPoles() {
  const btn = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (btn.current) btn.current.position.z = live.sense?.pressed('crossButton') ? 0.09 : 0.13;
  });
  return (
    <group>
      {/* pole A: near side, for eastbound cars */}
      <group position={[-2.6, 0, 2.75]}>
        <Box pos={[0, 1.6, 0]} size={[0.14, 3.2, 0.14]} color="#64748b" />
        <TrafficHead pos={[0, 3.0, 0]} rotY={-Math.PI / 2} />
        <WalkSign pos={[0, 2.1, 0.05]} rotY={Math.PI} />
        {/* crossing button box, facing the sidewalk */}
        <group position={[0.12, 1.15, 0.1]}>
          <Box pos={[0, 0, 0]} size={[0.26, 0.36, 0.16]} color="#facc15" />
          <mesh ref={btn} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.13]} {...clickable('crossButton')}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 18]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        </group>
        {/* beeper */}
        <group position={[0.12, 1.6, 0.1]}>
          <Box pos={[0, 0, 0]} size={[0.2, 0.2, 0.12]} color="#111827" />
          <group position={[0, 0, 0.1]}>
            <Rings active={() => st('crossBeeper').freq > 0} radius={0.12} speed={4} />
          </group>
        </group>
        <MissionLabel device="crossButton" text="🔘 push to cross" position={[0.3, 0.6, 0.5]} width={2.4} />
      </group>
      {/* pole B: far side, for westbound cars; the countdown and walk sign face the viewer */}
      <group position={[2.6, 0, -2.75]}>
        <Box pos={[0, 1.6, 0]} size={[0.14, 3.2, 0.14]} color="#64748b" />
        <TrafficHead pos={[0, 3.0, 0]} rotY={Math.PI / 2} />
        <WalkSign pos={[-0.3, 2.1, 0.1]} rotY={0} />
      </group>
      {/* pedestrian countdown display */}
      <group position={[-1.4, 0, 3.4]}>
        <Box pos={[0, 1.2, 0]} size={[0.1, 2.4, 0.1]} color="#64748b" />
        <Box pos={[0, 2.45, 0]} size={[0.9, 1.2, 0.18]} color="#111827" />
        <group position={[0, 2.45, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <SevenSegDigit get={() => st('countdown').levels} scale={0.42} />
        </group>
      </group>
    </group>
  );
}

function EmergencyButton() {
  const cap = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (cap.current) cap.current.position.y = live.sense?.pressed('emergencyButton') ? 1.12 : 1.2;
  });
  return (
    <group position={[-4.3, 0, 3.3]}>
      <Box pos={[0, 0.5, 0]} size={[0.12, 1.0, 0.12]} color="#64748b" />
      <Box pos={[0, 1.0, 0]} size={[0.45, 0.3, 0.45]} color="#facc15" />
      <mesh ref={cap} position={[0, 1.2, 0]} castShadow {...clickable('emergencyButton')}>
        <cylinderGeometry args={[0.22, 0.25, 0.16, 24]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} />
      </mesh>
      <MissionLabel device="emergencyButton" text="🛑 emergency" position={[0, 1.75, 0]} width={2.0} />
    </group>
  );
}

// ---------------------------------------------------------------- street lamps
function StreetLamp({ x }: { x: number }) {
  const light = useRef<THREE.PointLight>(null);
  const b = () => st('streetLamps').brightness;
  useFrame(() => {
    if (light.current) light.current.intensity = b() * 14;
  });
  return (
    <group position={[x, 0, 3.45]}>
      <Box pos={[0, 1.8, 0]} size={[0.12, 3.6, 0.12]} color="#475569" />
      <Box pos={[0, 3.55, -0.45]} size={[0.1, 0.1, 0.9]} color="#475569" />
      <Box pos={[0, 3.5, -0.9]} size={[0.5, 0.14, 0.32]} color="#334155" />
      <Bulb pos={[0, 3.4, -0.9]} color="#ffd166" get={b} r={0.13} />
      <pointLight ref={light} position={[0, 3.2, -1.1]} color="#ffd9a0" distance={9} decay={1.4} intensity={0} />
    </group>
  );
}

function StreetLights() {
  return (
    <group>
      {[-16, -5.5, 5.5, 17].map((x) => (
        <StreetLamp key={x} x={x} />
      ))}
      <group position={[-6.4, 0, 3.6]}>
        <Box pos={[0, 0.9, 0]} size={[0.08, 1.8, 0.08]} color="#64748b" />
        <Box pos={[0, 1.82, 0]} size={[0.28, 0.06, 0.22]} color="#7c3aed" />
        <mesh position={[0, 1.87, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.03, 16]} />
          <meshStandardMaterial color="#e9b872" />
        </mesh>
        <MissionLabel device="streetSensor" text="☀️ light sensor" position={[0, 2.35, 0]} width={2.2} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- railway crossing
function Crossbuck({ pos, rotY }: { pos: V3; rotY: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <Box pos={[0, 1.5, 0]} size={[0.12, 3.0, 0.12]} color="#e5e7eb" />
      <Box pos={[0, 2.75, 0.08]} size={[1.3, 0.18, 0.04]} color="#f8fafc" rot={[0, 0, 0.6]} />
      <Box pos={[0, 2.75, 0.08]} size={[1.3, 0.18, 0.04]} color="#f8fafc" rot={[0, 0, -0.6]} />
      <Box pos={[0, 2.0, 0.08]} size={[0.9, 0.14, 0.08]} color="#111827" />
      <Bulb pos={[-0.32, 2.0, 0.16]} color="#ef4444" r={0.14} get={() => st('railLampL').brightness} />
      <Bulb pos={[0.32, 2.0, 0.16]} color="#ef4444" r={0.14} get={() => st('railLampR').brightness} />
      <group position={[0, 2.35, 0.1]}>
        <mesh>
          <sphereGeometry args={[0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d4a017" metalness={0.8} roughness={0.3} />
        </mesh>
        <Rings active={() => st('railBell').freq > 0} radius={0.18} speed={3} />
      </group>
    </group>
  );
}

function BarrierArm({ pivot, dir }: { pivot: V3; dir: 1 | -1 }) {
  const arm = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = live.states.railBarrier ? THREE.MathUtils.degToRad(st('railBarrier').angle) : Math.PI / 2;
    if (arm.current) arm.current.rotation.x = dir * a;
  });
  return (
    <group position={pivot}>
      <Box pos={[0, 0.5, 0]} size={[0.3, 1.0, 0.3]} color="#f8fafc" />
      <group ref={arm} position={[0, 0.9, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} pos={[0, 0, -dir * (0.3 + i * 0.5)]} size={[0.1, 0.12, 0.5]} color={i % 2 ? '#f8fafc' : '#dc2626'} />
        ))}
      </group>
    </group>
  );
}

function TrainSensor() {
  const beam = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (beam.current) beam.current.visible = live.running && !!live.states.trainSensor?.powered && st('trainSensor').on;
  });
  return (
    <group position={[RAIL_X + 1.6, 0, TRAIN_SENSOR_Z]}>
      <Box pos={[0, 0.45, 0]} size={[0.1, 0.9, 0.1]} color="#64748b" />
      <Box pos={[-0.1, 0.95, 0]} size={[0.3, 0.2, 0.3]} color="#1d4ed8" />
      <mesh ref={beam} position={[-0.6, 0.95, 0]} rotation={[0, 0, Math.PI / 2]} visible={false}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.7} />
      </mesh>
      <MissionLabel device="trainSensor" text="👁️ train sensor" position={[0.3, 1.6, 0]} width={2.3} />
    </group>
  );
}

function RailwayCrossing() {
  return (
    <group>
      <Crossbuck pos={[RAIL_X - 2.2, 0, 3.0]} rotY={-0.6} />
      <Crossbuck pos={[RAIL_X + 2.2, 0, -3.0]} rotY={Math.PI - 0.6} />
      <BarrierArm pivot={[RAIL_X - 2.4, 0, 2.4]} dir={1} />
      <BarrierArm pivot={[RAIL_X + 2.4, 0, -2.4]} dir={-1} />
      <TrainSensor />
    </group>
  );
}

function TrainCar({ offset, color, loco }: { offset: number; color: string; loco?: boolean }) {
  return (
    <group position={[0, 0, -offset]}>
      <Box pos={[0, 0.9, -2]} size={[2.2, 1.6, 3.8]} color={color} />
      <Box pos={[0, 1.5, -2]} size={[2.25, 0.35, 3.85]} color="#f8fafc" />
      {loco && <Box pos={[0, 2.0, -2.6]} size={[1.8, 0.8, 2.2]} color={color} />}
      {loco && <Box pos={[0, 1.0, -0.05]} size={[1.6, 0.6, 0.1]} color="#fde047" />}
      {[-1.2, -2.8].map((z) => (
        <Box key={z} pos={[0, 0.25, z]} size={[2.0, 0.3, 0.5]} color="#111827" />
      ))}
    </group>
  );
}

function Train() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = town().train;
    if (!group.current) return;
    group.current.visible = t.active;
    group.current.position.set(RAIL_X, 0, t.z);
  });
  return (
    <group ref={group} visible={false}>
      <TrainCar offset={0} color="#dc2626" loco />
      <TrainCar offset={TRAIN_LENGTH / 3 + 0.4} color="#2563eb" />
      <TrainCar offset={(2 * TRAIN_LENGTH) / 3 + 0.4} color="#2563eb" />
    </group>
  );
}

// ---------------------------------------------------------------- car park gate
function ParkGate() {
  const arm = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const a = live.states.gateBarrier ? THREE.MathUtils.degToRad(st('gateBarrier').angle) : 0;
    if (arm.current) arm.current.rotation.z = a;
    if (wave.current) {
      const t = (live.engineTime - st('gateSensor').ping) / 0.4;
      wave.current.visible = live.running && t >= 0 && t < 1;
      wave.current.position.z = -0.2 - t * 1.6;
      wave.current.scale.setScalar(0.5 + t);
    }
  });
  return (
    <group>
      <group position={[PARK_X - 1.5, 0, GATE_Z]}>
        <Box pos={[0, 0.55, 0]} size={[0.4, 1.1, 0.4]} color="#facc15" />
        <group ref={arm} position={[0, 1.0, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Box key={i} pos={[0.35 + i * 0.5, 0, 0]} size={[0.5, 0.12, 0.1]} color={i % 2 ? '#f8fafc' : '#dc2626'} />
          ))}
        </group>
      </group>
      <group position={[PARK_X + 1.6, 0, GATE_SENSOR_Z]}>
        <Box pos={[0, 0.4, 0]} size={[0.1, 0.8, 0.1]} color="#64748b" />
        <Box pos={[-0.3, 0.8, -0.05]} size={[0.7, 0.25, 0.12]} color="#1e40af" />
        {[-0.48, -0.12].map((x) => (
          <mesh key={x} position={[x, 0.8, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.8} />
          </mesh>
        ))}
        <mesh ref={wave} position={[-0.3, 0.8, -0.2]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
          <torusGeometry args={[0.3, 0.03, 8, 24, Math.PI]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
        </mesh>
        <MissionLabel device="gateSensor" text="📏 distance sensor" position={[-0.3, 1.5, 0]} width={2.6} />
      </group>
      <MissionLabel device="gateBarrier" text="🅿️ car park" position={[PARK_X + 1, 2.2, 12]} width={2.4} />
    </group>
  );
}

// ---------------------------------------------------------------- vehicles and people
const POOL = 12;

function Traffic() {
  const slots = useRef<(THREE.Group | null)[]>([]);
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const assigned = useRef<(number | null)[]>(Array(POOL).fill(null));
  const info = useRef<{ wheel: number; braking: boolean }[]>(Array.from({ length: POOL }, () => ({ wheel: 0, braking: false })));
  useFrame(() => {
    const cars = town().cars;
    const ids = new Set(cars.map((c) => c.id));
    assigned.current = assigned.current.map((id) => (id !== null && ids.has(id) ? id : null));
    for (const car of cars) {
      if (assigned.current.includes(car.id)) continue;
      const free = assigned.current.indexOf(null);
      if (free < 0) continue;
      assigned.current[free] = car.id;
      mats.current[free]?.color.set(car.color);
    }
    assigned.current.forEach((id, i) => {
      const g = slots.current[i];
      if (!g) return;
      const car = id === null ? null : cars.find((c) => c.id === id);
      g.visible = !!car;
      if (!car) return;
      g.position.set(car.x, 0, car.dir === 1 ? LANE_Z : -LANE_Z);
      g.rotation.y = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      info.current[i].wheel = car.wheel;
      info.current[i].braking = car.speed < 4.5;
    });
  });
  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <group key={i} ref={(g) => void (slots.current[i] = g)} visible={false}>
          <CarBody
            color="#ef4444"
            materialRef={(m) => void (mats.current[i] = m)}
            wheelSpin={() => info.current[i].wheel}
            braking={() => info.current[i].braking}
            headlights={night}
          />
        </group>
      ))}
    </group>
  );
}

function ParkCarView() {
  const group = useRef<THREE.Group>(null);
  const dist = useRef(0);
  const last = useRef({ x: 0, z: 0 });
  useFrame(() => {
    const p = town().park;
    const g = group.current;
    if (!g) return;
    g.visible = p.phase !== 'away';
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rot;
    dist.current += Math.hypot(p.x - last.current.x, p.z - last.current.z);
    last.current = { x: p.x, z: p.z };
  });
  return (
    <group ref={group} visible={false}>
      <CarBody color="#0ea5e9" wheelSpin={() => dist.current} braking={() => town().park.phase === 'waiting'} headlights={night} />
    </group>
  );
}

function ParkedCars() {
  return (
    <group>
      {[
        { x: -14, c: '#f59e0b' },
        { x: -11, c: '#10b981' },
        { x: -2, c: '#8b5cf6' },
      ].map((p) => (
        <group key={p.x} position={[p.x, 0, 12]} rotation={[0, Math.PI, 0]}>
          <CarBody color={p.c} />
        </group>
      ))}
    </group>
  );
}

function People() {
  return (
    <group>
      <Person
        shirt="#22c55e"
        pants="#334155"
        pose={() => {
          const w = town().walker;
          return { visible: w.phase !== 'away', x: w.x, z: w.z, rot: w.rot, walk: w.walk, walking: w.phase !== 'waiting', armUp: w.pressing };
        }}
      />
      <Person
        shirt="#f43f5e"
        pants="#1e3a8a"
        hair="#facc15"
        scale={0.7}
        pose={() => {
          const c = town().child;
          const on = c.phase === 'running' || c.phase === 'back';
          return { visible: on, x: c.x, z: c.z, rot: c.phase === 'back' ? 0 : Math.PI, walk: c.t * 1.6, walking: on && (c.phase === 'back' || c.z > -1.6), armUp: c.phase === 'running' };
        }}
      />
      <Ball />
    </group>
  );
}

function Ball() {
  const ball = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const c = town().child;
    if (!ball.current) return;
    ball.current.visible = c.phase === 'running' || c.phase === 'back';
    ball.current.position.set(c.x + 0.4, 0.17, c.ballZ);
    ball.current.rotation.x = -c.ballZ * 3;
  });
  return (
    <mesh ref={ball} visible={false} castShadow>
      <sphereGeometry args={[0.17, 16, 12]} />
      <meshStandardMaterial color="#f97316" />
    </mesh>
  );
}

/** Shows which traffic light colour is on, for the eastbound stop line (for debugging the eye). */
function StopLineGlow() {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    const l = lightOf(live.states.carLight);
    mat.current.opacity = l.red ? 0.35 : 0;
  });
  return (
    <mesh position={[-2.0, 0.03, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.6, 2.1]} />
      <meshBasicMaterial ref={mat} color="#ef4444" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function TrafficTownScene() {
  return (
    <>
      <SkyAndLights shadowSize={30} fogNear={60} fogFar={140} />
      <Ground />
      <Scenery />
      <CrossingPoles />
      <StopLineGlow />
      <EmergencyButton />
      <StreetLights />
      <RailwayCrossing />
      <Train />
      <ParkGate />
      <ParkedCars />
      <Traffic />
      <ParkCarView />
      <People />
    </>
  );
}

export { CAR_LEN };
