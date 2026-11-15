import { RAIL_HOLES } from '../sim/circuit';
import { RAIL_H, RAIL_LENGTH, RAIL_POS, RAIL_ROW_DZ, railHoleX } from './layout';
import { PinHit } from './PinHit';
import { Html } from '@react-three/drei';

/** A breadboard power rail: every hole in a row is connected inside. */
export function Rail({ problems }: { problems: Set<string> }) {
  const rows: ['P' | 'N', number][] = [
    ['P', -RAIL_ROW_DZ],
    ['N', RAIL_ROW_DZ],
  ];
  return (
    <group position={RAIL_POS}>
      <mesh position={[0, RAIL_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[RAIL_LENGTH, RAIL_H, 1.5]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
      </mesh>
      <mesh position={[0, RAIL_H + 0.001, -RAIL_ROW_DZ - 0.32]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RAIL_LENGTH - 0.6, 0.06]} />
        <meshBasicMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, RAIL_H + 0.001, RAIL_ROW_DZ + 0.32]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RAIL_LENGTH - 0.6, 0.06]} />
        <meshBasicMaterial color="#2563eb" />
      </mesh>
      {rows.map(([row, dz]) =>
        Array.from({ length: RAIL_HOLES }, (_, i) => {
          const ref = `rail:${row}${i}`;
          const x = railHoleX(i);
          return (
            <group key={ref}>
              <mesh position={[x, RAIL_H + 0.002, dz]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.14, 0.14]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
              <PinHit refId={ref} position={[x, RAIL_H + 0.1, dz]} size={[0.38, 0.3, 0.32]} problem={problems.has(ref)} />
            </group>
          );
        }),
      )}
      <Html position={[-RAIL_LENGTH / 2 - 1.3, 0.4, 0]} center distanceFactor={16} zIndexRange={[20, 0]}>
        <div className="rail-tag">
          <b style={{ color: '#dc2626' }}>+ 5V</b>
          <b style={{ color: '#2563eb' }}>- GND</b>
        </div>
      </Html>
    </group>
  );
}
