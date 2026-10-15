import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { MUSCLE_GROUPS, type MuscleGroupId } from '../data/muscles';
import { shortLabel, type MuscleTarget, type TreeGroup } from '../data/anatomy';

interface Props {
  tree: TreeGroup[] | null;
  selected: MuscleTarget | null;
  open: boolean;
  onSelect: (target: MuscleTarget) => void;
  onHover: (target: MuscleTarget | null) => void;
  onClose: () => void;
}

// Desktop sidebar width (px): draggable, remembered per browser.
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const maxWidth = () => Math.max(MIN_WIDTH, Math.min(560, Math.round(window.innerWidth * 0.45)));
const WIDTH_KEY = 'free-muscle.treeWidth';
const clampWidth = (w: number) => Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(w)));

function savedWidth() {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY));
    return w ? clampWidth(w) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(w: number) {
  try {
    localStorage.setItem(WIDTH_KEY, String(w));
  } catch {
    // Private mode etc.: the width just isn't remembered.
  }
}

export function MuscleTree({ tree, selected, open, onSelect, onHover, onClose }: Props) {
  const [expanded, setExpanded] = useState<Set<MuscleGroupId>>(new Set());
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(savedWidth);
  const activeRow = useRef<HTMLButtonElement | null>(null);

  // Selecting from the body opens the matching branch and scrolls it into view.
  useEffect(() => {
    if (!selected) return;
    setExpanded((s) => (s.has(selected.group) ? s : new Set(s).add(selected.group)));
    requestAnimationFrame(() => activeRow.current?.scrollIntoView({ block: 'nearest' }));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!tree || !q) return tree;
    return tree
      .map((g) => {
        if (MUSCLE_GROUPS[g.id].name.toLowerCase().includes(q)) return g;
        return { ...g, muscles: g.muscles.filter((m) => m.label.toLowerCase().includes(q)) };
      })
      .filter((g) => g.muscles.length > 0);
  }, [tree, query]);

  const toggle = (id: MuscleGroupId) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <aside
      className={open ? 'tree open' : 'tree'}
      style={{ '--tree-width': `${width}px` } as CSSProperties}
      onPointerLeave={() => onHover(null)}
    >
      <ResizeHandle width={width} onResize={setWidth} />
      <div className="tree-head">
        <h2>Muscles</h2>
        <button className="icon-btn tree-close" aria-label="Close muscle list" onClick={onClose}>✕</button>
      </div>
      <input
        className="tree-search"
        type="search"
        placeholder="Find a muscle…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!filtered && <p className="muted">Loading model…</p>}
      <ul className="tree-list">
        {filtered?.map((g) => {
          const isOpen = !!query.trim() || expanded.has(g.id);
          const groupActive = selected?.group === g.id;
          return (
            <li key={g.id}>
              <div className={groupActive && !selected?.label ? 'tree-row group active' : 'tree-row group'}>
                {g.muscles.length > 0 ? (
                  <button
                    className="tree-toggle"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    aria-expanded={isOpen}
                    onClick={() => toggle(g.id)}
                  >
                    {isOpen ? '▾' : '▸'}
                  </button>
                ) : (
                  <span className="tree-toggle" aria-hidden />
                )}
                <button
                  className="tree-name"
                  ref={groupActive && !selected?.label ? activeRow : undefined}
                  onPointerEnter={() => onHover({ group: g.id })}
                  onClick={() => onSelect({ group: g.id })}
                >
                  {MUSCLE_GROUPS[g.id].name}
                  {g.muscles.length > 0 && <span className="count">{g.muscles.length}</span>}
                </button>
              </div>
              {isOpen && (
                <ul>
                  {g.muscles.map((m) => {
                    const active = groupActive && selected?.label === m.label;
                    return (
                      <li key={m.label}>
                        <button
                          className={active ? 'tree-row leaf active' : 'tree-row leaf'}
                          ref={active ? activeRow : undefined}
                          title={m.label}
                          onPointerEnter={() => onHover({ group: g.id, label: m.label })}
                          onClick={() => onSelect({ group: g.id, label: m.label })}
                        >
                          {shortLabel(m.label)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** Drag (or arrow keys) to resize the sidebar; double-click to reset. */
function ResizeHandle({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const set = (w: number) => {
    const next = clampWidth(w);
    onResize(next);
    saveWidth(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = width;
    document.body.classList.add('resizing');
    const move = (ev: PointerEvent) => onResize(clampWidth(startW + ev.clientX - startX));
    const up = (ev: PointerEvent) => {
      set(startW + ev.clientX - startX);
      document.body.classList.remove('resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  return (
    <div
      className="tree-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize muscle list"
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={maxWidth()}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => set(DEFAULT_WIDTH)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          set(width + (e.key === 'ArrowRight' ? 20 : -20));
        }
      }}
    />
  );
}
