import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { missionDevices, useMission, useProject, useStore, useWorld } from '../store';
import { analyzeCircuit, describeRef } from '../sim/circuit';
import { UnoBoard } from './UnoBoard';
import { Rail } from './Rail';
import { ModuleView } from './Modules';
import { PendingWire, Wires } from './Wires';
import { benchDepth, benchWidth, layoutModules } from './layout';
import { matTexture } from './textures';
import { addWire, clearWires, freeRailHole, removeWire } from './wiring';
import { BOARD_IDS, BOARD_NAMES, UNO_PINS } from '../sim/board-uno';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { FocusButton } from '../ui/FocusButton';

/** Frames the whole bench (board, rail and every module) for the panel's current shape. */
function CameraRig({ depth, width, missionId }: { depth: number; width: number; missionId: string }) {
  const { camera, controls, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => {
    const zMin = -10.4;
    const zMax = depth + 0.6;
    const pitch = THREE.MathUtils.degToRad(64);
    const halfFov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2);
    const vertical = (zMax - zMin) * Math.sin(pitch) + 2.5 * Math.cos(pitch);
    const distV = vertical / 2 / Math.tan(halfFov);
    const distH = width / 2 / (Math.tan(halfFov) * aspect);
    const dist = Math.max(12, distV, distH) * 1.06;
    const centerZ = (zMin + zMax) / 2;
    camera.position.set(0, dist * Math.sin(pitch), centerZ + dist * Math.cos(pitch));
    const c = controls as unknown as OrbitControlsImpl | null;
    if (c) {
      c.target.set(0, 0, centerZ);
      c.update();
    } else {
      camera.lookAt(0, 0, centerZ);
    }
  }, [missionId, depth, width, aspect, camera, controls]);
  return null;
}

function ConnectMenu() {
  const pending = useStore((s) => s.pending);
  const world = useWorld();
  const boards = useMission().boards ?? 1;
  const [target, setTarget] = useState(0);
  if (!pending) return null;
  const fromBoard = pending.startsWith('uno:') || pending.startsWith('uno2:') || pending.startsWith('rail:');
  const b = BOARD_IDS[boards > 1 ? target : 0];
  const connect = (to: string) => {
    addWire(pending, to);
    useStore.setState({ pending: null });
  };
  const digital = UNO_PINS.filter((p) => p.kind === 'io' && p.name.startsWith('D') && p.io! >= 2);
  const analog = UNO_PINS.filter((p) => p.name.startsWith('A') && p.kind === 'io');
  return (
    <div className="connect-menu">
      <div className="connect-title">
        🔌 Connecting <b>{describeRef(pending, world.devices)}</b>
        <span>Click another pin, or choose:</span>
      </div>
      {!fromBoard && (
        <>
          {boards > 1 && (
            <div className="connect-row">
              {BOARD_NAMES.map((name, i) => (
                <button key={name} className={target === i ? 'board on' : 'board'} onClick={() => setTarget(i)}>
                  {i ? '🅱️' : '🅰️'} {name}
                </button>
              ))}
            </div>
          )}
          <div className="connect-row">
            {digital.map((p) => (
              <button key={p.name} onClick={() => connect(`${b}:${p.name}`)} title={p.label}>
                {[3, 5, 6, 9, 10, 11].includes(p.io!) ? '~' : ''}
                {p.io}
              </button>
            ))}
          </div>
          <div className="connect-row">
            {analog.map((p) => (
              <button key={p.name} className="analog" onClick={() => connect(`${b}:${p.name}`)}>
                {p.name}
              </button>
            ))}
            <button className="power" onClick={() => connect(`${b}:5V`)}>5V</button>
            <button className="power" onClick={() => connect(`${b}:3V3`)}>3.3V</button>
            <button className="gnd" onClick={() => connect(`${b}:GND1`)}>GND</button>
            <button className="power" onClick={() => connect(freeRailHole('P'))}>+ rail</button>
            <button className="gnd" onClick={() => connect(freeRailHole('N'))}>- rail</button>
          </div>
        </>
      )}
      <button className="cancel" onClick={() => useStore.setState({ pending: null })}>
        Cancel (Esc)
      </button>
    </div>
  );
}

export function Bench() {
  const world = useWorld();
  const mission = useMission();
  const project = useProject();
  const devices = useMemo(() => missionDevices(world, mission), [world, mission]);
  const placements = useMemo(() => layoutModules(devices), [devices]);
  const boards = mission.boards ?? 1;
  const depth = benchDepth(placements);
  const width = benchWidth(placements, boards);
  const analysis = useMemo(() => analyzeCircuit(devices, project.wires, boards), [devices, project.wires, boards]);
  const problems = useMemo(
    () => new Set(analysis.issues.filter((i) => i.level !== 'info').flatMap((i) => i.refs)),
    [analysis],
  );
  const pointer = useRef(new THREE.Vector3());
  const hoverPin = useStore((s) => s.hoverPin);
  const selectedWire = useStore((s) => s.selectedWire);
  const mat = useMemo(() => matTexture(), []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.cm-editor, input, textarea')) return;
      if (e.key === 'Escape') useStore.setState({ pending: null, selectedWire: null });
      const sel = useStore.getState().selectedWire;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) removeWire(sel);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <div className="bench fs-panel">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 26, 22], fov: 36, near: 0.5, far: 400 }}
        onPointerMissed={() => useStore.setState({ pending: null, selectedWire: null })}
      >
        <color attach="background" args={['#dbeafe']} />
        <hemisphereLight args={['#ffffff', '#64748b', 0.9]} />
        <directionalLight
          position={[10, 26, 14]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
          shadow-bias={-0.0004}
        />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          onPointerMove={(e) => pointer.current.copy(e.point)}
          onClick={(e) => {
            if (e.delta > 6) return;
            useStore.setState({ pending: null, selectedWire: null });
          }}
        >
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial map={mat} roughness={0.95} />
        </mesh>
        {Array.from({ length: boards }, (_, b) => (
          <UnoBoard key={b} problems={problems} board={b} boards={boards} />
        ))}
        <Rail problems={problems} />
        {placements.map((p) => (
          <ModuleView key={p.device.id} placement={p} problems={problems} />
        ))}
        <Wires wires={project.wires} placements={placements} boards={boards} />
        <PendingWire placements={placements} pointer={pointer} boards={boards} />
        <OrbitControls makeDefault maxPolarAngle={1.35} minDistance={6} maxDistance={90} enableDamping dampingFactor={0.12} />
        <CameraRig depth={depth} width={width} missionId={mission.id} />
      </Canvas>

      <div className="panel-title">
        <span>🔧 Workbench</span>
        <small>Click a pin, then another pin to connect a wire. Drag to look around.</small>
      </div>
      <FocusButton panel="bench" />
      <div className="bench-tools">
        {hoverPin && <div className="hover-chip">{describeRef(hoverPin, world.devices)}</div>}
        {selectedWire && (
          <button className="danger" onClick={() => removeWire(selectedWire)}>
            🗑 Delete wire
          </button>
        )}
        {project.wires.length > 0 && (
          <button
            className="ghost"
            onClick={() => {
              if (confirm('Remove all wires from the workbench?')) clearWires();
            }}
          >
            Clear wires
          </button>
        )}
      </div>
      <ConnectMenu />
    </div>
  );
}
