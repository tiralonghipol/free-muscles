import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { searchExercises, type Exercise } from '../data/exercises';
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

  // A new muscle starts on its main exercises with an empty search; equipment, level and type
  // are kept, as they're more like preferences. (Adjusting state during render, per React docs.)
  const [shownMuscle, setShownMuscle] = useState(muscle);
  if (muscle !== shownMuscle) {
    setShownMuscle(muscle);
    setRole('primary');
    setQuery('');
  }
  const filtersActive = !!(query.trim() || equipment || level || type !== TRAINING);
  const clearFilters = () => {
    setQuery('');
    setEquipment('');
    setLevel('');
    setType(TRAINING);
  };

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

  // Search, equipment and level; the type filter is applied separately so the stretches it hides can be counted.
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return byRole[role].filter((e) =>
      (!q || e.name.toLowerCase().includes(q)) &&
      (!equipment || (e.equipment ?? 'other') === equipment) &&
      (!level || e.level === level),
    );
  }, [byRole, role, query, equipment, level]);

  const visible = useMemo(
    () => matching.filter((e) => (type === TRAINING ? e.category !== STRETCHING : !type || e.category === type)),
    [matching, type],
  );

  // Stretches the default type filter is hiding (that the other filters would show), to offer them back.
  const hiddenStretches = useMemo(
    () => (type === TRAINING ? matching.filter((e) => e.category === STRETCHING).length : 0),
    [matching, type],
  );

  if (!muscle) {
    return (
      <HomePanel
        exercises={exercises}
        error={error}
        openExercise={openExercise}
        onSelectMuscle={onSelectMuscle}
        onOpenExercise={onOpenExercise}
      />
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
      {exercises && visible.length === 0 && (
        <p className="muted">
          No exercises match these filters.
          {filtersActive && <> <button className="link-btn" onClick={clearFilters}>Clear filters</button></>}
        </p>
      )}

      <ExerciseList exercises={withOpen(visible, openExercise)} openExercise={openExercise} onOpenExercise={onOpenExercise} onSelectMuscle={onSelectMuscle} />
      {hiddenStretches > 0 && (
        <p className="muted hidden-note">
          {hiddenStretches} {hiddenStretches === 1 ? 'stretch' : 'stretches'} hidden ·{' '}
          <button className="link-btn" onClick={() => setType('')}>Show all types</button>
        </p>
      )}
    </aside>
  );
}

/** The open exercise always shows, e.g. when opened from a shared link but outside this list or its filters. */
const withOpen = (list: Exercise[], open: Exercise | null) =>
  open && !list.some((e) => e.id === open.id) ? [open, ...list] : list;

// Shown with nothing selected: search every exercise by name.
const EXAMPLE_SEARCHES = ['Squat', 'Bench press', 'Deadlift', 'Pull-up', 'Push-up', 'Lunge', 'Plank'];
const MAX_RESULTS = 50;

interface HomeProps {
  exercises: Exercise[] | null;
  error: string | null;
  openExercise: Exercise | null;
  onSelectMuscle: (id: MuscleGroupId | null) => void;
  onOpenExercise: (ex: Exercise | null) => void;
}

function HomePanel({ exercises, error, openExercise, onSelectMuscle, onOpenExercise }: HomeProps) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchExercises(exercises ?? [], query), [exercises, query]);
  const searching = query.trim().length > 0;

  return (
    <aside className="panel">
      <h1>Free Muscle</h1>
      <p className="muted">Tap a muscle to see its exercises, or search for an exercise to see the muscles it works.</p>
      <input
        className="home-search"
        type="search"
        placeholder={exercises ? `Search ${exercises.length} exercises…` : 'Search exercises…'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onOpenExercise(null);
        }}
        aria-label="Search exercises"
      />
      {error && <p className="error">{error}</p>}
      {!exercises && !error && <p className="muted">Loading exercises…</p>}

      {!searching && (
        <div className="chips examples">
          {EXAMPLE_SEARCHES.map((q) => (
            <button key={q} className="chip" onClick={() => setQuery(q)}>{q}</button>
          ))}
        </div>
      )}
      {searching && exercises && (
        <p className="muted result-count">
          {results.length === 0
            ? 'No exercises match.'
            : results.length > MAX_RESULTS
              ? `Showing ${MAX_RESULTS} of ${results.length}, keep typing to narrow down.`
              : `${results.length} ${results.length === 1 ? 'exercise' : 'exercises'}`}
        </p>
      )}
      <ExerciseList
        exercises={withOpen(results.slice(0, MAX_RESULTS), openExercise)}
        openExercise={openExercise}
        onOpenExercise={onOpenExercise}
        onSelectMuscle={onSelectMuscle}
        showMuscles
      />
    </aside>
  );
}

interface ListProps {
  exercises: Exercise[];
  openExercise: Exercise | null;
  onOpenExercise: (ex: Exercise | null) => void;
  onSelectMuscle: (id: MuscleGroupId) => void;
  /** Name the main target muscles on each row (for lists not tied to one muscle). */
  showMuscles?: boolean;
}

function ExerciseList({ exercises, openExercise, onOpenExercise, onSelectMuscle, showMuscles }: ListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // Where the clicked row was on screen, to keep it under the cursor after the list re-flows.
  const anchor = useRef<{ id: string; top: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    const item = a && listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(a.id)}"]`);
    const scroller = item?.closest<HTMLElement>('.panel');
    if (!a || !item || !scroller) return;
    // Opening one exercise collapses the previous one; if that was above, everything jumps up.
    // Undo the jump so the clicked row stays where it was clicked...
    scroller.scrollTop += item.getBoundingClientRect().top - a.top;
    // ...then scroll just enough to bring its photo (or the details) into view.
    (item.querySelector('.media') ?? item.querySelector('.exercise-detail'))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openExercise]);

  const toggle = (e: Exercise, open: boolean, row: HTMLElement) => {
    anchor.current = open ? null : { id: e.id, top: row.getBoundingClientRect().top };
    onOpenExercise(open ? null : e);
  };

  return (
    <ul className="exercise-list" ref={listRef}>
      {exercises.map((e) => {
        const open = openExercise?.id === e.id;
        return (
          <li key={e.id} data-id={e.id} className={open ? 'exercise open' : 'exercise'}>
            <button className="exercise-row" onClick={(ev) => toggle(e, open, ev.currentTarget)} aria-expanded={open}>
              <span className="exercise-name">{e.name}</span>
              {showMuscles && (
                <span className="exercise-muscles">{e.primaryMuscles.map((m) => MUSCLE_GROUPS[m]?.name ?? m).join(', ')}</span>
              )}
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
