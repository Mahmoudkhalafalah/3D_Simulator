import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';
import type { Wire } from '../sim/circuit';
import { useStore } from '../store';
import { pinPosition, type ModulePlacement, type Vec3 } from './layout';

const PLUG_H = 0.55;

function wireCurve(a: Vec3, b: Vec3): THREE.CatmullRomCurve3 {
  const A = new THREE.Vector3(a[0], a[1] + PLUG_H, a[2]);
  const B = new THREE.Vector3(b[0], b[1] + PLUG_H, b[2]);
  const flat = Math.hypot(A.x - B.x, A.z - B.z);
  const lift = Math.min(6, 0.9 + flat * 0.22);
  const mid = A.clone().lerp(B, 0.5);
  mid.y = Math.max(A.y, B.y) + lift;
  return new THREE.CatmullRomCurve3(
    [
      A,
      new THREE.Vector3(A.x, A.y + lift * 0.45, A.z),
      mid,
      new THREE.Vector3(B.x, B.y + lift * 0.45, B.z),
      B,
    ],
    false,
    'centripetal',
  );
}

function Plug({ at }: { at: Vec3 }) {
  return (
    <mesh position={[at[0], at[1] + PLUG_H / 2, at[2]]} castShadow>
      <boxGeometry args={[0.24, PLUG_H, 0.24]} />
      <meshStandardMaterial color="#18181b" roughness={0.6} />
    </mesh>
  );
}

function WireMesh({ wire, placements, boards }: { wire: Wire; placements: ModulePlacement[]; boards: number }) {
  const selected = useStore((s) => s.selectedWire === wire.id);
  const a = pinPosition(wire.a, placements, boards);
  const b = pinPosition(wire.b, placements, boards);
  const key = `${a?.join()}|${b?.join()}`;
  const geometry = useMemo(() => (a && b ? new THREE.TubeGeometry(wireCurve(a, b), 64, 0.08, 8, false) : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a || !b || !geometry) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    useStore.setState({ selectedWire: selected ? null : wire.id, pending: null });
  };

  return (
    <group>
      <mesh
        geometry={geometry}
        castShadow
        onClick={click}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshStandardMaterial
          color={wire.color}
          roughness={0.45}
          emissive={selected ? '#ffffff' : '#000000'}
          emissiveIntensity={selected ? 0.45 : 0}
        />
      </mesh>
      <Plug at={a} />
      <Plug at={b} />
    </group>
  );
}

export function Wires({ wires, placements, boards = 1 }: { wires: Wire[]; placements: ModulePlacement[]; boards?: number }) {
  return (
    <>
      {wires.map((w) => (
        <WireMesh key={w.id} wire={w} placements={placements} boards={boards} />
      ))}
    </>
  );
}

/** The "rubber band" wire that follows the mouse while you are connecting. */
export function PendingWire({ placements, pointer, boards = 1 }: { placements: ModulePlacement[]; pointer: React.RefObject<THREE.Vector3>; boards?: number }) {
  const pending = useStore((s) => s.pending);
  const line = useRef<any>(null);
  const start = pending ? pinPosition(pending, placements, boards) : null;
  useFrame(() => {
    if (!line.current || !start || !pointer.current) return;
    const s = new THREE.Vector3(start[0], start[1] + PLUG_H, start[2]);
    const e = pointer.current.clone();
    e.y = Math.max(e.y, 0.6);
    const m = s.clone().lerp(e, 0.5);
    m.y += 2 + s.distanceTo(e) * 0.15;
    line.current.setPoints(s, e, m);
  });
  if (!start) return null;
  const s: Vec3 = [start[0], start[1] + PLUG_H, start[2]];
  return <QuadraticBezierLine ref={line} start={s} end={s} color="#22d3ee" lineWidth={4} dashed dashScale={12} />;
}
