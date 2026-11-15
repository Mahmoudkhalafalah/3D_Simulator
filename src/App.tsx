import { useEffect, useRef } from 'react';
import { TopBar } from './ui/TopBar';
import { MissionPanel } from './ui/MissionPanel';
import { CodePanel } from './ui/CodePanel';
import { BottomPanel } from './ui/BottomPanel';
import { Celebration, MissionMap, SolutionModal, ToolchainBanner, Welcome } from './ui/Overlays';
import { WorldView } from './worlds/WorldView';
import { Bench } from './bench/Bench';
import { startLoop } from './sim/session';
import { checkServer } from './sim/run';
import { useStore } from './store';
import { setMuted } from './audio/sound';

export default function App() {
  const jump = useRef<((line: number) => void) | null>(null);
  const focus = useStore((s) => s.focus);

  useEffect(() => {
    startLoop();
    void checkServer();
    const s = useStore.getState();
    setMuted(s.muted);
    s.openMission(s.missionId);
    if (s.welcomeSeen) useStore.setState({ showWelcome: false });
  }, []);

  return (
    <div className="app">
      <TopBar />
      <ToolchainBanner />
      <main className="main">
        <section className={`stage ${focus ? `focus-${focus}` : ''}`}>
          <WorldView />
          <Bench />
        </section>
        <aside className="side">
          <MissionPanel />
          <CodePanel jumpRef={jump} />
          <BottomPanel jump={(line) => jump.current?.(line)} />
        </aside>
      </main>
      <Welcome />
      <MissionMap />
      <SolutionModal />
      <Celebration />
    </div>
  );
}
