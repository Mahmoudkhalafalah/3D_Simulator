// The Robot Arena in 3D: a play mat in a school courtyard with the robot car, and the
// pieces each mission needs (a line track, a tunnel, a school zone, the cat's box,
// a maze, a garage). Everything is drawn from the same geometry the robot's physics uses.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { live } from '../../sim/session';
import { useBenchDevices, useMission, useStore } from '../../store';
import { emptyState } from '../../devices/logic';
import { canvasTexture } from '../../bench/textures';
import { SkyAndLights, Tree, Bush } from '../smartHome/Environment';
import { LabelSprite, Rings } from '../shared/models';
import { ARENA, LAYOUTS, LINE_WIDTH, trackPoints, type Layout, type LayoutId, type Rect, type Wall } from './arena';
import { EYE, FRONT, LINE_AHEAD, LINE_SIDE, RobotSim } from './sim';

type V3 = [number, number, number];
/** 1 cm on the mat = 0.1 units in 3D */
const S = 0.1;
const MAT_Y = 0.03;
const FALLBACK = new RobotSim();
const robot = () => (live.sim instanceof RobotSim ? live.sim : FALLBACK);
const st = (id: string) => live.states[id] ?? emptyState();
/** A point on the mat (cm) in 3D */
const at = (x: number, y: number, h = 0): V3 => [x * S, MAT_Y + h, -y * S];

function Box({ pos, size, color, cast = true, opacity }: { pos: V3; size: V3; color: string; cast?: boolean; opacity?: number }) {
  return (
    <mesh position={pos} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

/** A flat coloured rectangle painted on the mat. */
function Paint({ r, color, lift = 0.002, opacity, map }: { r: Rect; color: string; lift?: number; opacity?: number; map?: THREE.Texture }) {
  return (
    <mesh position={at((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, lift)} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[(r.x2 - r.x1) * S, (r.y2 - r.y1) * S]} />
      <meshStandardMaterial color={color} map={map} transparent={opacity !== undefined || !!map} opacity={opacity ?? 1} />
    </mesh>
  );
}

/** A rectangle drawn as an outline (dashed or solid) on the mat. */
function Outline({ points, color, dash = 0, width = 1.2 }: { points: [number, number][]; color: string; dash?: number; width?: number }) {
  const pieces: { pos: V3; len: number; angle: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const len = Math.hypot(bx - ax, by - ay);
    const angle = Math.atan2(by - ay, bx - ax);
    const step = dash > 0 ? dash * 2 : len;
    for (let d = 0; d < len - 0.01; d += step) {
      const l = Math.min(dash > 0 ? dash : len, len - d);
      const mx = ax + Math.cos(angle) * (d + l / 2);
      const my = ay + Math.sin(angle) * (d + l / 2);
      pieces.push({ pos: at(mx, my, 0.003), len: l, angle });
    }
  }
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={p.pos} rotation={[-Math.PI / 2, 0, p.angle]}>
          <planeGeometry args={[p.len * S, width * S]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

const rectPoints = (r: Rect): [number, number][] => [
  [r.x1, r.y1],
  [r.x2, r.y1],
  [r.x2, r.y2],
  [r.x1, r.y2],
];

// ------------------------------------------------------------------ courtyard and mat
function Courtyard() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial color="#7cc464" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[36, 28]} />
        <meshStandardMaterial color="#d6d3d1" />
      </mesh>
      {[
        [-20, -12],
        [21, -11],
        [-21, 9],
        [22, 10],
        [-8, -16],
        [9, -16.5],
      ].map(([x, z], i) => (
        <Tree key={i} position={[x, 0, z]} scale={1.2} />
      ))}
      {[
        [-17.5, -13],
        [17, -13.5],
        [-18.5, 12],
        [18.5, 12.5],
      ].map(([x, z], i) => (
        <Bush key={i} position={[x, 0.3, z]} />
      ))}
    </group>
  );
}

function Mat() {
  const map = useMemo(
    () =>
      canvasTexture(1040, 720, (g) => {
        g.fillStyle = '#f8fafc';
        g.fillRect(0, 0, 1040, 720);
        for (let i = 0; i <= 26; i++) {
          g.strokeStyle = i % 5 === 0 ? '#cbd5e1' : '#e2e8f0';
          g.lineWidth = i % 5 === 0 ? 3 : 1.5;
          g.beginPath();
          g.moveTo(i * 40, 0);
          g.lineTo(i * 40, 720);
          g.stroke();
        }
        for (let j = 0; j <= 18; j++) {
          g.strokeStyle = j % 5 === 0 ? '#cbd5e1' : '#e2e8f0';
          g.lineWidth = j % 5 === 0 ? 3 : 1.5;
          g.beginPath();
          g.moveTo(0, j * 40);
          g.lineTo(1040, j * 40);
          g.stroke();
        }
      }),
    [],
  );
  const w = (ARENA.x2 - ARENA.x1) * S;
  const d = (ARENA.y2 - ARENA.y1) * S;
  const H = 1;
  const T = 0.35;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, MAT_Y - 0.01, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={map} roughness={0.9} />
      </mesh>
      {/* border walls */}
      <Box pos={[0, H / 2, -d / 2 - T / 2]} size={[w + 2 * T, H, T]} color="#c08457" />
      <Box pos={[0, H / 2, d / 2 + T / 2]} size={[w + 2 * T, H, T]} color="#c08457" />
      <Box pos={[-w / 2 - T / 2, H / 2, 0]} size={[T, H, d]} color="#c08457" />
      <Box pos={[w / 2 + T / 2, H / 2, 0]} size={[T, H, d]} color="#c08457" />
    </group>
  );
}

function StartPad({ layout }: { layout: Layout }) {
  const { x, y, heading } = layout.start;
  const map = useMemo(
    () =>
      canvasTexture(256, 256, (g) => {
        g.fillStyle = 'rgba(34,197,94,0.25)';
        g.fillRect(0, 0, 256, 256);
        g.strokeStyle = '#16a34a';
        g.lineWidth = 12;
        g.setLineDash([26, 18]);
        g.strokeRect(8, 8, 240, 240);
        g.fillStyle = '#15803d';
        g.font = '900 54px Nunito, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.save();
        g.translate(128, 128);
        g.rotate(Math.PI / 2);
        g.fillText('START', 0, 0);
        g.restore();
      }),
    [],
  );
  return (
    <mesh position={at(x, y, 0.001)} rotation={[-Math.PI / 2, 0, (heading * Math.PI) / 180]}>
      <planeGeometry args={[2.6, 2.6]} />
      <meshStandardMaterial map={map} transparent depthWrite={false} />
    </mesh>
  );
}

// ------------------------------------------------------------------ walls, boxes and the cat
function WallBlock({ w }: { w: Wall }) {
  const h = w.kind === 'box' ? 2.2 : 1;
  const sx = (w.x2 - w.x1) * S;
  const sz = (w.y2 - w.y1) * S;
  const c = at((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2);
  if (w.kind === 'wall') return <Box pos={[c[0], h / 2, c[2]]} size={[sx, h, sz]} color="#c08457" />;
  return (
    <group position={[c[0], 0, c[2]]}>
      <Box pos={[0, h / 2, 0]} size={[sx, h, sz]} color="#c8a165" />
      <Box pos={[0, h + 0.005, 0]} size={[sx * 0.18, 0.01, sz + 0.01]} color="#e7d3a8" cast={false} />
    </group>
  );
}

function Cat() {
  const tail = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (tail.current) tail.current.rotation.z = 0.5 + Math.sin(clock.elapsedTime * 2.5) * 0.35;
  });
  const fur = '#f59e0b';
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow scale={[1.3, 0.8, 0.9]}>
        <sphereGeometry args={[0.45, 18, 14]} />
        <meshStandardMaterial color={fur} />
      </mesh>
      <mesh position={[-0.55, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.32, 18, 14]} />
        <meshStandardMaterial color={fur} />
      </mesh>
      {[-0.15, 0.15].map((z) => (
        <mesh key={z} position={[-0.6, 1.0, z]} rotation={[0, 0, 0.15]}>
          <coneGeometry args={[0.1, 0.2, 4]} />
          <meshStandardMaterial color={fur} />
        </mesh>
      ))}
      {[-0.11, 0.11].map((z) => (
        <mesh key={z} position={[-0.85, 0.75, z]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
      <mesh ref={tail} position={[0.6, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.7, 8]} />
        <meshStandardMaterial color={fur} />
      </mesh>
    </group>
  );
}

/** The cat's box: when the cat pushes it away it slides off the mat. */
function CatBox({ w }: { w: Wall }) {
  const group = useRef<THREE.Group>(null);
  const home = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const away = useMemo(() => new THREE.Vector3(0, 0, -(ARENA.y2 - (w.y1 + w.y2) / 2) * S - 3.2), [w]);
  useFrame((_, dt) => {
    if (!group.current) return;
    const target = robot().boxPresent ? home : away;
    group.current.position.lerp(target, Math.min(1, dt * 4));
  });
  const c = at((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2);
  return (
    <group position={[c[0], 0, c[2]]}>
      <group ref={group}>
        <WallBlock w={{ ...w, x1: -(w.x2 - w.x1) / 2, x2: (w.x2 - w.x1) / 2, y1: -(w.y2 - w.y1) / 2, y2: (w.y2 - w.y1) / 2 }} />
        <group position={[0, 2.2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <Cat />
        </group>
        <LabelSprite text="🐱 the cat's box" position={[0, 4.2, 0]} width={3.4} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ the black line track
function Track({ layout }: { layout: Layout }) {
  const geometry = useMemo(() => {
    const pts = trackPoints(layout.track!, 1.5);
    const pos: number[] = [];
    const idx: number[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const [px, py] = pts[(i - 1 + n) % n];
      const [qx, qy] = pts[(i + 1) % n];
      const len = Math.hypot(qx - px, qy - py) || 1;
      const nx = -(qy - py) / len;
      const ny = (qx - px) / len;
      const [x, y] = pts[i];
      const h = LINE_WIDTH / 2;
      pos.push((x + nx * h) * S, MAT_Y + 0.004, -(y + ny * h) * S, (x - nx * h) * S, MAT_Y + 0.004, -(y - ny * h) * S);
      if (i < n - 1) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [layout]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const t = layout.track!;
  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#0b0b0f" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* the start of the lap */}
      <Paint r={{ x1: t.cx - 0.8, x2: t.cx + 0.8, y1: t.cy - t.r - 6, y2: t.cy - t.r + 6 }} color="#22c55e" lift={0.006} />
    </group>
  );
}

// ------------------------------------------------------------------ tunnel, school zone, garage, treasure
function Tunnel({ r }: { r: Rect }) {
  const len = (r.x2 - r.x1) * S;
  const rad = ((r.y2 - r.y1) / 2) * S;
  const c = at((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2);
  const roof = useRef<THREE.MeshStandardMaterial>(null);
  // The roof turns see-through while the robot is inside, so kids can watch the
  // headlights. It still casts its shadow, so the tunnel stays dark.
  useFrame((_, dt) => {
    const b = robot();
    const near = b.x > r.x1 - 18 && b.x < r.x2 + 6 && b.y > r.y1 - 20 && b.y < r.y2 + 20;
    if (!roof.current) return;
    const want = near ? 0.28 : 1;
    roof.current.opacity += (want - roof.current.opacity) * Math.min(1, dt * 5);
    roof.current.depthWrite = roof.current.opacity > 0.95;
  });
  return (
    <group>
      <Paint r={r} color="#475569" lift={0.003} />
      <group position={[c[0], MAT_Y, c[2]]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[rad + 0.25, rad + 0.25, len, 32, 1, true, 0, Math.PI]} />
          <meshStandardMaterial ref={roof} color="#64748b" side={THREE.DoubleSide} transparent />
        </mesh>
        {[-len / 2, len / 2].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[rad + 0.25, 0.22, 10, 32, Math.PI]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        ))}
        <LabelSprite text="🚇 tunnel" position={[0, rad + 1.6, 0]} width={3} />
      </group>
    </group>
  );
}

function SchoolZone({ r, finishX }: { r: Rect; finishX?: number }) {
  const stripes = useMemo(
    () =>
      canvasTexture(700, 640, (g) => {
        g.fillStyle = 'rgba(250, 204, 21, 0.28)';
        g.fillRect(0, 0, 700, 640);
        g.fillStyle = '#eab308';
        for (let x = -640; x < 700; x += 70) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x + 35, 0);
          g.lineTo(x + 35 + 60, 60);
          g.lineTo(x + 60, 60);
          g.fill();
          g.beginPath();
          g.moveTo(x, 580);
          g.lineTo(x + 35, 580);
          g.lineTo(x + 35 + 60, 640);
          g.lineTo(x + 60, 640);
          g.fill();
        }
        g.fillStyle = '#ca8a04';
        g.font = '900 120px Nunito, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('SLOW', 350, 250);
        g.font = '900 64px Nunito, sans-serif';
        g.fillText('SCHOOL ZONE', 350, 390);
      }),
    [],
  );
  const flash = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const on = robot().speeding && Math.sin(clock.elapsedTime * 18) > 0;
    if (flash.current) flash.current.emissiveIntensity = on ? 8 : 0.1;
    if (light.current) light.current.intensity = on ? 30 : 0;
  });
  const sign = useMemo(
    () =>
      canvasTexture(256, 256, (g) => {
        g.fillStyle = '#facc15';
        g.translate(128, 128);
        g.rotate(Math.PI / 4);
        g.fillRect(-84, -84, 168, 168);
        g.lineWidth = 10;
        g.strokeStyle = '#111827';
        g.strokeRect(-76, -76, 152, 152);
        g.rotate(-Math.PI / 4);
        g.font = '110px "Segoe UI Emoji", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('🚸', 0, 6);
      }),
    [],
  );
  const cam = at(r.x2 - 6, r.y2 + 10);
  const post = at(r.x1, r.y1 - 12);
  return (
    <group>
      <Paint r={r} color="#ffffff" map={stripes} lift={0.004} />
      {/* the road through the zone */}
      <Outline points={[[ARENA.x1, r.y1], [ARENA.x2, r.y1]]} color="#94a3b8" />
      <Outline points={[[ARENA.x1, r.y2], [ARENA.x2, r.y2]]} color="#94a3b8" />
      {/* warning sign */}
      <group position={post}>
        <Box pos={[0, 1.2, 0]} size={[0.1, 2.4, 0.1]} color="#94a3b8" />
        <mesh position={[0, 2.4, 0.06]}>
          <planeGeometry args={[1.2, 1.2]} />
          <meshStandardMaterial map={sign} transparent side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* speed camera */}
      <group position={cam}>
        <Box pos={[0, 1.4, 0]} size={[0.12, 2.8, 0.12]} color="#64748b" />
        <Box pos={[-0.25, 2.85, 0]} size={[0.6, 0.4, 0.4]} color="#1f2937" />
        <mesh position={[-0.58, 2.85, 0]}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshStandardMaterial ref={flash} color="#fecaca" emissive="#ef4444" emissiveIntensity={0.1} toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[-0.9, 2.8, 0]} color="#ffffff" distance={10} intensity={0} />
        <LabelSprite text="📸 speed camera" position={[0, 3.9, 0]} width={3.4} />
      </group>
      {/* the school next to the road */}
      <group position={[(r.x1 + r.x2) * 0.5 * S, 0, -(ARENA.y2 * S) - 3.6]}>
        <Box pos={[0, 1.2, 0]} size={[6, 2.4, 3]} color="#fca5a5" />
        <mesh position={[0, 2.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[4.4, 1.2, 4]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
        {[-1.8, 0, 1.8].map((x) => (
          <Box key={x} pos={[x, 1.4, 1.52]} size={[0.9, 0.8, 0.04]} color="#bae6fd" cast={false} />
        ))}
        <LabelSprite text="🏫 school" position={[0, 4.4, 0]} width={3} />
      </group>
      {finishX !== undefined && <FinishLine x={finishX} y1={r.y1} y2={r.y2} />}
    </group>
  );
}

function FinishLine({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const map = useMemo(
    () =>
      canvasTexture(64, 256, (g) => {
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 8; j++) {
            g.fillStyle = (i + j) % 2 ? '#111827' : '#ffffff';
            g.fillRect(i * 32, j * 32, 32, 32);
          }
      }),
    [],
  );
  return (
    <group>
      <Paint r={{ x1: x - 3, x2: x + 3, y1, y2 }} color="#ffffff" map={map} lift={0.006} />
      <LabelSprite text="🏁 finish" position={at(x, y2 + 10, 1.4)} width={2.8} />
    </group>
  );
}

function Garage({ r }: { r: Rect }) {
  const c = at((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2);
  const w = (r.x2 - r.x1) * S;
  return (
    <group>
      <Paint r={{ x1: r.x1, x2: r.x2, y1: r.y1, y2: r.y2 }} color="#bfdbfe" lift={0.003} />
      <Outline points={rectPoints({ x1: r.x1 + 6, x2: r.x2 - 6, y1: r.y1 + 6, y2: r.y2 - 6 })} color="#2563eb" dash={4} />
      {/* the sign over the door */}
      <Box pos={[c[0], 1.9, -r.y1 * S]} size={[w + 1.2, 0.5, 0.25]} color="#1d4ed8" />
      {[r.x1 - 3, r.x2 + 3].map((x) => (
        <Box key={x} pos={[x * S, 0.95, -r.y1 * S]} size={[0.25, 1.9, 0.25]} color="#c08457" />
      ))}
      <LabelSprite text="🏠 garage" position={[c[0], 3.0, -r.y1 * S]} width={3} />
    </group>
  );
}

function Treasure({ r }: { r: Rect }) {
  const spot = at(r.x1 + 12, r.y2 - 9);
  return (
    <group>
      <Paint r={r} color="#fef3c7" lift={0.003} opacity={0.8} />
      <group position={spot}>
        <Box pos={[0, 0.35, 0]} size={[1.3, 0.7, 0.9]} color="#92400e" />
        <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 1.3, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#b45309" />
        </mesh>
        <Box pos={[0, 0.55, 0.46]} size={[0.25, 0.3, 0.04]} color="#fbbf24" />
        <group position={[0, 1.4, 0]}>
          <Rings active={() => !!live.snap.treasure} color="#fbbf24" radius={0.5} />
        </group>
      </group>
      <LabelSprite text="💎 treasure" position={[spot[0], 2.6, spot[2]]} width={3} />
    </group>
  );
}

function Park({ r }: { r: Rect }) {
  return (
    <group>
      <Paint r={{ x1: r.x1 - 1, x2: r.x1 + 1, y1: -60, y2: 60 }} color="#facc15" lift={0.005} />
      <Paint r={r} color="#dbeafe" lift={0.003} />
      <Outline points={rectPoints(r)} color="#2563eb" width={1.6} />
      <LabelSprite text="🅿️ park here" position={at((r.x1 + r.x2) / 2, r.y2 + 12, 1.2)} width={3} />
    </group>
  );
}

// ------------------------------------------------------------------ the robot's trail
function Trail() {
  const MAX = 1600;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < MAX - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const seen = useRef({ len: -1, resets: -1 });
  useFrame(() => {
    const r = robot();
    const trail = r.trail;
    if (trail.length === seen.current.len && r.resets === seen.current.resets) return;
    seen.current = { len: trail.length, resets: r.resets };
    const n = Math.min(MAX, trail.length / 2);
    const start = trail.length / 2 - n;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const h = 0.6;
    for (let i = 0; i < n && n > 1; i++) {
      const k = (start + i) * 2;
      // direction of the path here: towards the next point (or from the previous one at the end)
      const a = (start + Math.min(i, n - 2)) * 2;
      const dx = trail[a + 2] - trail[a];
      const dy = trail[a + 3] - trail[a + 1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * h;
      const ny = (dx / len) * h;
      arr.set([(trail[k] + nx) * S, MAT_Y + 0.008, -(trail[k + 1] + ny) * S, (trail[k] - nx) * S, MAT_Y + 0.008, -(trail[k + 1] - ny) * S], i * 6);
    }
    attr.needsUpdate = true;
    geometry.setDrawRange(0, Math.max(0, n - 1) * 6);
    geometry.computeBoundingSphere();
  });
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial color="#8b5cf6" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ------------------------------------------------------------------ the robot
function Wheel({ z, side }: { z: number; side: 'left' | 'right' }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const r = robot();
    const v = side === 'left' ? r.wl : r.wr;
    if (spin.current) spin.current.rotation.z -= (v * S * dt) / 0.33;
  });
  return (
    <group position={[0, 0.33, z]}>
      <group ref={spin}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.33, 0.33, 0.22, 24]} />
          <meshStandardMaterial color="#1f2937" roughness={0.9} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.24, 6]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      </group>
      {/* yellow TT gear motor */}
      <Box pos={[0, 0, -Math.sign(z) * 0.24]} size={[0.6, 0.22, 0.22]} color="#fbbf24" />
    </group>
  );
}

function Headlights() {
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const spot = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const b = st('headlights').brightness;
    mats.current.forEach((m) => m && (m.emissiveIntensity = 0.1 + b * 6));
    if (spot.current) spot.current.intensity = b * 40;
  });
  return (
    <group>
      {[-0.32, 0.32].map((z, i) => (
        <mesh key={z} position={[1.06, 0.42, z]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) mats.current[i] = m;
            }}
            color="#fffbeb" emissive="#fff7d6" emissiveIntensity={0.1} toneMapped={false} />
        </mesh>
      ))}
      <primitive object={target} position={[5, 0, 0]} />
      <spotLight ref={spot} position={[1.1, 0.45, 0]} target={target} angle={0.55} penumbra={0.6} distance={9} color="#fff7d6" intensity={0} />
    </group>
  );
}

/** The ultrasonic sensor's sound beam, shown for a moment after every ping. */
function Beam() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!mesh.current || !mat.current) return;
    const age = live.engineTime - st('eyes').ping;
    const show = live.running && age >= 0 && age < 0.25;
    mesh.current.visible = show;
    if (!show) return;
    const d = Math.min(400, robot().measure()) * S;
    mesh.current.scale.set(1, d, 1);
    mesh.current.position.x = 0.12 + d / 2;
    mat.current.opacity = 0.35 * (1 - age / 0.25);
  });
  return (
    <mesh ref={mesh} rotation={[0, 0, Math.PI / 2]} visible={false}>
      <coneGeometry args={[0.14 * 6, 1, 20, 1, true]} />
      <meshBasicMaterial ref={mat} color="#38bdf8" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Eyes({ onServo }: { onServo: boolean }) {
  const head = useRef<THREE.Group>(null);
  useFrame(() => {
    if (head.current) head.current.rotation.y = ((robot().eyeAngle - 90) * Math.PI) / 180;
  });
  return (
    <group position={[EYE * S, onServo ? 0.62 : 0.5, 0]}>
      {onServo && <Box pos={[-0.08, -0.08, 0]} size={[0.24, 0.16, 0.12]} color="#2563eb" />}
      <group ref={head}>
        <Box pos={[0, 0.12, 0]} size={[0.05, 0.22, 0.46]} color="#1e40af" />
        {[-0.13, 0.13].map((z) => (
          <mesh key={z} position={[0.07, 0.12, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
        <group position={[0, 0.12, 0]}>
          <Beam />
        </group>
      </group>
    </group>
  );
}

function LineSensor({ id, z }: { id: string; z: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const s = st(id);
    if (mat.current) mat.current.emissiveIntensity = s.powered && !s.on ? 4 : 0.05;
  });
  return (
    <group position={[LINE_AHEAD * S, 0.12, z]}>
      <Box pos={[0, 0, 0]} size={[0.3, 0.03, 0.18]} color="#1e3a8a" />
      <mesh position={[-0.08, 0.03, 0]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshStandardMaterial ref={mat} color="#22c55e" emissive="#22c55e" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Bumper() {
  const bar = useRef<THREE.Group>(null);
  useFrame(() => {
    if (bar.current) bar.current.position.x = FRONT * S - (robot().bumper ? 0.06 : 0);
  });
  return (
    <group ref={bar} position={[FRONT * S, 0.3, 0]}>
      <Box pos={[0, 0, 0]} size={[0.08, 0.16, 1.24]} color="#111827" />
      <Box pos={[-0.12, 0, 0]} size={[0.16, 0.1, 0.12]} color="#b91c1c" />
    </group>
  );
}

function Robot() {
  const devices = useBenchDevices();
  const has = (id: string) => devices.some((d) => d.id === id);
  const body = useRef<THREE.Group>(null);
  useFrame(() => {
    const r = robot();
    if (!body.current) return;
    body.current.position.set(r.x * S, MAT_Y, -r.y * S);
    body.current.rotation.y = r.heading;
  });
  return (
    <group ref={body}>
      {/* chassis */}
      <Box pos={[0.15, 0.42, 0]} size={[1.9, 0.05, 1.08]} color="#f97316" />
      <Box pos={[0.15, 0.2, 0]} size={[1.6, 0.04, 0.7]} color="#ea580c" />
      <Wheel z={-0.68} side="left" />
      <Wheel z={0.68} side="right" />
      {/* caster ball */}
      <mesh position={[-0.7, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.2} />
      </mesh>
      <Box pos={[-0.7, 0.3, 0]} size={[0.1, 0.22, 0.1]} color="#a1a1aa" />
      {/* Arduino, battery box and the two motor drivers */}
      <Box pos={[-0.15, 0.49, 0]} size={[0.69, 0.06, 0.53]} color="#0e7490" />
      <Box pos={[-0.15, 0.54, -0.22]} size={[0.5, 0.05, 0.05]} color="#111827" />
      <Box pos={[-0.15, 0.54, 0.22]} size={[0.5, 0.05, 0.05]} color="#111827" />
      <Box pos={[-0.62, 0.32, 0]} size={[0.3, 0.18, 0.55]} color="#111827" />
      <Box pos={[0.4, 0.47, -0.32]} size={[0.3, 0.05, 0.26]} color="#b45309" />
      <Box pos={[0.4, 0.47, 0.32]} size={[0.3, 0.05, 0.26]} color="#b45309" />
      {has('eyes') && <Eyes onServo={has('neck')} />}
      {has('bumper') && <Bumper />}
      {has('lineLeft') && <LineSensor id="lineLeft" z={-LINE_SIDE * S} />}
      {has('lineRight') && <LineSensor id="lineRight" z={LINE_SIDE * S} />}
      {has('headlights') && <Headlights />}
      {has('lightSensor') && (
        <group position={[0.2, 0.47, 0]}>
          <Box pos={[0, 0.02, 0]} size={[0.24, 0.03, 0.2]} color="#7c3aed" />
          <mesh position={[0.04, 0.07, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.05, 12]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
        </group>
      )}
      {has('horn') && (
        <group position={[0.65, 0.5, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.09, 0.09, 0.08, 14]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <group position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <Rings active={() => st('horn').freq > 0} radius={0.12} speed={4} />
          </group>
        </group>
      )}
    </group>
  );
}

/** 🎥 Follow the robot: the camera glides along with it (kids can still orbit and zoom). */
function FollowCam() {
  const { camera, controls } = useThree();
  const state = useRef({ on: false, zooming: false });
  const robotPos = useMemo(() => new THREE.Vector3(), []);
  const delta = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const c = controls as unknown as { target: THREE.Vector3; update(): void } | null;
    const on = useStore.getState().values.follow === 1;
    if (!on || !c?.target) {
      state.current.on = false;
      return;
    }
    if (!state.current.on) state.current = { on: true, zooming: true };
    const r = robot();
    robotPos.set(r.x * S, MAT_Y, -r.y * S);
    const k = 1 - Math.exp(-dt * 5);
    delta.subVectors(robotPos, c.target).multiplyScalar(k);
    c.target.add(delta);
    camera.position.add(delta);
    if (state.current.zooming) {
      const off = camera.position.clone().sub(c.target);
      const d = off.length();
      const want = 8.5;
      if (Math.abs(d - want) < 0.05) state.current.zooming = false;
      else camera.position.copy(c.target).add(off.setLength(d + (want - d) * k));
    }
    c.update();
  });
  return null;
}

export function RobotScene() {
  const mission = useMission();
  const layout = LAYOUTS[(mission.setup?.layout as LayoutId) ?? 'open'] ?? LAYOUTS.open;
  return (
    <>
      <SkyAndLights shadowSize={16} />
      <Courtyard />
      <Mat />
      <StartPad layout={layout} />
      {layout.park && <Park r={layout.park} />}
      {layout.guide && <Outline points={layout.guide} color="#60a5fa" dash={5} width={1.5} />}
      {layout.track && <Track layout={layout} />}
      {layout.school && <SchoolZone r={layout.school} finishX={layout.finishX} />}
      {layout.tunnel && <Tunnel r={layout.tunnel} />}
      {layout.garage && <Garage r={layout.garage} />}
      {layout.treasure && <Treasure r={layout.treasure} />}
      {layout.walls.map((w, i) => (w.removable ? <CatBox key={i} w={w} /> : <WallBlock key={i} w={w} />))}
      <Trail />
      <Robot />
      <FollowCam />
    </>
  );
}
