// The Secret Lab in 3D: a cutaway room with the lab computer (showing the Serial Monitor),
// a vault door with keypad and screen, binary lights, a robot arm, a security camera,
// a theremin and a sneaky thief.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { live } from '../../sim/session';
import { useMission, useStore } from '../../store';
import { emptyState } from '../../devices/logic';
import { LcdScreen } from '../../bench/LcdScreen';
import { MissionLabel, Person, Rings } from '../shared/models';
import { LabSim } from './sim';

type V3 = [number, number, number];
const st = (id: string) => live.states[id] ?? emptyState();
const FALLBACK = new LabSim();
const lab = () => (live.sim instanceof LabSim ? live.sim : FALLBACK);
const deg = THREE.MathUtils.degToRad;

function Box({ pos, size, color, cast = true, rot }: { pos: V3; size: V3; color: string; cast?: boolean; rot?: V3 }) {
  return (
    <mesh position={pos} rotation={rot} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
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
      <sphereGeometry args={[r, 18, 12]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.05} toneMapped={false} />
    </mesh>
  );
}

/** Are the ceiling lights on? Only the clap mission switches them; otherwise they stay on. */
function useLightsOn() {
  const mission = useMission();
  const controlled = mission.devices.includes('labLights');
  return () => (controlled ? st('labLights').on : true);
}

// ------------------------------------------------------------------ room and lighting
function Room() {
  const lightsOn = useLightsOn();
  const panels = useRef<THREE.MeshStandardMaterial[]>([]);
  const lamps = useRef<THREE.PointLight[]>([]);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useFrame(() => {
    const on = lightsOn();
    panels.current.forEach((m) => m && (m.emissiveIntensity = on ? 2.2 : 0.05));
    lamps.current.forEach((l) => l && (l.intensity = on ? 9 : 0));
    if (hemi.current) hemi.current.intensity = on ? 0.9 : 0.25;
  });
  const tiles = useMemo(
    () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      g.fillStyle = '#cbd5e1';
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 4;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0);
        g.lineTo(i * 64, 256);
        g.moveTo(0, i * 64);
        g.lineTo(256, i * 64);
        g.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 3);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    },
    [],
  );
  useEffect(() => () => tiles.dispose(), [tiles]);
  return (
    <group>
      <color attach="background" args={['#1e1b4b']} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#475569', 0.9]} />
      <directionalLight position={[4, 9, 6]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial map={tiles} />
      </mesh>
      <Box pos={[0, 1.7, -3.5]} size={[12, 3.4, 0.2]} color="#e0e7ff" cast={false} />
      <Box pos={[-5.9, 1.7, 0.5]} size={[0.2, 3.4, 8]} color="#c7d2fe" cast={false} />
      <Box pos={[0, 0.08, -3.38]} size={[12, 0.16, 0.05]} color="#6366f1" cast={false} />
      {[-2.2, 2.2].map((x, i) => (
        <group key={x} position={[x, 3.3, -0.4]}>
          <mesh>
            <boxGeometry args={[1.8, 0.06, 0.5]} />
            <meshStandardMaterial ref={(m) => void (m && (panels.current[i] = m))} color="#f8fafc" emissive="#fffbeb" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
          <pointLight ref={(l) => void (l && (lamps.current[i] = l))} position={[0, -0.4, 0]} distance={9} decay={1.3} intensity={9} color="#fff7ed" />
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ the lab computer
function serialTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t, g: c.getContext('2d')! };
}

function Computer() {
  const screen = useMemo(serialTexture, []);
  useEffect(() => () => screen.t.dispose(), [screen]);
  const last = useRef('\u0000');
  useFrame(() => {
    const serial = useStore.getState().serial;
    if (serial === last.current) return;
    last.current = serial;
    const { g, t } = screen;
    g.fillStyle = '#020617';
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#334155';
    g.fillRect(0, 0, 512, 28);
    g.fillStyle = '#e2e8f0';
    g.font = 'bold 18px Consolas, monospace';
    g.fillText('Serial Monitor', 12, 20);
    g.fillStyle = '#4ade80';
    g.font = '19px Consolas, "Courier New", monospace';
    const lines = serial.replace(/\r/g, '').split('\n').slice(-13);
    lines.forEach((l, i) => g.fillText(l.slice(0, 42), 12, 52 + i * 21));
    t.needsUpdate = true;
  });
  return (
    <group position={[-3.6, 0, -2.4]}>
      <Box pos={[0, 0.78, 0]} size={[2.2, 0.08, 1.0]} color="#a16207" />
      {[-0.95, 0.95].map((x) => (
        <Box key={x} pos={[x, 0.38, 0]} size={[0.08, 0.76, 0.9]} color="#78350f" />
      ))}
      <Box pos={[0, 0.95, -0.2]} size={[0.15, 0.3, 0.1]} color="#334155" />
      <Box pos={[0, 1.35, -0.25]} size={[1.25, 0.82, 0.06]} color="#0f172a" />
      <mesh position={[0, 1.35, -0.215]}>
        <planeGeometry args={[1.15, 0.72]} />
        <meshBasicMaterial map={screen.t} toneMapped={false} />
      </mesh>
      <Box pos={[0, 0.84, 0.2]} size={[0.9, 0.04, 0.3]} color="#1e293b" />
    </group>
  );
}

// ------------------------------------------------------------------ vault
function Vault() {
  const door = useRef<THREE.Group>(null);
  const bolt = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const a = st('vaultLock').angle;
    if (bolt.current) bolt.current.position.x = 1.05 - (Math.min(90, a) / 90) * 0.45;
    if (door.current) {
      const target = a > 70 ? -0.9 : 0;
      door.current.rotation.y += (target - door.current.rotation.y) * Math.min(1, dt * 3);
    }
  });
  return (
    <group position={[1.0, 0, -3.33]}>
      {/* frame */}
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.18, 1.18, 0.12, 40]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* door, hinged on its left edge */}
      <group ref={door} position={[-1.0, 1.35, 0.12]}>
        <group position={[1.0, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[1.0, 1.0, 0.18, 40]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <Box key={i} pos={[0, 0, 0.11]} size={[1.3, 0.07, 0.05]} color="#cbd5e1" rot={[0, 0, (i * Math.PI) / 3]} />
          ))}
          <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.08, 24]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
          </mesh>
          {/* the bolt the servo slides */}
          <mesh ref={bolt} position={[1.05, 0, 0.0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.5, 14]} />
            <meshStandardMaterial color="#facc15" metalness={0.7} />
          </mesh>
        </group>
      </group>
      {/* keypad and screen */}
      <group position={[1.75, 1.25, 0.1]}>
        <Box pos={[0, 0, 0]} size={[0.6, 0.72, 0.06]} color="#0f172a" />
        {Array.from({ length: 16 }, (_, i) => (
          <Box key={i} pos={[(-1.5 + (i % 4)) * 0.12, 0.17 - Math.floor(i / 4) * 0.12, 0.04]} size={[0.09, 0.09, 0.03]} color={i % 4 === 3 ? '#ef4444' : '#e2e8f0'} />
        ))}
        <group position={[0, 0.58, 0]}>
          <Box pos={[0, 0, 0]} size={[0.82, 0.3, 0.05]} color="#1e3a8a" />
          <group position={[0, 0, 0.03]}>
            <LcdScreen deviceId="doorScreen" width={0.76} style="blue" />
          </group>
        </group>
        <MissionLabel device="keypad" text="🔐 vault keypad" position={[0, -0.6, 0.2]} width={1.6} />
      </group>
      <MissionLabel device="vaultLock" text="🔩 lock bolt (servo)" position={[0.9, 2.75, 0.3]} width={2.0} />
    </group>
  );
}

// ------------------------------------------------------------------ binary lights
function BinaryPanel() {
  return (
    <group position={[4.4, 2.2, -3.36]}>
      <Box pos={[0, 0, 0]} size={[2.3, 0.75, 0.08]} color="#1e293b" />
      {[3, 2, 1, 0].map((bit, i) => (
        <group key={bit} position={[-0.83 + i * 0.55, 0.05, 0.08]}>
          <Bulb pos={[0, 0.05, 0]} color="#facc15" r={0.17} get={() => st(`bit${bit}`).brightness} />
          <BitLabel value={1 << bit} />
        </group>
      ))}
      <MissionLabel device="bit0" text="💡 binary lights" position={[0, 0.75, 0.2]} width={1.8} />
    </group>
  );
}

function BitLabel({ value }: { value: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e2e8f0';
    g.font = 'bold 26px Nunito, sans-serif';
    g.textAlign = 'center';
    g.fillText(`×${value}`, 32, 26);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [value]);
  return (
    <mesh position={[0, -0.25, 0.01]}>
      <planeGeometry args={[0.36, 0.18]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

// ------------------------------------------------------------------ robot arm
function RobotArm() {
  const boom = useRef<THREE.Group>(null);
  const box = useRef<THREE.Mesh>(null);
  const btn = useRef<THREE.Mesh>(null);
  const tip = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const a = live.states.armServo ? st('armServo').angle : 90;
    if (boom.current) boom.current.rotation.y = Math.PI / 2 - deg(a) + Math.PI / 2;
    if (btn.current) btn.current.position.y = live.sense?.pressed('armButton') ? 0.86 : 0.9;
    const b = box.current;
    if (!b) return;
    const place = lab().box;
    if (place === 'carried') {
      const r = deg(a);
      tip.set(-Math.cos(r) * 1.15, 1.05, -Math.sin(r) * 1.15);
      b.position.copy(tip);
      b.rotation.set(0, 0, 0);
    } else if (place === 'A') b.position.set(-1.15, 0.94, 0);
    else if (place === 'B') b.position.set(1.15, 0.94, 0);
    else {
      b.position.set(0.3, 0.12, 0.9);
      b.rotation.set(0.3, 0.6, 0.2);
    }
  });
  return (
    <group position={[-0.6, 0, 0.3]}>
      <Box pos={[0, 0.8, 0]} size={[3.2, 0.08, 1.2]} color="#64748b" />
      {[-1.5, 1.5].map((x) => (
        <Box key={x} pos={[x, 0.4, 0]} size={[0.08, 0.8, 1.1]} color="#475569" />
      ))}
      {/* pads A and B */}
      <Box pos={[-1.15, 0.85, 0]} size={[0.5, 0.02, 0.5]} color="#22c55e" cast={false} />
      <Box pos={[1.15, 0.85, 0]} size={[0.5, 0.02, 0.5]} color="#3b82f6" cast={false} />
      {/* arm */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.22, 24]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      <group ref={boom} position={[0, 1.05, 0]}>
        <Box pos={[0, 0.25, 0]} size={[0.12, 0.5, 0.12]} color="#f97316" />
        <Box pos={[0.58, 0.45, 0]} size={[1.2, 0.1, 0.1]} color="#fb923c" />
        <Box pos={[1.15, 0.22, 0]} size={[0.08, 0.4, 0.08]} color="#f97316" />
        <Box pos={[1.15, 0.03, 0]} size={[0.22, 0.04, 0.22]} color="#334155" />
      </group>
      <mesh ref={box} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>
      {/* the arm button */}
      <group position={[0, 0, 0.5]}>
        <Box pos={[0, 0.84, 0]} size={[0.3, 0.06, 0.2]} color="#1f2937" />
        <mesh
          ref={btn}
          position={[0, 0.9, 0]}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            useStore.getState().setPressed('armButton', true);
          }}
          onPointerUp={() => useStore.getState().setPressed('armButton', false)}
          onPointerLeave={() => useStore.getState().setPressed('armButton', false)}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>
      <MissionLabel device="armServo" text="🦾 robot arm" position={[0, 2.0, 0]} width={1.6} />
    </group>
  );
}

// ------------------------------------------------------------------ security camera
function SecurityCamera() {
  const pan = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const p = live.states.camPan ? st('camPan').angle : 90;
    const t = live.states.camTilt ? st('camTilt').angle : 90;
    if (pan.current) pan.current.rotation.y = deg(90 - p);
    if (tilt.current) tilt.current.rotation.x = -deg(t - 90);
    if (beam.current) beam.current.visible = !!live.states.camPan?.powered;
  });
  return (
    <group position={[-3.6, 2.5, -3.3]}>
      <Box pos={[0, 0, 0.1]} size={[0.3, 0.3, 0.2]} color="#334155" />
      <group ref={pan} position={[0, -0.05, 0.3]}>
        <Box pos={[0, -0.12, 0]} size={[0.1, 0.18, 0.1]} color="#2563eb" />
        <group ref={tilt} position={[0, -0.25, 0]}>
          <Box pos={[0, 0, 0.18]} size={[0.26, 0.22, 0.5]} color="#f8fafc" />
          <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 18]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh ref={beam} position={[0, 0, 1.6]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <coneGeometry args={[0.5, 2.3, 24, 1, true]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <Bulb pos={[0.09, 0.08, 0.44]} color="#ef4444" r={0.025} get={() => (live.running ? 1 : 0)} />
        </group>
      </group>
      <MissionLabel device="camPan" text="🎥 security camera" position={[0, 0.5, 0.4]} width={2.0} />
    </group>
  );
}

// ------------------------------------------------------------------ alarm, thief, clap, theremin
function Alarm() {
  const beacon = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (beacon.current) beacon.current.rotation.y += st('alarmLamp').brightness * dt * 8;
  });
  return (
    <group position={[4.6, 0, 0.0]}>
      <Box pos={[0, 1.25, 0]} size={[0.1, 2.5, 0.1]} color="#64748b" />
      {/* PIR dome */}
      <group position={[0, 2.3, 0.1]}>
        <Box pos={[0, 0, 0]} size={[0.25, 0.25, 0.12]} color="#f8fafc" />
        <mesh position={[0, 0, 0.07]}>
          <sphereGeometry args={[0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.85} />
        </mesh>
        <Bulb pos={[0.09, 0.09, 0.07]} color="#ef4444" r={0.02} get={() => (st('thiefSensor').on ? 1 : 0)} />
      </group>
      {/* rotating alarm beacon */}
      <group position={[0, 2.65, 0]}>
        <Bulb pos={[0, 0, 0]} color="#ef4444" r={0.16} get={() => st('alarmLamp').brightness} />
        <group ref={beacon}>
          <Box pos={[0.16, 0, 0]} size={[0.04, 0.1, 0.25]} color="#fecaca" />
        </group>
      </group>
      <group position={[0, 1.8, 0.1]}>
        <Box pos={[0, 0, 0]} size={[0.2, 0.2, 0.1]} color="#111827" />
        <group position={[0, 0, 0.07]}>
          <Rings active={() => st('labAlarm').freq > 0} radius={0.13} speed={4} />
        </group>
      </group>
      <MissionLabel device="thiefSensor" text="👀 motion sensor" position={[0, 3.2, 0]} width={1.9} />
    </group>
  );
}

function Thief() {
  return (
    <Person
      shirt="#1f2937"
      pants="#111827"
      hair="#111827"
      pose={() => {
        const t = lab().thief;
        return {
          visible: t.phase !== 'away',
          x: t.x,
          z: 1.6,
          rot: t.phase === 'fleeing' ? Math.PI / 2 : -Math.PI / 2,
          walk: t.walk,
          walking: t.phase === 'sneaking' || t.phase === 'fleeing',
          armUp: t.phase === 'searching',
        };
      }}
    />
  );
}

function ClapSensor() {
  return (
    <group position={[-2.6, 0.82, -2.3]}>
      <Box pos={[0, 0.02, 0]} size={[0.3, 0.04, 0.22]} color="#0e7490" />
      <mesh position={[0, 0.1, 0.05]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
      </mesh>
      <group position={[0, 0.2, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <Rings active={() => !!lab().snapshot().loud} radius={0.1} speed={5} />
      </group>
      <MissionLabel device="clapSensor" text="👂 sound sensor" position={[0, 0.55, 0]} width={1.6} />
    </group>
  );
}

function Theremin() {
  const hand = useRef<THREE.Group>(null);
  useFrame(() => {
    const cm = useStore.getState().values.hand ?? 100;
    if (!hand.current) return;
    hand.current.visible = cm < 95;
    hand.current.position.y = 0.98 + cm / 100;
  });
  return (
    <group position={[3.4, 0, 1.4]}>
      <Box pos={[0, 0.42, 0]} size={[0.8, 0.84, 0.6]} color="#7c3aed" />
      <Box pos={[0, 0.87, 0]} size={[0.5, 0.06, 0.22]} color="#1e40af" />
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.93, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 16]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.8} />
        </mesh>
      ))}
      <group position={[0, 1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Rings active={() => st('theremin').freq > 0} radius={0.15} speed={2 + st('theremin').freq / 400} color="#a78bfa" />
      </group>
      <group ref={hand} visible={false}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.06, 0.26]} />
          <meshStandardMaterial color="#f2c9a0" />
        </mesh>
        {[-0.07, -0.025, 0.02, 0.065].map((x) => (
          <mesh key={x} position={[x, 0, -0.18]}>
            <boxGeometry args={[0.035, 0.04, 0.14]} />
            <meshStandardMaterial color="#f2c9a0" />
          </mesh>
        ))}
      </group>
      <MissionLabel device="handSensor" text="🎵 theremin" position={[0, 2.3, 0]} width={1.5} />
    </group>
  );
}

export function LabScene() {
  return (
    <>
      <Room />
      <Computer />
      <Vault />
      <BinaryPanel />
      <RobotArm />
      <SecurityCamera />
      <Alarm />
      <Thief />
      <ClapSensor />
      <Theremin />
    </>
  );
}
