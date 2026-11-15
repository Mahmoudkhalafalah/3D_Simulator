// Sky, sun, moon, stars and the garden around the house. Everything follows the time of day.
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store';
import { daylight } from '../../sim/session';

const NIGHT = new THREE.Color('#0b1430');
const DUSK = new THREE.Color('#f59e6b');
const DAY = new THREE.Color('#9fd8ff');

export function SkyAndLights() {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunBall = useRef<THREE.Mesh>(null);
  const moonBall = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);
  const bg = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const hour = useStore.getState().hour;
    const d = daylight(hour);
    const twilight = Math.max(0, 1 - Math.abs(d - 0.25) * 4) * (d > 0 ? 1 : 0);
    bg.copy(NIGHT).lerp(DAY, d).lerp(DUSK, twilight * 0.6);
    scene.background = bg;
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(bg);

    const angle = ((hour - 6) / 12) * Math.PI;
    const sx = Math.cos(angle) * 40;
    const sy = Math.sin(angle) * 32;
    if (sun.current) {
      sun.current.position.set(sx, Math.max(sy, 2), 18);
      sun.current.intensity = 2.6 * d;
      sun.current.color.set(twilight > 0.3 ? '#ffd2a1' : '#fff7e8');
    }
    if (sunBall.current) {
      sunBall.current.position.set(sx * 1.5, sy * 1.5, -60);
      sunBall.current.visible = sy > -2;
    }
    if (moonBall.current) {
      moonBall.current.position.set(-sx * 1.5, -sy * 1.5, -60);
      moonBall.current.visible = -sy > -2;
    }
    if (moon.current) moon.current.intensity = 0.35 * (1 - d);
    if (hemi.current) {
      hemi.current.intensity = 0.35 + 1.0 * d;
      hemi.current.color.set(d > 0.2 ? '#ffffff' : '#8aa4ff');
    }
    if (stars.current) stars.current.visible = d < 0.15;
  });

  return (
    <>
      <fog attach="fog" args={['#9fd8ff', 45, 110]} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#4b5d3a', 1]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0005}
      />
      <directionalLight ref={moon} position={[-10, 20, 10]} color="#9db4ff" />
      <mesh ref={sunBall}>
        <sphereGeometry args={[3.5, 24, 16]} />
        <meshBasicMaterial color="#ffe08a" toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={moonBall}>
        <sphereGeometry args={[2.2, 24, 16]} />
        <meshBasicMaterial color="#e5ecff" fog={false} />
      </mesh>
      <Stars ref={stars} radius={90} depth={30} count={1500} factor={4} fade speed={0.5} />
    </>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 1.4, 8]} />
        <meshStandardMaterial color="#7c4a26" />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <icosahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial color="#3f9b4b" flatShading />
      </mesh>
      <mesh position={[0.3, 2.7, 0.2]} castShadow>
        <icosahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color="#4cb35a" flatShading />
      </mesh>
    </group>
  );
}

function Bush({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <icosahedronGeometry args={[0.45, 0]} />
      <meshStandardMaterial color="#4fa35a" flatShading />
    </mesh>
  );
}

export function Garden() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#8cc56f" />
      </mesh>
      {/* road + sidewalk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 10.6]} receiveShadow>
        <planeGeometry args={[200, 3.2]} />
        <meshStandardMaterial color="#3f4652" />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-46 + i * 4, 0.005, 10.6]}>
          <planeGeometry args={[1.8, 0.14]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 8.5]} receiveShadow>
        <planeGeometry args={[200, 1.1]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* stepping-stone path to the front door */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0.012, 3.9 + i * 0.75]} receiveShadow>
          <circleGeometry args={[0.36, 7]} />
          <meshStandardMaterial color="#d6d3d1" />
        </mesh>
      ))}
      {/* driveway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.1, 0.008, 5.0]} receiveShadow>
        <planeGeometry args={[3.2, 6.0]} />
        <meshStandardMaterial color="#b8bcc4" />
      </mesh>
      <Tree position={[-7.5, 0, 4]} scale={1.2} />
      <Tree position={[-8.5, 0, -2.5]} scale={1.4} />
      <Tree position={[7.5, 0, 5.5]} />
      <Tree position={[8.6, 0, -1.5]} scale={1.3} />
      <Tree position={[-4, 0, -7]} scale={1.5} />
      <Tree position={[4, 0, -7.5]} scale={1.2} />
      <Bush position={[-3.4, 0.3, 2.6]} />
      <Bush position={[-4.3, 0.25, 2.5]} />
      <Bush position={[0.2, 0.3, 2.6]} />
      <Bush position={[-5.6, 0.3, 1]} />
      {/* mailbox */}
      <group position={[-0.6, 0, 7.6]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.08, 1, 0.08]} />
          <meshStandardMaterial color="#6b4423" />
        </mesh>
        <mesh position={[0, 1.08, 0]} castShadow>
          <boxGeometry args={[0.3, 0.25, 0.5]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
      </group>
    </group>
  );
}
