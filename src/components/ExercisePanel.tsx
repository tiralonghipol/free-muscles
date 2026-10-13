import { useMemo, useState } from 'react';
import type { Exercise } from '../data/exercises';
import { ExerciseMedia } from './ExerciseMedia';
import { MUSCLE_GROUPS, type MuscleGroupId } from '../data/muscles';

interface Props {
  muscle: MuscleGroupId | null;
  muscleLabel: string | null;
  exercises: Exercise[] | null;
  error: string | null;
  openExercise: Exercise | null;
  onSelectMuscle: (id: MuscleGroupId | null) => void;
  onOpenExercise: (ex: Exercise | null) => void;
}

type Role = 'primary' | 'secondary';
const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
// Type filter values: 'training' (default) is everything except stretches; '' is all types.
const TRAINING = 'training';
const STRETCHING = 'stretching';
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ExercisePanel({ muscle, muscleLabel, exercises, error, openExercise, onSelectMuscle, onOpenExercise }: Props) {
  const [role, setRole] = useState<Role>('primary');
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState('');
  const [level, setLevel] = useState('');
  const [type, setType] = useState(TRAINING);

  const typeOptions = useMemo(
    () => [...new Set((exercises ?? []).map((e) => e.category).filter((c): c is string => !!c))].sort(),
    [exercises],
  );

  const equipmentOptions = useMemo(
    () => [...new Set((exercises ?? []).map((e) => e.equipment ?? 'other'))].sort(),
    [exercises],
  );

  const byRole = useMemo(() => {
    const out: Record<Role, Exercise[]> = { primary: [], secondary: [] };
    if (!muscle || !exercises) return out;
    for (const e of exercises) {
      if (e.primaryMuscles.includes(muscle)) out.primary.push(e);
      else if (e.secondaryMuscles.includes(muscle)) out.secondary.push(e);
    }
    return out;
  }, [muscle, exercises]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return byRole[role].filter((e) =>
      (!q || e.name.toLowerCase().includes(q)) &&
      (!equipment || (e.equipment ?? 'other') === equipment) &&
      (!level || e.level === level) &&
      (type === TRAINING ? e.category !== STRETCHING : !type || e.category === type),
    );
  }, [byRole, role, query, equipment, level, type]);

  // Stretches the default type filter is hiding here, to offer them back.
  const hiddenStretches = useMemo(
    () => (type === TRAINING ? byRole[role].filter((e) => e.category === STRETCHING).length : 0),
    [byRole, role, type],
  );

  if (!muscle) {
    return (
      <aside className="panel">
        <h1>Free Muscle</h1>
        <p className="muted">Tap a muscle on the body to see exercises that train it. Drag to rotate, pinch or scroll to zoom.</p>
        <h2>Or pick a muscle group</h2>
        <div className="chips">
          {Object.values(MUSCLE_GROUPS).map((g) => (
            <button key={g.id} className="chip" onClick={() => onSelectMuscle(g.id)}>{g.name}</button>
          ))}
        </div>
      </aside>
    );
  }

  const group = MUSCLE_GROUPS[muscle];

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <h1>{group.name}</h1>
          <p className={muscleLabel ? 'anatomy focus' : 'anatomy'}>{muscleLabel ?? group.anatomy}</p>
        </div>
        <button className="icon-btn" aria-label="Close" onClick={() => onSelectMuscle(null)}>✕</button>
      </div>
      <p className="muted">{group.description}</p>

      <div className="tabs" role="tablist">
        {(['primary', 'secondary'] as Role[]).map((r) => (
          <button key={r} role="tab" aria-selected={role === r} className={role === r ? 'tab active' : 'tab'} onClick={() => setRole(r)}>
            {r === 'primary' ? 'Main target' : 'Also works'} <span className="count">{byRole[r].length}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <input type="search" placeholder="Search exercises…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Equipment">
          <option value="">Any equipment</option>
          {equipmentOptions.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
          <option value="">Any level</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value={TRAINING}>No stretches</option>
          <option value="">All types</option>
          {typeOptions.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!exercises && !error && <p className="muted">Loading exercises…</p>}
      {exercises && visible.length === 0 && <p className="muted">No exercises match these filters.</p>}

      <ul className="exercise-list">
        {visible.map((e) => {
          const open = openExercise?.id === e.id;
          return (
            <li key={e.id} className={open ? 'exercise open' : 'exercise'}>
              <button className="exercise-row" onClick={() => onOpenExercise(open ? null : e)} aria-expanded={open}>
                <span className="exercise-name">{e.name}</span>
                <span className="tags">
                  <span className="tag">{e.equipment ?? 'other'}</span>
                  {e.category && e.category !== 'strength' && <span className="tag">{e.category}</span>}
                  {e.level && <span className={`tag level-${e.level}`}>{e.level}</span>}
                </span>
              </button>
              {open && <ExerciseDetail exercise={e} onSelectMuscle={onSelectMuscle} />}
            </li>
          );
        })}
      </ul>
      {hiddenStretches > 0 && (
        <p className="muted hidden-note">
          {hiddenStretches} {hiddenStretches === 1 ? 'stretch' : 'stretches'} hidden ·{' '}
          <button className="link-btn" onClick={() => setType('')}>Show all types</button>
        </p>
      )}
    </aside>
  );
}

function ExerciseDetail({ exercise, onSelectMuscle }: { exercise: Exercise; onSelectMuscle: (id: MuscleGroupId) => void }) {
  return (
    <div className="exercise-detail">
      <ExerciseMedia exercise={exercise} />
      <p className="legend"><span><i className="dot-primary" />Main target</span><span><i className="dot-secondary" />Also works</span></p>
      <div className="muscle-tags">
        {exercise.primaryMuscles.map((m) => (
          <button key={m} className="chip primary" onClick={() => onSelectMuscle(m)}>{MUSCLE_GROUPS[m]?.name ?? m}</button>
        ))}
        {exercise.secondaryMuscles.map((m) => (
          <button key={m} className="chip secondary" onClick={() => onSelectMuscle(m)}>{MUSCLE_GROUPS[m]?.name ?? m}</button>
        ))}
      </div>
      <ol>
        {exercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
    </div>
  );
}
