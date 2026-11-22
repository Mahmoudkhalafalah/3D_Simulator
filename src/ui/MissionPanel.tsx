import { useState } from 'react';
import { useMission, useStore, useWorld } from '../store';
import { autoWire } from '../bench/wiring';
import { courseSession, courseTag } from '../worlds/course';

export function MissionPanel() {
  const world = useWorld();
  const mission = useMission();
  const done = useStore((s) => s.objectivesDone);
  const hintIndex = useStore((s) => s.hintIndex);
  const set = useStore((s) => s.set);
  const [open, setOpen] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const index = world.missions.findIndex((m) => m.id === mission.id);
  const current = done.indexOf(false);

  return (
    <div className={`card mission-card ${open ? '' : 'collapsed'}`}>
      <div className="card-head">
        <span>
          {mission.emoji} Mission {index + 1}: {mission.title}
        </span>
        <div className="head-actions">
          <button className="ghost small" onClick={() => set({ showMissions: true })}>
            🗺 All missions
          </button>
          <button className="ghost small" onClick={() => setOpen(!open)} title={open ? 'Hide' : 'Show'}>
            {open ? '▾' : '▸'}
          </button>
        </div>
      </div>
      {open && (
        <div className="mission-body">
          <p className="story">{mission.story}</p>
          {!!mission.course?.length && (
            <div className="course-chips">
              {mission.course.map((id) => (
                <button key={id} className="course-chip" title="Open the course map" onClick={() => set({ showCourse: true })}>
                  📘 {courseTag(id)} · {courseSession(id)?.title}
                </button>
              ))}
            </div>
          )}
          <ol className="steps">
            {mission.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {mission.objectives.length > 0 && (
            <ul className="objectives">
              {mission.objectives.map((o, i) => (
                <li key={i} className={done[i] ? 'done' : i === current ? 'current' : ''}>
                  <span className="check">{done[i] ? '✅' : i === current ? '👉' : '⬜'}</span>
                  {o.text}
                </li>
              ))}
            </ul>
          )}
          <div className="mission-actions">
            <button
              className="pill"
              onClick={() => {
                if (showHint) set({ hintIndex: (hintIndex + 1) % mission.hints.length });
                setShowHint(true);
              }}
            >
              💡 {showHint ? 'Next hint' : 'Hint'}
            </button>
            <button
              className="pill"
              onClick={() => {
                if (confirm('Replace your wires with the correct wiring for this mission?')) autoWire();
              }}
            >
              🪄 Wire it for me
            </button>
            <button className="pill" onClick={() => set({ showSolution: true })}>
              👀 Solution code
            </button>
          </div>
          {showHint && <div className="hint">💡 {mission.hints[hintIndex % mission.hints.length]}</div>}
        </div>
      )}
    </div>
  );
}
