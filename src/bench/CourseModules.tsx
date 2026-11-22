// 3D bodies of the modules added for Traffic Town, Smart Garden and the course world.
import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { DEVICE_SPECS, KEYPAD_KEYS, type DeviceInstance } from '../devices/specs';
import { emptyState } from '../devices/logic';
import { live } from '../sim/session';
import { useStore } from '../store';
import { MODULE_BASE_Y, PCB_T } from './layout';
import { LcdScreen } from './LcdScreen';
import { canvasTexture, cached } from './textures';

const TOP = MODULE_BASE_Y + PCB_T;
const state = (id: string) => live.states[id] ?? emptyState();

/** A glowing LED dome whose brightness follows `get()`. */
function Lamp({ color, get, position, radius = 0.32 }: { color: string; get: () => number; position: [number, number, number]; radius?: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    const b = get();
    mat.current.emissiveIntensity = 0.08 + b * 4.5;
    mat.current.opacity = 0.75 + b * 0.25;
  });
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.08} transparent toneMapped={false} roughness={0.2} />
    </mesh>
  );
}

function StatusLed({ get, position, color = '#ef4444' }: { get: () => boolean; position: [number, number, number]; color?: string }) {
  return <Lamp color={color} radius={0.09} position={position} get={() => (get() ? 1 : 0)} />;
}

export function TrafficLightBody({ device }: { device: DeviceInstance }) {
  const colors = ['#ef4444', '#facc15', '#22c55e'];
  return (
    <group position={[0, TOP, 0]}>
      <mesh position={[0, 0.2, 0.25]} castShadow>
        <boxGeometry args={[1.5, 0.4, 3.3]} />
        <meshStandardMaterial color="#111827" roughness={0.6} />
      </mesh>
      {colors.map((c, i) => (
        <group key={c}>
          <mesh position={[0, 0.41, -0.85 + i * 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.36, 0.46, 28]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <Lamp color={c} position={[0, 0.4, -0.85 + i * 1.1]} get={() => state(device.id).levels[i] ?? 0} />
        </group>
      ))}
    </group>
  );
}

export function RgbLedBody({ device }: { device: DeviceInstance }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const color = new THREE.Color();
  useFrame(() => {
    const [r = 0, g = 0, b = 0] = state(device.id).levels;
    const max = Math.max(r, g, b);
    color.setRGB(r, g, b);
    if (mat.current) {
      mat.current.emissive.copy(max > 0 ? color : mat.current.color);
      mat.current.emissiveIntensity = max > 0 ? 1 + max * 3 : 0.05;
    }
    if (light.current) {
      light.current.color.copy(color);
      light.current.intensity = max * 6;
    }
  });
  return (
    <group position={[0, TOP, 0.3]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.2, 24]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.5, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={mat} color="#f8fafc" transparent opacity={0.9} roughness={0.15} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 1, 0]} distance={6} decay={1.5} intensity={0} />
    </group>
  );
}

/** Segment bars a-g laid flat, top of the digit pointing away from the viewer. */
export const SEGMENTS: { x: number; z: number; horizontal: boolean }[] = [
  { x: 0, z: -1, horizontal: true }, // a
  { x: 0.55, z: -0.5, horizontal: false }, // b
  { x: 0.55, z: 0.5, horizontal: false }, // c
  { x: 0, z: 1, horizontal: true }, // d
  { x: -0.55, z: 0.5, horizontal: false }, // e
  { x: -0.55, z: -0.5, horizontal: false }, // f
  { x: 0, z: 0, horizontal: true }, // g
];

export function SevenSegDigit({ get, scale = 1, color = '#ff3b30' }: { get: () => number[]; scale?: number; color?: string }) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => {
    const lv = get();
    mats.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = 0.04 + (lv[i] ?? 0) * 4;
    });
  });
  return (
    <group scale={scale}>
      {SEGMENTS.map((s, i) => (
        <mesh key={i} position={[s.x, 0, s.z]}>
          <boxGeometry args={s.horizontal ? [0.9, 0.06, 0.16] : [0.16, 0.06, 0.85]} />
          <meshStandardMaterial ref={(m) => void (mats.current[i] = m)} color="#3b0d0d" emissive={color} emissiveIntensity={0.04} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function SevenSegBody({ device }: { device: DeviceInstance }) {
  return (
    <group position={[0, TOP, 0.35]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[2.3, 0.5, 2.9]} />
        <meshStandardMaterial color="#18181b" roughness={0.7} />
      </mesh>
      <group position={[0, 0.52, 0]}>
        <SevenSegDigit get={() => state(device.id).levels} scale={1.15} />
      </group>
    </group>
  );
}

export function IrBody({ device }: { device: DeviceInstance }) {
  return (
    <group position={[0, TOP, 0]}>
      {[-0.4, 0.4].map((x, i) => (
        <mesh key={x} position={[x, 0.3, 1.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.6, 18]} />
          <meshStandardMaterial color={i ? '#111827' : '#e0f2fe'} transparent={!i} opacity={i ? 1 : 0.85} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0.1]}>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <StatusLed position={[0.7, 0.05, -0.6]} color="#22c55e" get={() => state(device.id).on} />
    </group>
  );
}

export function SoilBody({ device }: { device: DeviceInstance }) {
  return (
    <group position={[0, TOP, 0]}>
      <mesh position={[0, 0.15, -0.9]}>
        <boxGeometry args={[0.5, 0.3, 0.5]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.03, 1.1]}>
          <boxGeometry args={[0.32, 0.06, 2.6]} />
          <meshStandardMaterial color="#d4a017" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <StatusLed position={[0.8, 0.05, -1.4]} color="#22c55e" get={() => state(device.id).on} />
    </group>
  );
}

function grilleTexture() {
  return cached('dht-grille', () =>
    canvasTexture(128, 160, (g) => {
      g.fillStyle = '#38bdf8';
      g.fillRect(0, 0, 128, 160);
      g.fillStyle = '#0c4a6e';
      for (let y = 0; y < 6; y++) for (let x = 0; x < 5; x++) g.fillRect(12 + x * 22, 12 + y * 24, 14, 16);
    }),
  );
}

export function DhtBody({ device }: { device: DeviceInstance }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ring.current) return;
    const t = (live.engineTime - state(device.id).ping) / 0.5;
    ring.current.visible = live.running && t >= 0 && t < 1;
    ring.current.scale.setScalar(1 + t);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
  });
  return (
    <group position={[0, TOP, 0.3]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.3, 0.7, 1.7]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <mesh position={[0, 0.705, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 1.6]} />
        <meshStandardMaterial map={grilleTexture()} />
      </mesh>
      <mesh ref={ring} position={[0, 0.75, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 0.9, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export function LcdBody({ device }: { device: DeviceInstance }) {
  const [w, d] = DEVICE_SPECS[device.type].size;
  const i2c = device.type === 'lcdI2c';
  return (
    <group position={[0, TOP, 0.35]}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[w - 0.5, 0.36, d - 1.3]} />
        <meshStandardMaterial color="#111827" roughness={0.5} />
      </mesh>
      <group position={[0, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <LcdScreen deviceId={device.id} width={w - 1.1} style={i2c ? 'blue' : 'green'} />
      </group>
    </group>
  );
}

export function MotorBody({ device }: { device: DeviceInstance }) {
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.x += state(device.id).speed * dt * 14;
  });
  return (
    <group position={[0, TOP, 0]}>
      {/* L293D chip */}
      <mesh position={[-0.9, 0.12, -0.3]}>
        <boxGeometry args={[0.7, 0.24, 1.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* yellow gear motor + wheel */}
      <mesh position={[0.7, 0.4, 0.6]} castShadow>
        <boxGeometry args={[1.2, 0.8, 1.6]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      <group ref={wheel} position={[1.45, 0.75, 0.6]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.75, 0.75, 0.3, 28]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0.16, 0.45, 0]}>
          <boxGeometry args={[0.04, 0.5, 0.2]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      </group>
    </group>
  );
}

export function KeypadBody({ device }: { device: DeviceInstance }) {
  const setKey = useStore((s) => s.setKey);
  const caps = useRef<(THREE.Mesh | null)[]>([]);
  const keys = KEYPAD_KEYS.join('').split('');
  useFrame(() => {
    const held = useStore.getState().keys[device.id];
    caps.current.forEach((m, i) => {
      if (m) m.position.y = keys[i] === held ? 0.08 : 0.16;
    });
  });
  const down = (k: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setKey(device.id, k);
  };
  const up = () => setKey(device.id, null);
  return (
    <group position={[0, TOP, 0.45]}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[4.4, 0.08, 4.4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {keys.map((k, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const tex = cached(`key:${k}`, () =>
          canvasTexture(96, 96, (g) => {
            g.fillStyle = /[A-D]/.test(k) ? '#ef4444' : /[*#]/.test(k) ? '#3b82f6' : '#f1f5f9';
            g.fillRect(0, 0, 96, 96);
            g.fillStyle = /[A-D*#]/.test(k) ? '#fff' : '#0f172a';
            g.font = '900 64px Nunito, sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(k, 48, 52);
          }),
        );
        return (
          <mesh
            key={k}
            ref={(m) => void (caps.current[i] = m)}
            position={[(c - 1.5) * 1.05, 0.16, (r - 1.5) * 1.05]}
            onPointerDown={down(k)}
            onPointerUp={up}
            onPointerLeave={up}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            <boxGeometry args={[0.88, 0.16, 0.88]} />
            <meshStandardMaterial attach="material-0" color="#cbd5e1" />
            <meshStandardMaterial attach="material-1" color="#cbd5e1" />
            <meshStandardMaterial attach="material-2" map={tex} />
            <meshStandardMaterial attach="material-3" color="#cbd5e1" />
            <meshStandardMaterial attach="material-4" color="#cbd5e1" />
            <meshStandardMaterial attach="material-5" color="#cbd5e1" />
          </mesh>
        );
      })}
    </group>
  );
}

export function JoystickBody({ device }: { device: DeviceInstance }) {
  const stick = useRef<THREE.Group>(null);
  useFrame(() => {
    const v = useStore.getState().values;
    const x = (v[`${device.id}.x`] ?? 0.5) - 0.5;
    const y = (v[`${device.id}.y`] ?? 0.5) - 0.5;
    if (stick.current) {
      stick.current.rotation.z = -x * 0.9;
      stick.current.rotation.x = -y * 0.9;
      stick.current.position.y = useStore.getState().pressed[device.id] ? 0.35 : 0.45;
    }
  });
  return (
    <group position={[0, TOP, 0.4]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.8, 0.5, 1.8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} />
      </mesh>
      <group ref={stick} position={[0, 0.45, 0]}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.8, 12]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.6, 0.35, 24]} />
          <meshStandardMaterial color="#111827" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

export function SoundBody({ device }: { device: DeviceInstance }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const on = state(device.id).on;
    const t = (clock.elapsedTime * 3) % 1;
    ring.current.visible = on;
    ring.current.scale.setScalar(1 + t);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
  });
  return (
    <group position={[0, TOP, 0.3]}>
      <mesh position={[0, 0.3, 0.6]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.6, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.605, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 24]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[-0.5, 0.2, -0.4]}>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh ref={ring} position={[0, 0.65, 0.6]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.5, 0.58, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <StatusLed position={[0.7, 0.05, -0.7]} color="#22c55e" get={() => state(device.id).on} />
    </group>
  );
}
