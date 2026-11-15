import { useEffect, useMemo, useRef } from 'react';
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete';
import { useProject, useStore } from '../store';

const ARDUINO: Completion[] = [
  { label: 'pinMode', type: 'function', apply: 'pinMode(pin, OUTPUT);', info: 'Set a pin to OUTPUT (send) or INPUT (listen).' },
  { label: 'digitalWrite', type: 'function', apply: 'digitalWrite(pin, HIGH);', info: 'Turn a pin ON (HIGH) or OFF (LOW).' },
  { label: 'digitalRead', type: 'function', apply: 'digitalRead(pin)', info: 'Read a pin: HIGH or LOW.' },
  { label: 'analogRead', type: 'function', apply: 'analogRead(A0)', info: 'Read a voltage: 0 to 1023.' },
  { label: 'analogWrite', type: 'function', apply: 'analogWrite(pin, 128);', info: 'Dim a light or set a motor speed: 0 to 255 (only ~ pins).' },
  { label: 'delay', type: 'function', apply: 'delay(1000);', info: 'Wait. 1000 = one second.' },
  { label: 'delayMicroseconds', type: 'function', apply: 'delayMicroseconds(10);', info: 'Wait a tiny moment (millionths of a second).' },
  { label: 'millis', type: 'function', apply: 'millis()', info: 'Milliseconds since the program started.' },
  { label: 'tone', type: 'function', apply: 'tone(pin, 440);', info: 'Play a note on a buzzer. 440 = the note A.' },
  { label: 'noTone', type: 'function', apply: 'noTone(pin);', info: 'Stop the sound.' },
  { label: 'pulseIn', type: 'function', apply: 'pulseIn(pin, HIGH)', info: 'Measure how long a pin stays HIGH (microseconds).' },
  { label: 'map', type: 'function', apply: 'map(value, 0, 1023, 0, 255)', info: 'Change a number from one range to another.' },
  { label: 'constrain', type: 'function', apply: 'constrain(value, 0, 255)', info: 'Keep a number between a min and a max.' },
  { label: 'random', type: 'function', apply: 'random(0, 10)', info: 'A random number.' },
  { label: 'Serial.begin', type: 'function', apply: 'Serial.begin(9600);', info: 'Start talking to the Serial Monitor.' },
  { label: 'Serial.println', type: 'function', apply: 'Serial.println();', info: 'Print a line in the Serial Monitor.' },
  { label: 'Serial.print', type: 'function', apply: 'Serial.print();', info: 'Print without a new line.' },
  { label: 'HIGH', type: 'constant' },
  { label: 'LOW', type: 'constant' },
  { label: 'INPUT', type: 'constant' },
  { label: 'OUTPUT', type: 'constant' },
  { label: 'INPUT_PULLUP', type: 'constant' },
  { label: 'if', type: 'keyword', apply: 'if () {\n  \n}', info: 'Do something only when a condition is true.' },
  { label: 'else', type: 'keyword', apply: 'else {\n  \n}' },
  { label: 'for', type: 'keyword', apply: 'for (int i = 0; i < 10; i++) {\n  \n}', info: 'Repeat a number of times.' },
  { label: 'while', type: 'keyword', apply: 'while () {\n  \n}', info: 'Repeat while a condition is true.' },
  { label: 'int', type: 'type' },
  { label: 'long', type: 'type' },
  { label: 'float', type: 'type' },
  { label: 'bool', type: 'type' },
  { label: 'const', type: 'keyword' },
];

function arduinoCompletions(ctx: CompletionContext) {
  const word = ctx.matchBefore(/[\w.]+/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  return { from: word.from, options: ARDUINO, validFor: /^[\w.]*$/ };
}

const theme = EditorView.theme({
  '&': { fontSize: '15px', height: '100%' },
  '.cm-content': { fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace' },
  '.cm-gutters': { background: '#f8fafc', borderRight: '1px solid #e2e8f0', color: '#94a3b8' },
  '.cm-activeLine': { background: '#eff6ff' },
  '.cm-activeLineGutter': { background: '#dbeafe' },
});

export function CodePanel({ jumpRef }: { jumpRef: React.MutableRefObject<((line: number) => void) | null> }) {
  const project = useProject();
  const setCode = useStore((s) => s.setCode);
  const diagnostics = useStore((s) => s.diagnostics);
  const status = useStore((s) => s.status);
  const runningCode = useStore((s) => s.runningCode);
  const cm = useRef<ReactCodeMirrorRef>(null);
  const extensions = useMemo(() => [cpp(), lintGutter(), autocompletion({ override: [arduinoCompletions] }), theme], []);

  useEffect(() => {
    const view = cm.current?.view;
    if (!view) return;
    const doc = view.state.doc;
    const diags: CmDiagnostic[] = diagnostics.map((d) => {
      const line = doc.line(Math.min(Math.max(1, d.line), doc.lines));
      return {
        from: Math.min(line.to, line.from + Math.max(0, d.column - 1)),
        to: line.to,
        severity: d.severity === 'warning' ? 'warning' : 'error',
        message: d.friendly,
      };
    });
    view.dispatch(setDiagnostics(view.state, diags));
  }, [diagnostics]);

  useEffect(() => {
    jumpRef.current = (lineNo: number) => {
      const view = cm.current?.view;
      if (!view) return;
      const line = view.state.doc.line(Math.min(Math.max(1, lineNo), view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
      view.focus();
    };
  }, [jumpRef]);

  const changed = status === 'running' && runningCode !== null && runningCode !== project.code;

  return (
    <div className="card code-card">
      <div className="card-head">
        <span>💻 Code</span>
        {changed && <span className="badge warn">✏️ Code changed - press Run to upload it</span>}
      </div>
      <div className="code-wrap">
        <CodeMirror
          ref={cm}
          value={project.code}
          height="100%"
          extensions={extensions}
          onChange={(v) => setCode(v)}
          basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: false }}
        />
      </div>
    </div>
  );
}
