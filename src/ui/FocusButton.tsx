import { useStore } from '../store';

/** Enlarges one of the two 3D panels (world or workbench). */
export function FocusButton({ panel }: { panel: 'world' | 'bench' }) {
  const focus = useStore((s) => s.focus);
  const active = focus === panel;
  return (
    <button className="focus-btn" onClick={() => useStore.setState({ focus: active ? null : panel })} title={active ? 'Back to normal size' : 'Make this bigger'}>
      {active ? '⤡ Smaller' : '⤢ Bigger'}
    </button>
  );
}
