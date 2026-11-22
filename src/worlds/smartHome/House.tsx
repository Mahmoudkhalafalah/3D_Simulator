// The Smart House: a cutaway "dollhouse" so kids can see inside. Every gadget in the
// house is driven by the module on the workbench with the same id.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { live } from '../../sim/session';
import { DOOR_X, SmartHomeSim } from './actors';
import { emptyState } from '../../devices/logic';
import { useStore } from '../../store';
import { canvasTexture, displayTexture } from '../../bench/textures';

const st = (id: string) => live.states[id] ?? emptyState();
const FALLBACK = new SmartHomeSim();
/** The running Smart House simulation (visitor, car). */
const home = () => (live.sim instanceof SmartHomeSim ? live.sim : FALLBACK);
const WALL_H = 2.6;
const CUT_H = 1.0;
const T = 0.15;

type V3 = [number, number, number];

function Box({ pos, size, color, cast = true, ...rest }: { pos: V3; size: V3; color: string; cast?: boolean } & Partial<THREE.MeshStandardMaterialParameters>) {
  return (
    <mesh position={pos} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} {...(rest as object)} />
    </mesh>
  );
}

/** Wall segment from x0..x1 (or z0..z1) with a darker "cut" cap on top, like a dollhouse. */
function Wall({ from, to, h = WALL_H, y0 = 0, color = '#f5efe6' }: { from: [number, number]; to: [number, number]; h?: number; y0?: number; color?: string }) {
  const [x0, z0] = from;
  const [x1, z1] = to;
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const size: V3 = alongX ? [len, h, T] : [T, h, len];
  const pos: V3 = [(x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2];
  const cap: V3 = alongX ? [len, 0.04, T + 0.01] : [T + 0.01, 0.04, len];
  return (
    <group>
      <Box pos={pos} size={size} color={color} roughness={0.9} />
      <Box pos={[pos[0], y0 + h + 0.02, pos[2]]} size={cap} color="#7c6f64" cast={false} />
    </group>
  );
}

function Structure() {
  return (
    <group>
      {/* floors */}
      <Box pos={[-2, -0.05, -0.5]} size={[6.15, 0.1, 5.15]} color="#c8915c" cast={false} />
      <Box pos={[3.1, -0.05, -0.5]} size={[4.2, 0.1, 5.15]} color="#a3a8b0" cast={false} />
      {/* porch */}
      <Box pos={[-2, 0.04, 2.75]} size={[2.2, 0.08, 1.4]} color="#d6cfc4" />

      {/* back + side walls */}
      <Wall from={[-5.075, -3]} to={[5.275, -3]} />
      <Wall from={[-5, -3]} to={[-5, 2.075]} />
      <Wall from={[1.05, -3]} to={[1.05, 2.075]} color="#efe6d8" />
      <Wall from={[5.2, -3]} to={[5.2, 2.075]} color="#e5e7eb" />

      {/* front wall: cut down so you can look inside, full height around the door */}
      <Wall from={[-5.075, 2]} to={[-2.95, 2]} h={CUT_H} />
      <Wall from={[-2.95, 2]} to={[-2.5, 2]} color="#e9dfd0" />
      <Wall from={[-1.5, 2]} to={[-1.05, 2]} color="#e9dfd0" />
      <Wall from={[-2.95, 2]} to={[-1.05, 2]} y0={2.1} h={WALL_H - 2.1} color="#e9dfd0" />
      <Wall from={[-1.05, 2]} to={[1.05, 2]} h={CUT_H} />

      {/* garage front: pillars + beam, door rolled up */}
      <Wall from={[1.05, 2]} to={[1.4, 2]} color="#e5e7eb" />
      <Wall from={[4.8, 2]} to={[5.275, 2]} color="#e5e7eb" />
      <Wall from={[1.4, 2]} to={[4.8, 2]} y0={2.25} h={WALL_H - 2.25} color="#e5e7eb" />
      <Box pos={[3.1, 2.12, 1.7]} size={[3.4, 0.22, 0.5]} color="#94a3b8" />

      {/* window on the back wall */}
      <mesh position={[-3.0, 1.55, -2.92]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshStandardMaterial color="#bfe3ff" emissive="#9fd8ff" emissiveIntensity={0.15} />
      </mesh>
      <Box pos={[-3.0, 1.55, -2.91]} size={[1.4, 0.06, 0.04]} color="#ffffff" cast={false} />
      <Box pos={[-3.0, 1.55, -2.91]} size={[0.06, 1.0, 0.04]} color="#ffffff" cast={false} />
    </group>
  );
}

function Furniture() {
  return (
    <group>
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.4, 0.005, -1.0]} receiveShadow>
        <planeGeometry args={[3.0, 2.0]} />
        <meshStandardMaterial color="#f9a8d4" />
      </mesh>
      {/* sofa */}
      <group position={[-3.0, 0, -2.4]}>
        <Box pos={[0, 0.25, 0]} size={[2.2, 0.45, 0.9]} color="#6366f1" />
        <Box pos={[0, 0.7, -0.35]} size={[2.2, 0.6, 0.22]} color="#4f46e5" />
        <Box pos={[-1.05, 0.45, 0]} size={[0.2, 0.5, 0.9]} color="#4f46e5" />
        <Box pos={[1.05, 0.45, 0]} size={[0.2, 0.5, 0.9]} color="#4f46e5" />
        <Box pos={[-0.5, 0.55, 0.05]} size={[0.5, 0.2, 0.5]} color="#fde68a" />
      </group>
      {/* coffee table */}
      <group position={[-2.6, 0, -1.0]}>
        <Box pos={[0, 0.42, 0]} size={[1.1, 0.06, 0.6]} color="#a16207" />
        {[[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]].map(([x, z], i) => (
          <Box key={i} pos={[x, 0.2, z]} size={[0.05, 0.4, 0.05]} color="#713f12" />
        ))}
        <mesh position={[0.2, 0.52, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.14, 12]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
      {/* bookshelf in the corner */}
      <group position={[-4.7, 0, 0.6]}>
        <Box pos={[0, 0.9, 0]} size={[0.4, 1.8, 1.0]} color="#92400e" />
        {[0.4, 0.9, 1.4].map((y) => (
          <group key={y}>
            <Box pos={[0.05, y, -0.25]} size={[0.3, 0.32, 0.12]} color="#ef4444" />
            <Box pos={[0.05, y, -0.08]} size={[0.3, 0.28, 0.1]} color="#22c55e" />
            <Box pos={[0.05, y, 0.1]} size={[0.3, 0.34, 0.14]} color="#3b82f6" />
          </group>
        ))}
      </group>
      {/* plant */}
      <group position={[0.5, 0, 1.4]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.14, 0.4, 12]} />
          <meshStandardMaterial color="#c2410c" />
        </mesh>
        <mesh position={[0, 0.65, 0]} castShadow>
          <icosahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial color="#16a34a" flatShading />
        </mesh>
      </group>
    </group>
  );
}

function FrontDoor() {
  const door = useRef<THREE.Group>(null);
  useFrame(() => {
    const angle = Math.min(100, st('door').angle);
    if (door.current) door.current.rotation.y = THREE.MathUtils.degToRad(angle);
  });
  return (
    <group ref={door} position={[DOOR_X - 0.5, 0, 2]}>
      <Box pos={[0.5, 1.05, 0]} size={[0.98, 2.08, 0.06]} color="#9a5b2c" />
      <Box pos={[0.5, 1.6, 0.035]} size={[0.5, 0.5, 0.01]} color="#bfe3ff" cast={false} />
      <mesh position={[0.85, 1.0, 0.07]}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshStandardMaterial color="#fcd34d" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function PorchLight() {
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const b = st('porchLight').brightness;
    if (glass.current) glass.current.emissiveIntensity = 0.05 + b * 6;
    if (light.current) light.current.intensity = b * 14;
  });
  return (
    <group position={[-2.72, 1.85, 2.12]}>
      <Box pos={[0, 0.22, 0]} size={[0.24, 0.06, 0.24]} color="#1f2937" />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.18, 0.36, 0.18]} />
        <meshStandardMaterial ref={glass} color="#ffe7a3" emissive="#ffc94d" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      <Box pos={[0, -0.21, 0]} size={[0.22, 0.05, 0.22]} color="#1f2937" />
      <pointLight ref={light} position={[0, -0.1, 0.4]} color="#ffcf73" distance={7} decay={1.6} intensity={0} />
    </group>
  );
}

function Doorbell() {
  const btn = useRef<THREE.Mesh>(null);
  const set = useStore((s) => s.setPressed);
  useFrame(() => {
    const pressed = !!live.sense?.pressed('doorbell');
    if (btn.current) btn.current.position.z = pressed ? 0.02 : 0.05;
  });
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    set('doorbell', true);
  };
  return (
    <group position={[-1.28, 1.25, 2.08]}>
      <Box pos={[0, 0, 0]} size={[0.14, 0.22, 0.03]} color="#f8fafc" cast={false} />
      <mesh
        ref={btn}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.05]}
        onPointerDown={down}
        onPointerUp={() => set('doorbell', false)}
        onPointerLeave={() => set('doorbell', false)}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <cylinderGeometry args={[0.05, 0.05, 0.05, 16]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function MotionSensor() {
  const led = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (led.current) led.current.emissiveIntensity = st('motion').on ? 5 : 0.05;
  });
  return (
    <group position={[DOOR_X, 2.38, 2.1]}>
      <Box pos={[0, 0, 0]} size={[0.22, 0.16, 0.08]} color="#f8fafc" />
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0.08, -0.05, 0.045]}>
        <sphereGeometry args={[0.015, 8, 6]} />
        <meshStandardMaterial ref={led} color="#ef4444" emissive="#ef4444" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A little name tag that always faces the camera. */
function LabelSprite({ text, position, width = 1.5 }: { text: string; position: V3; width?: number }) {
  const map = useMemo(
    () =>
      canvasTexture(512, 128, (g) => {
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath();
        g.roundRect(4, 4, 504, 120, 60);
        g.fill();
        g.fillStyle = '#0f172a';
        g.font = '800 58px Nunito, "Segoe UI Emoji", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 256, 68);
      }),
    [text],
  );
  return (
    <sprite position={position} scale={[width, width / 4, 1]}>
      <spriteMaterial map={map} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
}

function RoofLightSensor() {
  return (
    <group position={[-0.4, WALL_H, -3]}>
      <Box pos={[0, 0.2, 0]} size={[0.05, 0.4, 0.05]} color="#64748b" />
      <Box pos={[0, 0.42, 0]} size={[0.26, 0.05, 0.2]} color="#7c3aed" />
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
        <meshStandardMaterial color="#e9b872" />
      </mesh>
      <LabelSprite text="☀️ light sensor" position={[0, 1.0, 0]} width={2.6} />
    </group>
  );
}

function FloorLamp() {
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const on = st('roomLamp').on;
    if (bulb.current) bulb.current.emissiveIntensity = on ? 6 : 0.05;
    if (light.current) light.current.intensity = on ? 22 : 0;
  });
  return (
    <group position={[-4.5, 0, -2.5]}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.28, 0.06, 20]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <Box pos={[0, 0.85, 0]} size={[0.05, 1.65, 0.05]} color="#334155" />
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial ref={bulb} color="#fff4cc" emissive="#ffd27a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.38, 0.4, 24, 1, true]} />
        <meshStandardMaterial color="#fde68a" side={THREE.DoubleSide} transparent opacity={0.92} emissive="#fbbf24" emissiveIntensity={0.15} />
      </mesh>
      <pointLight ref={light} position={[0.3, 1.6, 0.5]} color="#ffd9a0" distance={9} decay={1.5} intensity={0} />
    </group>
  );
}

function WallSwitch() {
  const rocker = useRef<THREE.Mesh>(null);
  const set = useStore((s) => s.setPressed);
  useFrame(() => {
    const p = useStore.getState().pressed.lightSwitch;
    if (rocker.current) rocker.current.position.z = p ? 0.02 : 0.045;
  });
  return (
    <group position={[-3.85, 1.15, -2.92]}>
      <Box pos={[0, 0, 0]} size={[0.16, 0.24, 0.02]} color="#f8fafc" cast={false} />
      <mesh
        ref={rocker}
        position={[0, 0, 0.045]}
        onPointerDown={(e) => {
          e.stopPropagation();
          set('lightSwitch', true);
        }}
        onPointerUp={() => set('lightSwitch', false)}
        onPointerLeave={() => set('lightSwitch', false)}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <boxGeometry args={[0.08, 0.13, 0.04]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function StandingFan() {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z -= st('fan').speed * 30 * dt;
  });
  return (
    <group position={[-0.3, 0, -2.2]} rotation={[0, -0.3, 0]}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.32, 0.06, 20]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <Box pos={[0, 0.6, 0]} size={[0.05, 1.1, 0.05]} color="#cbd5e1" />
      <mesh position={[0, 1.2, -0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.25, 16]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0, 1.2, 0.12]}>
        <torusGeometry args={[0.38, 0.015, 8, 40]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <group ref={blades} position={[0, 1.2, 0.12]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0.3, (i * Math.PI * 2) / 3]} position={[0, 0, 0]}>
            <boxGeometry args={[0.16, 0.66, 0.015]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Thermometer() {
  const temperature = useStore((s) => Math.round(s.temperature));
  const tex = useMemo(() => displayTexture(`${temperature}°C`, '#0b1220', temperature > 28 ? '#fca5a5' : '#7dd3fc'), [temperature]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[-1.3, 1.6, -2.92]}>
      <Box pos={[0, 0, 0]} size={[0.5, 0.3, 0.03]} color="#e2e8f0" cast={false} />
      <mesh position={[0, 0, 0.017]}>
        <planeGeometry args={[0.44, 0.22]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function DimmerKnob() {
  const knob = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (knob.current) knob.current.rotation.z = THREE.MathUtils.degToRad(135 - 270 * (useStore.getState().values.dimmer ?? 0.5));
  });
  return (
    <group position={[-2.05, 1.15, -2.92]}>
      <Box pos={[0, 0, 0]} size={[0.18, 0.18, 0.02]} color="#f8fafc" cast={false} />
      <mesh ref={knob} position={[0, 0, 0.04]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.05, 20]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
}

function SoundRings({ id, position }: { id: string; position: V3 }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const on = st(id).freq > 0;
    ring.current.visible = on;
    const t = (clock.elapsedTime * 2) % 1;
    ring.current.scale.setScalar(0.3 + t * 1.2);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
  });
  return (
    <mesh ref={ring} position={position}>
      <torusGeometry args={[0.3, 0.02, 6, 32]} />
      <meshBasicMaterial color="#fbbf24" transparent toneMapped={false} />
    </mesh>
  );
}

function Chime() {
  return (
    <group position={[-4.92, 2.0, -0.6]} rotation={[0, Math.PI / 2, 0]}>
      <Box pos={[0, 0, 0]} size={[0.3, 0.3, 0.08]} color="#f8fafc" />
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <SoundRings id="chime" position={[0, 0, 0.12]} />
    </group>
  );
}

function ParkingSensor() {
  const wave = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!wave.current) return;
    const t = (live.engineTime - st('parking').ping) / 0.4;
    wave.current.visible = live.running && t >= 0 && t < 1;
    wave.current.position.z = 0.1 + t * 2.5;
    wave.current.scale.setScalar(0.4 + t * 2);
    (wave.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
  });
  return (
    <group position={[3.1, 0.6, -2.91]}>
      <Box pos={[0, 0, 0]} size={[0.45, 0.2, 0.03]} color="#1e40af" />
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh ref={wave} position={[0, 0, 0.1]}>
        <torusGeometry args={[0.2, 0.012, 6, 32, Math.PI]} />
        <meshBasicMaterial color="#38bdf8" transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function GarageBeeper() {
  return (
    <group position={[5.11, 1.7, -1.6]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <SoundRings id="beeper" position={[0, 0, 0.08]} />
    </group>
  );
}

function Car() {
  const group = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group[]>([]);
  const bang = useRef<HTMLDivElement>(null);
  const lastZ = useRef(0);
  useFrame(() => {
    if (!group.current) return;
    const sim = home();
    const d = sim.carDistance;
    const z = -2.92 + d / 100 + 2.05;
    const moved = z - lastZ.current;
    lastZ.current = z;
    group.current.position.z = z;
    const shake = sim.time - sim.crashedAt < 0.4 ? Math.sin(sim.time * 90) * 0.04 : 0;
    group.current.position.x = 3.1 + shake;
    for (const w of wheels.current) if (w) w.rotation.x += moved / 0.34;
    if (bang.current) bang.current.style.display = sim.time - sim.crashedAt < 1.2 ? 'block' : 'none';
  });
  const wheelPos: V3[] = [
    [-0.82, 0.34, -1.3],
    [0.82, 0.34, -1.3],
    [-0.82, 0.34, 1.3],
    [0.82, 0.34, 1.3],
  ];
  return (
    <group ref={group} position={[3.1, 0, 3]}>
      <RoundedBox args={[1.7, 0.65, 4.1]} radius={0.2} position={[0, 0.62, 0]} castShadow>
        <meshStandardMaterial color="#ef4444" roughness={0.35} metalness={0.2} />
      </RoundedBox>
      <RoundedBox args={[1.5, 0.6, 2.1]} radius={0.22} position={[0, 1.15, 0.3]} castShadow>
        <meshStandardMaterial color="#93c5fd" roughness={0.1} metalness={0.3} />
      </RoundedBox>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.68, -2.06]}>
          <boxGeometry args={[0.35, 0.14, 0.02]} />
          <meshStandardMaterial color="#fffbe6" emissive="#fff3b0" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}
      {wheelPos.map((p, i) => (
        <group key={i} position={p} ref={(g) => { if (g) wheels.current[i] = g; }}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.24, 20]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.26, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
          </mesh>
        </group>
      ))}
      <Html position={[0, 2.0, -1.6]} center zIndexRange={[10, 0]}>
        <div ref={bang} className="bang" style={{ display: 'none' }}>
          💥 Bump!
        </div>
      </Html>
    </group>
  );
}

function Visitor() {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Group>(null);
  useFrame(() => {
    const v = home().visitor;
    if (!group.current) return;
    group.current.visible = v.phase !== 'away';
    group.current.position.set(v.x, 0, v.z);
    group.current.rotation.y = v.rot;
    const walking = v.phase === 'arriving' || v.phase === 'entering' || v.phase === 'leaving';
    const swing = walking ? Math.sin(v.walk * 9) * 0.5 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armR.current) armR.current.rotation.x = v.ringing ? -1.6 : -swing * 0.6;
    if (v.phase !== 'away') group.current.position.y = walking ? Math.abs(Math.sin(v.walk * 9)) * 0.04 : 0;
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={legL} position={[-0.1, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>
      <mesh ref={legR} position={[0.1, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.5, 6, 12]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      <group ref={armR} position={[0.26, 1.28, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
      </group>
      <mesh position={[-0.26, 1.03, 0]} castShadow>
        <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshStandardMaterial color="#f2c9a0" />
      </mesh>
      <mesh position={[0, 1.78, -0.02]}>
        <sphereGeometry args={[0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
        <meshStandardMaterial color="#3f2a1d" />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 1.65, 0.18]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshBasicMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

export function House() {
  return (
    <group>
      <Structure />
      <Furniture />
      <FrontDoor />
      <PorchLight />
      <Doorbell />
      <MotionSensor />
      <RoofLightSensor />
      <FloorLamp />
      <WallSwitch />
      <StandingFan />
      <Thermometer />
      <DimmerKnob />
      <Chime />
      <ParkingSensor />
      <GarageBeeper />
      <Car />
      <Visitor />
    </group>
  );
}
