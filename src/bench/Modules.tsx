import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { DEVICE_SPECS, type DeviceInstance } from '../devices/specs';
import { live } from '../sim/session';
import { useStore } from '../store';
import { MODULE_BASE_Y, MODULE_PIN_PITCH, MODULE_PIN_TOP, PCB_T, type ModulePlacement } from './layout';
import { canvasTexture, cached } from './textures';
import { PinHit } from './PinHit';
import { emptyState } from '../devices/logic';
import {
  DhtBody,
  IrBody,
  JoystickBody,
  KeypadBody,
  LcdBody,
  MotorBody,
  RgbLedBody,
  SevenSegBody,
  SoilBody,
  SoundBody,
  TrafficLightBody,
} from './CourseModules';

const TOP = MODULE_BASE_Y + PCB_T;
const state = (id: string) => live.states[id] ?? emptyState();

function pcbTexture(device: DeviceInstance, w: number, d: number) {
  const spec = DEVICE_SPECS[device.type];
  return cached(`pcb:${device.id}`, () =>
    canvasTexture(Math.round(w * 128), Math.round(d * 128), (g) => {
      const W = w * 128;
      const H = d * 128;
      g.fillStyle = spec.pcb;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 4;
      g.strokeRect(8, 8, W - 16, H - 16);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '900 30px Nunito, sans-serif';
      const n = spec.pins.length;
      spec.pins.forEach((p, i) => {
        const x = W / 2 + (i - (n - 1) / 2) * MODULE_PIN_PITCH * 128;
        g.fillText(p.short, x, (0.25 + 0.42) * 128);
      });
      g.font = '800 22px Nunito, sans-serif';
      g.fillText(spec.title.toUpperCase(), W / 2, H - 26);
    }),
  );
}

function Glow({ color, get, position, size = 0.12 }: { color: string; get: () => number; position: [number, number, number]; size?: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.05 + get() * 5;
  });
  return (
    <mesh position={position}>
      <boxGeometry args={[size, 0.07, size * 0.7]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.05} toneMapped={false} />
    </mesh>
  );
}

function LedBody({ device }: { device: DeviceInstance }) {
  const color = device.color ?? '#ff4d4d';
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const b = state(device.id).brightness;
    if (mat.current) mat.current.emissiveIntensity = 0.15 + b * 7;
    if (light.current) light.current.intensity = b * 6;
  });
  return (
    <group position={[0, TOP, 0.25]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.1, 24]} />
        <meshStandardMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.45, 24]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 1, 0.3]} color={color} distance={7} intensity={0} />
    </group>
  );
}

function ButtonBody({ device }: { device: DeviceInstance }) {
  const cap = useRef<THREE.Mesh>(null);
  const setPressed = useStore((s) => s.setPressed);
  useFrame(() => {
    const pressed = !!live.sense?.pressed(device.id);
    if (cap.current) cap.current.position.y = pressed ? 0.42 : 0.55;
  });
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setPressed(device.id, true);
  };
  const up = () => setPressed(device.id, false);
  return (
    <group position={[0, TOP, 0.3]}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[1.2, 0.36, 1.2]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh
        ref={cap}
        position={[0, 0.55, 0]}
        castShadow
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <cylinderGeometry args={[0.42, 0.45, 0.4, 28]} />
        <meshStandardMaterial color={device.id === 'doorbell' ? '#f59e0b' : '#ef4444'} roughness={0.35} />
      </mesh>
    </group>
  );
}

function BuzzerBody({ device }: { device: DeviceInstance }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const f = state(device.id).freq;
    if (!ring.current) return;
    ring.current.visible = f > 0;
    const t = (clock.elapsedTime * 2.5) % 1;
    ring.current.scale.setScalar(1 + t * 1.8);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
  });
  return (
    <group position={[0, TOP, 0.25]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.6, 32]} />
        <meshStandardMaterial color="#111827" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.605, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <mesh ref={ring} position={[0, 0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.62, 40]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PirBody({ device }: { device: DeviceInstance }) {
  return (
    <group position={[0, TOP, 0.2]}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.9, 0.2, 1.9]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.85, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f8fafc" flatShading roughness={0.3} transparent opacity={0.95} />
      </mesh>
      <Glow color="#ef4444" position={[1.15, 0.05, -0.9]} get={() => (state(device.id).on ? 1 : 0)} />
    </group>
  );
}

function ServoBody({ device }: { device: DeviceInstance }) {
  const horn = useRef<THREE.Group>(null);
  useFrame(() => {
    if (horn.current) horn.current.rotation.y = THREE.MathUtils.degToRad(state(device.id).angle) - Math.PI / 2;
  });
  return (
    <group position={[0.2, TOP, 0.3]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[2.3, 1.2, 1.15]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[3.1, 0.12, 1.15]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[-0.6, 1.3, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.2, 20]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>
      <group ref={horn} position={[-0.6, 1.45, 0]}>
        <mesh position={[0.65, 0, 0]} castShadow>
          <boxGeometry args={[1.6, 0.12, 0.34]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 20]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
      {/* brown / red / orange cable */}
      {['#7c2d12', '#dc2626', '#f97316'].map((c, i) => (
        <mesh key={c} position={[-1.3 + i * 0.12, 0.2, -0.45]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.5]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function LdrBody() {
  return (
    <group position={[0, TOP, 0.3]}>
      <mesh position={[-0.35, 0.5, 0]} rotation={[Math.PI / 2.2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.12, 24]} />
        <meshStandardMaterial color="#e9b872" />
      </mesh>
      <mesh position={[-0.35, 0.25, -0.05]}>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
      </mesh>
      <mesh position={[0.55, 0.25, 0]} castShadow>
        <boxGeometry args={[0.55, 0.5, 0.55]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh position={[0.55, 0.52, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.06, 12]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
    </group>
  );
}

function relayLabel() {
  return cached('relayLabel', () =>
    canvasTexture(256, 160, (g) => {
      g.fillStyle = '#1d4ed8';
      g.fillRect(0, 0, 256, 160);
      g.fillStyle = '#fff';
      g.font = '900 34px Nunito, sans-serif';
      g.textAlign = 'center';
      g.fillText('RELAY', 128, 60);
      g.font = '700 24px Nunito, sans-serif';
      g.fillText('5V  10A 250V~', 128, 110);
    }),
  );
}

function RelayBody({ device }: { device: DeviceInstance }) {
  const label = useMemo(() => relayLabel(), []);
  return (
    <group position={[0, TOP, 0.2]}>
      <mesh position={[-0.3, 0.75, 0]} castShadow>
        <boxGeometry args={[1.9, 1.5, 1.5]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.4} />
      </mesh>
      <mesh position={[-0.3, 1.501, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.85, 1.15]} />
        <meshStandardMaterial map={label} />
      </mesh>
      <mesh position={[1.15, 0.4, 0]} castShadow>
        <boxGeometry args={[0.8, 0.8, 1.5]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      {[-0.5, 0, 0.5].map((z) => (
        <mesh key={z} position={[1.15, 0.82, z]}>
          <cylinderGeometry args={[0.14, 0.14, 0.05, 12]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <Glow color="#ef4444" position={[-1.4, 0.05, 0.85]} get={() => (state(device.id).on ? 1 : 0)} />
    </group>
  );
}

function FanBody({ device }: { device: DeviceInstance }) {
  const prop = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (prop.current) prop.current.rotation.z -= state(device.id).speed * 40 * dt;
  });
  return (
    <group position={[0, TOP, 0.2]}>
      <mesh position={[-0.75, 0.12, 0]}>
        <boxGeometry args={[0.6, 0.24, 0.6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.45, 0.5, 0]} castShadow>
        <boxGeometry args={[1.0, 1.0, 1.2]} />
        <meshStandardMaterial color="#facc15" roughness={0.5} />
      </mesh>
      <mesh position={[0.45, 0.6, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 8]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.8} />
      </mesh>
      <group ref={prop} position={[0.45, 0.6, 0.85]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.14, 16]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0.35, (i * Math.PI * 2) / 3]} position={[0, 0, 0]}>
            <boxGeometry args={[0.32, 1.25, 0.04]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <Glow color="#22c55e" position={[-0.75, 0.05, 0.7]} get={() => state(device.id).speed} />
    </group>
  );
}

function TempBody() {
  return (
    <group position={[0, TOP, 0.3]}>
      {[-0.13, 0, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.25, 0]}>
          <boxGeometry args={[0.04, 0.5, 0.04]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.55, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#111827" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PotBody({ device }: { device: DeviceInstance }) {
  const knob = useRef<THREE.Group>(null);
  useFrame(() => {
    const k = useStore.getState().values[device.id] ?? 0.5;
    if (knob.current) knob.current.rotation.y = THREE.MathUtils.degToRad(135 - 270 * k);
  });
  const wheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    const k = useStore.getState().values[device.id] ?? 0.5;
    useStore.getState().setValue(device.id, Math.min(1, Math.max(0, k - e.deltaY * 0.0008)));
  };
  return (
    <group position={[0, TOP, 0.25]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.3, 0.5, 1.3]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <group ref={knob} position={[0, 0.85, 0]} onWheel={wheel}>
        <mesh castShadow>
          <cylinderGeometry args={[0.5, 0.55, 0.6, 28]} />
          <meshStandardMaterial color="#334155" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.31, -0.28]}>
          <boxGeometry args={[0.1, 0.03, 0.4]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      </group>
    </group>
  );
}

function UltrasonicBody({ device }: { device: DeviceInstance }) {
  const wave = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!wave.current) return;
    const age = live.engineTime - state(device.id).ping;
    const t = age / 0.35;
    wave.current.visible = live.running && t >= 0 && t < 1;
    wave.current.position.z = 0.6 + t * 3;
    wave.current.scale.setScalar(0.6 + t * 1.6);
    (wave.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  });
  return (
    <group position={[0, TOP, 0.2]}>
      {[-1.25, 1.25].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.8, 32]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.4, 0.401]}>
            <circleGeometry args={[0.5, 32]} />
            <meshStandardMaterial color="#374151" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.15, -0.3]}>
        <boxGeometry args={[0.7, 0.3, 0.35]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} />
      </mesh>
      <mesh ref={wave} position={[0, 0.4, 0.6]}>
        <torusGeometry args={[0.5, 0.04, 8, 32, Math.PI]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function Body({ device }: { device: DeviceInstance }) {
  switch (device.type) {
    case 'led':
      return <LedBody device={device} />;
    case 'button':
      return <ButtonBody device={device} />;
    case 'buzzer':
      return <BuzzerBody device={device} />;
    case 'pir':
      return <PirBody device={device} />;
    case 'servo':
      return <ServoBody device={device} />;
    case 'ldr':
      return <LdrBody />;
    case 'relay':
      return <RelayBody device={device} />;
    case 'fan':
      return <FanBody device={device} />;
    case 'temp':
      return <TempBody />;
    case 'pot':
      return <PotBody device={device} />;
    case 'ultrasonic':
      return <UltrasonicBody device={device} />;
    case 'trafficLight':
      return <TrafficLightBody device={device} />;
    case 'rgbLed':
      return <RgbLedBody device={device} />;
    case 'sevenSeg':
      return <SevenSegBody device={device} />;
    case 'ir':
      return <IrBody device={device} />;
    case 'soil':
      return <SoilBody device={device} />;
    case 'dht':
      return <DhtBody device={device} />;
    case 'lcd':
    case 'lcdI2c':
      return <LcdBody device={device} />;
    case 'motor':
      return <MotorBody device={device} />;
    case 'keypad':
      return <KeypadBody device={device} />;
    case 'joystick':
      return <JoystickBody device={device} />;
    case 'sound':
      return <SoundBody device={device} />;
  }
}

export function ModuleView({ placement, problems }: { placement: ModulePlacement; problems: Set<string> }) {
  const { device, pos } = placement;
  const spec = DEVICE_SPECS[device.type];
  const [w, d] = spec.size;
  const tex = useMemo(() => pcbTexture(device, w, d), [device, w, d]);
  const n = spec.pins.length;
  const hasVcc = spec.pins.some((p) => p.role === 'vcc');

  return (
    <group position={pos}>
      {/* standoffs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (w / 2 - 0.2), MODULE_BASE_Y / 2, sz * (d / 2 - 0.2)]}>
          <cylinderGeometry args={[0.1, 0.1, MODULE_BASE_Y, 8]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, MODULE_BASE_Y + PCB_T / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, PCB_T, d]} />
        <meshStandardMaterial color={spec.pcb} />
      </mesh>
      <mesh position={[0, TOP + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex} />
      </mesh>
      {/* pin header */}
      <mesh position={[0, TOP + 0.12, -d / 2 + 0.25]}>
        <boxGeometry args={[n * MODULE_PIN_PITCH, 0.24, 0.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {spec.pins.map((p, i) => {
        const x = (i - (n - 1) / 2) * MODULE_PIN_PITCH;
        const ref = `${device.id}:${p.name}`;
        return (
          <group key={p.name}>
            <mesh position={[x, (TOP + MODULE_PIN_TOP) / 2, -d / 2 + 0.25]}>
              <boxGeometry args={[0.07, MODULE_PIN_TOP - TOP, 0.07]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.25} />
            </mesh>
            <PinHit refId={ref} position={[x, MODULE_PIN_TOP - 0.1, -d / 2 + 0.25]} size={[0.42, 0.55, 0.45]} problem={problems.has(ref)} />
          </group>
        );
      })}
      {hasVcc && <Glow color="#ef4444" position={[w / 2 - 0.3, TOP + 0.03, -d / 2 + 0.35]} size={0.14} get={() => (state(device.id).powered ? 0.6 : 0)} />}
      <Body device={device} />
      <Html position={[0, 0.1, d / 2 + 0.75]} center distanceFactor={16} zIndexRange={[20, 0]}>
        <div className="module-tag">
          <span>{device.emoji}</span> {device.name}
        </div>
      </Html>
    </group>
  );
}
