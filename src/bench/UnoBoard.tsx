import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UNO_PINS, UNO_SIZE } from '../sim/board-uno';
import { HEADER_H, PCB_T, UNO_POS, UNO_SCALE } from './layout';
import { unoTexture } from './textures';
import { PinHit } from './PinHit';
import { live } from '../sim/session';

/** Board-relative position from real Uno millimetre coordinates. */
const mm = (x: number, y: number): [number, number] => [(x - 34.3) / 10, -(y - 26.65) / 10];
const P = 0.254;
const at = (x: number, y: number, h: number): [number, number, number] => {
  const [px, pz] = mm(x, y);
  return [px, h, pz];
};

function Header({ x0, x1, y }: { x0: number; x1: number; y: number }) {
  const [a, z] = mm(x0, y);
  const [b] = mm(x1, y);
  const len = Math.abs(b - a) + P;
  return (
    <mesh position={[(a + b) / 2, PCB_T + HEADER_H / 2, z]} castShadow>
      <boxGeometry args={[len, HEADER_H, P]} />
      <meshStandardMaterial color="#1c1c1e" roughness={0.6} />
    </mesh>
  );
}

function Led({ x, y, color, get }: { x: number; y: number; color: string; get: () => number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const [px, pz] = mm(x, y);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.05 + get() * 4;
  });
  return (
    <mesh position={[px, PCB_T + 0.04, pz]}>
      <boxGeometry args={[0.16, 0.08, 0.1]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.05} toneMapped={false} />
    </mesh>
  );
}

export function UnoBoard({ problems }: { problems: Set<string> }) {
  const tex = useMemo(() => unoTexture(), []);
  return (
    <group position={UNO_POS} scale={UNO_SCALE}>
      {/* PCB */}
      <mesh position={[0, PCB_T / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[UNO_SIZE.w, PCB_T, UNO_SIZE.d]} />
        <meshStandardMaterial color="#007a82" roughness={0.55} />
      </mesh>
      <mesh position={[0, PCB_T + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[UNO_SIZE.w, UNO_SIZE.d]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>

      {/* Headers */}
      <Header x0={18.8} x1={41.66} y={50.8} />
      <Header x0={45.72} x1={63.5} y={50.8} />
      <Header x0={27.94} x1={45.72} y={2.54} />
      <Header x0={50.8} x1={63.5} y={2.54} />

      {/* USB-B port */}
      <mesh position={at(3.2, 38.1, PCB_T + 0.55)} castShadow>
        <boxGeometry args={[1.6, 1.1, 1.2]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* DC jack */}
      <mesh position={at(4.4, 7.7, PCB_T + 0.55)} castShadow>
        <boxGeometry args={[1.35, 1.1, 0.9]} />
        <meshStandardMaterial color="#111" roughness={0.7} />
      </mesh>
      {/* ATmega328P chip in its socket */}
      <group position={at(47.5, 17.3, PCB_T)}>
        <mesh position={[0, 0.08, 0]} castShadow>
          <boxGeometry args={[3.6, 0.16, 1.0]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[3.5, 0.3, 0.74]} />
          <meshStandardMaterial color="#141414" roughness={0.4} />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => (
          <group key={i}>
            <mesh position={[-1.65 + i * 0.254, 0.2, 0.42]}>
              <boxGeometry args={[0.07, 0.2, 0.08]} />
              <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[-1.65 + i * 0.254, 0.2, -0.42]}>
              <boxGeometry args={[0.07, 0.2, 0.08]} />
              <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Reset button */}
      <group position={at(6.5, 49.2, PCB_T)}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.6, 0.2, 0.6]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.14, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>
      {/* Crystal + capacitors */}
      <mesh position={at(36, 27, PCB_T + 0.18)}>
        <capsuleGeometry args={[0.2, 0.6, 4, 12]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.25} />
      </mesh>
      {[[16.5, 13.5], [16.5, 21]].map(([x, y], i) => {
        const [px, pz] = mm(x, y);
        return (
          <mesh key={i} position={[px, PCB_T + 0.32, pz]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.64, 20]} />
            <meshStandardMaterial color="#1f2937" roughness={0.4} />
          </mesh>
        );
      })}
      {/* ICSP header */}
      {Array.from({ length: 6 }, (_, i) => {
        const [px, pz] = mm(64.5 + (i % 2) * 2.54, 27 + Math.floor(i / 2) * 2.54 - 2.54);
        return (
          <mesh key={i} position={[px, PCB_T + 0.3, pz]}>
            <boxGeometry args={[0.064, 0.6, 0.064]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.25} />
          </mesh>
        );
      })}

      {/* LEDs: L (pin 13), TX, ON */}
      <Led x={24.5} y={44} color="#ffb020" get={() => live.boardL} />
      <Led x={24.5} y={41.5} color="#ffb020" get={() => live.txFlash} />
      <Led x={24.5} y={39} color="#ffb020" get={() => 0} />
      <Led x={61} y={35} color="#4ade80" get={() => (live.running ? 1 : 0)} />

      {/* Clickable header holes */}
      {UNO_PINS.map((p) => (
        <group key={p.name}>
          <mesh position={[p.x, PCB_T + HEADER_H + 0.001, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.13, 0.13]} />
            <meshBasicMaterial color="#000" />
          </mesh>
          <PinHit
            refId={`uno:${p.name}`}
            position={[p.x, PCB_T + HEADER_H + 0.1, p.z]}
            size={[0.23, 0.3, 0.32]}
            problem={problems.has(`uno:${p.name}`)}
          />
        </group>
      ))}
    </group>
  );
}
