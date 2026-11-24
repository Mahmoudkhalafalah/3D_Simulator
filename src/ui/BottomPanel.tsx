import { useEffect, useMemo, useRef, useState } from 'react';
import { missionDevices, useMission, useProject, useStore, useWorld } from '../store';
import { analyzeCircuit } from '../sim/circuit';
import { serialSend } from '../sim/session';

function Helper() {
  const world = useWorld();
  const mission = useMission();
  const project = useProject();
  const status = useStore((s) => s.status);
  const analysis = useMemo(() => analyzeCircuit(missionDevices(world, mission), project.wires, mission.boards ?? 1), [world, mission, project.wires]);
  const order = { error: 0, warn: 1, info: 2 };
  const issues = [...analysis.issues].sort((a, b) => order[a.level] - order[b.level]);
  const allWired = Object.values(analysis.devices).every((d) => d.powerOk) && !issues.some((i) => i.level !== 'info');
  return (
    <div className="helper">
      {issues.length === 0 && allWired && (
        <div className="issue ok">✅ Your wiring looks great!{status !== 'running' ? ' Press ▶ Run to try it.' : ''}</div>
      )}
      {issues.map((i, k) => (
        <div key={k} className={`issue ${i.level}`}>
          {i.text}
        </div>
      ))}
    </div>
  );
}

function Serial() {
  const two = useMission().boards === 2;
  const serialBoard = useStore((s) => s.serialBoard);
  const board = two ? serialBoard : 0;
  const serial = useStore((s) => (board === 1 ? s.serial2 : s.serial));
  const status = useStore((s) => s.status);
  const [text, setText] = useState('');
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [serial]);
  const send = () => {
    if (!text) return;
    serialSend(text + '\n', board);
    setText('');
  };
  return (
    <div className="serial">
      {two && (
        <div className="board-tabs small">
          {['🅰️ Arduino A', '🅱️ Arduino B'].map((label, b) => (
            <button key={b} className={board === b ? 'active' : ''} onClick={() => useStore.setState({ serialBoard: b as 0 | 1 })}>
              {label}
            </button>
          ))}
        </div>
      )}
      <pre ref={box}>{serial || (status === 'running' ? '(nothing printed yet - use Serial.println() in your code)' : 'Run your code to see what it prints here.')}</pre>
      <div className="serial-input">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Send a message to the Arduino…" />
        <button onClick={send} disabled={status !== 'running'}>
          Send
        </button>
        <button className="ghost" onClick={() => useStore.setState(board === 1 ? { serial2: '' } : { serial: '' })}>
          Clear
        </button>
      </div>
    </div>
  );
}

function Errors({ jump }: { jump: (line: number) => void }) {
  const diagnostics = useStore((s) => s.diagnostics);
  const output = useStore((s) => s.compileOutput);
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  return (
    <div className="errors">
      {errors.length === 0 && warnings.length === 0 && !output && <div className="issue ok">No problems with your code. 🎉</div>}
      {[...errors, ...warnings].map((d, i) => (
        <button key={i} className={`issue ${d.severity === 'error' ? 'error' : 'warn'} as-link`} onClick={() => jump(d.line)}>
          <b>
            {d.board === 1 ? 'Arduino B, ' : ''}Line {d.line}:
          </b>{' '}
          {d.friendly}
          {d.friendly !== d.message && <small>{d.message}</small>}
        </button>
      ))}
      {output && (
        <details>
          <summary>Full compiler message</summary>
          <pre>{output}</pre>
        </details>
      )}
    </div>
  );
}

export function BottomPanel({ jump }: { jump: (line: number) => void }) {
  const tab = useStore((s) => s.bottomTab);
  const set = useStore((s) => s.set);
  const errorCount = useStore((s) => s.diagnostics.filter((d) => d.severity === 'error').length);
  const world = useWorld();
  const mission = useMission();
  const project = useProject();
  const issueCount = useMemo(
    () => analyzeCircuit(missionDevices(world, mission), project.wires, mission.boards ?? 1).issues.filter((i) => i.level !== 'info').length,
    [world, mission, project.wires],
  );
  return (
    <div className="card bottom-card">
      <div className="tabs">
        <button className={tab === 'helper' ? 'active' : ''} onClick={() => set({ bottomTab: 'helper' })}>
          🤖 Circuit Helper {issueCount > 0 && <span className="count">{issueCount}</span>}
        </button>
        <button className={tab === 'serial' ? 'active' : ''} onClick={() => set({ bottomTab: 'serial' })}>
          📟 Serial Monitor
        </button>
        <button className={tab === 'errors' ? 'active' : ''} onClick={() => set({ bottomTab: 'errors' })}>
          🐞 Code Check {errorCount > 0 && <span className="count red">{errorCount}</span>}
        </button>
      </div>
      <div className="tab-body">
        {tab === 'helper' && <Helper />}
        {tab === 'serial' && <Serial />}
        {tab === 'errors' && <Errors jump={jump} />}
      </div>
    </div>
  );
}
