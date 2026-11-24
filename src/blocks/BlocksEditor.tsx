// The drag-and-drop block editor (loaded only when a kid switches to blocks).
import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { EMPTY_PROGRAM, TOOLBOX, generateArduino, registerBlocks } from './arduino';

let theme: Blockly.Theme | null = null;
function circuitTheme(): Blockly.Theme {
  theme ??= Blockly.Theme.defineTheme('circuit-world', {
    name: 'circuit-world',
    base: Blockly.Themes.Classic,
    fontStyle: { family: 'Nunito, "Segoe UI", sans-serif', weight: '800', size: 12 },
    componentStyles: {
      workspaceBackgroundColour: '#f8fafc',
      toolboxBackgroundColour: '#1e293b',
      toolboxForegroundColour: '#f8fafc',
      flyoutBackgroundColour: '#e2e8f0',
      flyoutOpacity: 0.96,
      scrollbarColour: '#94a3b8',
      insertionMarkerColour: '#0f172a',
    },
  });
  return theme;
}

export default function BlocksEditor({ initial, onChange }: { initial: object | undefined; onChange: (json: object, code: string) => void }) {
  const div = useRef<HTMLDivElement>(null);
  const changed = useRef(onChange);
  changed.current = onChange;

  useEffect(() => {
    registerBlocks();
    const ws = Blockly.inject(div.current!, {
      toolbox: TOOLBOX,
      renderer: 'zelos',
      theme: circuitTheme(),
      media: './blockly-media/',
      trashcan: true,
      sounds: true,
      zoom: { controls: true, wheel: true, startScale: 0.7, maxScale: 2, minScale: 0.35 },
      move: { scrollbars: true, drag: true, wheel: false },
      grid: { spacing: 24, length: 3, colour: '#e2e8f0', snap: true },
    });
    try {
      Blockly.serialization.workspaces.load(initial ?? EMPTY_PROGRAM, ws);
    } catch {
      Blockly.serialization.workspaces.load(EMPTY_PROGRAM, ws);
    }
    let timer = 0;
    const emit = () => changed.current(Blockly.serialization.workspaces.save(ws), generateArduino(ws));
    emit();
    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.isUiEvent) return;
      clearTimeout(timer);
      timer = window.setTimeout(emit, 120);
    });
    const resize = new ResizeObserver(() => Blockly.svgResize(ws));
    resize.observe(div.current!);
    return () => {
      clearTimeout(timer);
      resize.disconnect();
      ws.dispose();
    };
    // The workspace is created once per mission and board (the parent sets a key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={div} className="blocks-area" />;
}
