// Simple, reusable 3D models: people and cars.
import { useMemo, useRef } from 'react';
import { canvasTexture } from '../../bench/textures';
import { useMission } from '../../store';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export interface Pose {
  visible: boolean;
  x: number;
  z: number;
  /** Facing direction around y (0 = towards +z) */
  rot: number;
  /** Walking clock (seconds of walking), drives the leg swing */
  walk: number;
  walking: boolean;
  armUp?: boolean;
}

export function Person({
  pose,
  shirt = '#f97316',
  pants = '#1e3a8a',
  hair = '#3f2a1d',
  skin = '#f2c9a0',
  scale = 1,
}: {
  pose: () => Pose;
  shirt?: string;
  pants?: string;
  hair?: string;
  skin?: string;
  scale?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = pose();
    const g = group.current;
    if (!g) return;
    g.visible = p.visible;
    if (!p.visible) return;
    const swing = p.walking ? Math.sin(p.walk * 9) * 0.5 : 0;
    g.position.set(p.x, p.walking ? Math.abs(Math.sin(p.walk * 9)) * 0.04 * scale : 0, p.z);
    g.rotation.y = p.rot;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armR.current) armR.current.rotation.x = p.armUp ? -1.6 : -swing * 0.6;
    if (armL.current) armL.current.rotation.x = swing * 0.6;
  });
  return (
    <group ref={group} visible={false}>
      <group scale={scale}>
        <mesh ref={legL} position={[-0.1, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
          <meshStandardMaterial color={pants} />
        </mesh>
        <mesh ref={legR} position={[0.1, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
          <meshStandardMaterial color={pants} />
        </mesh>
        <mesh position={[0, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.5, 6, 12]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <group ref={armR} position={[0.26, 1.28, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
        </group>
        <group ref={armL} position={[-0.26, 1.28, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
        </group>
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.2, 20, 16]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <mesh position={[0, 1.78, -0.02]}>
          <sphereGeometry args={[0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
          <meshStandardMaterial color={hair} />
        </mesh>
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 1.65, 0.18]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * A toy car, 4 m long, nose towards +z. The parent positions and turns it.
 * `wheelSpin` returns the distance driven (for rolling wheels); `braking` lights the brake lights.
 */
export function CarBody({
  color,
  materialRef,
  wheelSpin,
  braking,
  headlights,
}: {
  color: string;
  materialRef?: (m: THREE.MeshStandardMaterial | null) => void;
  wheelSpin?: () => number;
  braking?: () => boolean;
  headlights?: () => number;
}) {
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const brake = useRef<THREE.MeshStandardMaterial>(null);
  const head = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const d = wheelSpin?.() ?? 0;
    for (const w of wheels.current) if (w) w.rotation.x = d / 0.34;
    if (brake.current) brake.current.emissiveIntensity = braking?.() ? 3 : 0.3;
    if (head.current) head.current.emissiveIntensity = 0.4 + (headlights?.() ?? 0) * 3;
  });
  const wheelPos: [number, number, number][] = [
    [-0.82, 0.34, -1.3],
    [0.82, 0.34, -1.3],
    [-0.82, 0.34, 1.3],
    [0.82, 0.34, 1.3],
  ];
  return (
    <group>
      <RoundedBox args={[1.7, 0.65, 4.0]} radius={0.2} position={[0, 0.62, 0]} castShadow>
        <meshStandardMaterial ref={materialRef} color={color} roughness={0.35} metalness={0.2} />
      </RoundedBox>
      <RoundedBox args={[1.5, 0.55, 2.0]} radius={0.22} position={[0, 1.12, -0.25]} castShadow>
        <meshStandardMaterial color="#93c5fd" roughness={0.1} metalness={0.3} />
      </RoundedBox>
      {[-0.55, 0.55].map((x) => (
        <mesh key={`h${x}`} position={[x, 0.68, 2.01]}>
          <boxGeometry args={[0.35, 0.14, 0.02]} />
          <meshStandardMaterial ref={x < 0 ? head : undefined} color="#fffbe6" emissive="#fff3b0" emissiveIntensity={0.4} toneMapped={false} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={`b${x}`} position={[x, 0.7, -2.01]}>
          <boxGeometry args={[0.35, 0.12, 0.02]} />
          <meshStandardMaterial ref={x < 0 ? brake : undefined} color="#7f1d1d" emissive="#ef4444" emissiveIntensity={0.3} toneMapped={false} />
        </mesh>
      ))}
      {wheelPos.map((p, i) => (
        <group key={i} position={p} ref={(g) => void (wheels.current[i] = g)}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.24, 18]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.26, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Expanding rings that show a sound or a sensor ping. */
export function Rings({ active, color = '#fbbf24', radius = 0.3, speed = 2.5 }: { active: () => boolean; color?: string; radius?: number; speed?: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const on = active();
    ring.current.visible = on;
    if (!on) return;
    const t = (clock.elapsedTime * speed) % 1;
    ring.current.scale.setScalar(1 + t * 2);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  });
  return (
    <mesh ref={ring} visible={false}>
      <ringGeometry args={[radius, radius * 1.15, 36]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** A white name sign that always faces the camera. */
export function LabelSprite({ text, position, width = 1.5 }: { text: string; position: [number, number, number]; width?: number }) {
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

/** A name sign shown only when the current mission uses that gadget. */
export function MissionLabel({ device, text, position, width }: { device: string; text: string; position: [number, number, number]; width?: number }) {
  const show = useMission().devices.includes(device);
  return show ? <LabelSprite text={text} position={position} width={width} /> : null;
}
