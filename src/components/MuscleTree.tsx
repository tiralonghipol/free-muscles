import { useEffect, useMemo, useRef, useState } from 'react';
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

export function MuscleTree({ tree, selected, open, onSelect, onHover, onClose }: Props) {
  const [expanded, setExpanded] = useState<Set<MuscleGroupId>>(new Set());
  const [query, setQuery] = useState('');
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
    <aside className={open ? 'tree open' : 'tree'} onPointerLeave={() => onHover(null)}>
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
                <button
                  className="tree-toggle"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  aria-expanded={isOpen}
                  onClick={() => toggle(g.id)}
                >
                  {isOpen ? '▾' : '▸'}
                </button>
                <button
                  className="tree-name"
                  ref={groupActive && !selected?.label ? activeRow : undefined}
                  onPointerEnter={() => onHover({ group: g.id })}
                  onClick={() => onSelect({ group: g.id })}
                >
                  {MUSCLE_GROUPS[g.id].name}
                  <span className="count">{g.muscles.length}</span>
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
