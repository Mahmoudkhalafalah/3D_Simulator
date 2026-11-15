import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { pinClicked } from './wiring';

interface Props {
  refId: string;
  position: [number, number, number];
  size?: [number, number, number];
  /** Pins that the Circuit Helper says are wrong */
  problem?: boolean;
}

/** Invisible, generous click target on top of a pin, with hover/selection glow. */
export function PinHit({ refId, position, size = [0.3, 0.4, 0.3], problem }: Props) {
  const hover = useStore((s) => s.hoverPin === refId);
  const pending = useStore((s) => s.pending === refId);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!mat.current) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 8);
    if (pending) {
      mat.current.color.set('#22d3ee');
      mat.current.opacity = 0.55 + 0.35 * pulse;
    } else if (hover) {
      mat.current.color.set('#fde047');
      mat.current.opacity = 0.75;
    } else if (problem) {
      mat.current.color.set('#ef4444');
      mat.current.opacity = 0.35 + 0.4 * pulse;
    } else {
      mat.current.opacity = 0;
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useStore.setState({ hoverPin: refId });
    document.body.style.cursor = 'pointer';
  };
  const out = () => {
    if (useStore.getState().hoverPin === refId) useStore.setState({ hoverPin: null });
    document.body.style.cursor = '';
  };

  return (
    <mesh
      position={position}
      onPointerOver={over}
      onPointerOut={out}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 6) return; // that was a camera drag, not a click
        pinClicked(refId);
      }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial ref={mat} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
