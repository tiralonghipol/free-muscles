import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, ContactShadows, Loader } from '@react-three/drei';
import { Body, type Highlight } from './components/Body';
import { MuscleTree } from './components/MuscleTree';
import { HOME } from './components/useCameraFocus';
import { ExercisePanel } from './components/ExercisePanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadExercises, type Exercise } from './data/exercises';
import { MUSCLE_GROUPS } from './data/muscles';
import { GROUP_ORDER, type MuscleTarget, type TreeGroup } from './data/anatomy';
import { readUrl, urlFor } from './urlState';
import { SCENE_COLORS, useTheme } from './theme';

const TARGET_Y = HOME.targetY;
type Vec3 = [number, number, number];
const VIEWS: Record<'front' | 'back', Vec3> = {
  front: [0, TARGET_Y, HOME.distance],
  back: [0, TARGET_Y, -HOME.distance],
};

export default function App() {
  const [initialUrl] = useState(readUrl);
  const { theme, toggle: toggleTheme } = useTheme();
  const [selected, setSelected] = useState<MuscleTarget | null>(initialUrl.selected);
  const [hovered, setHovered] = useState<Required<MuscleTarget> | null>(null);
  const [treeHover, setTreeHover] = useState<MuscleTarget | null>(null);
  const [tree, setTree] = useState<TreeGroup[] | null>(null);
  // Without the 3D model the tree can't list individual muscles; fall back to the groups.
  const [modelFailed, setModelFailed] = useState(false);
  const shownTree = useMemo(
    () => tree ?? (modelFailed ? GROUP_ORDER.map((id) => ({ id, muscles: [] })) : null),
    [tree, modelFailed],
  );
  const [treeOpen, setTreeOpen] = useState(false);
  const [openExercise, setOpenExercise] = useState<Exercise | null>(null);
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controls = useRef<CameraControls | null>(null);

  // An exercise named in the URL can only be opened once the list has loaded.
  const pendingExercise = useRef(initialUrl.exerciseId);
  const exercisesRef = useRef<Exercise[] | null>(null);

  useEffect(() => {
    loadExercises().then((list) => {
      exercisesRef.current = list;
      setExercises(list);
      const id = pendingExercise.current;
      pendingExercise.current = null;
      if (id) setOpenExercise(list.find((e) => e.id === id) ?? null);
    }, (e: Error) => {
      pendingExercise.current = null;
      setError(e.message);
    });
  }, []);

  // Mirror the selection into the URL; each change is a history entry, so Back steps back.
  // The first sync only tidies the landing URL (e.g. an unknown ?m=), so it replaces instead.
  const urlSynced = useRef(false);
  useEffect(() => {
    if (pendingExercise.current) return; // don't drop ?ex= before it has been restored
    const url = urlFor({ selected, exerciseId: openExercise?.id ?? null });
    if (url !== window.location.pathname + window.location.search + window.location.hash) {
      window.history[urlSynced.current ? 'pushState' : 'replaceState'](null, '', url);
    }
    urlSynced.current = true;
  }, [selected, openExercise]);

  // Back / Forward: restore the state from the URL (which then already matches, so no push).
  useEffect(() => {
    const onPop = () => {
      const { selected: s, exerciseId } = readUrl();
      setSelected(s);
      setOpenExercise(exerciseId ? exercisesRef.current?.find((e) => e.id === exerciseId) ?? null : null);
      setTreeOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Stable callback ref so the initial view is applied once, not on every render.
  const initControls = useCallback((c: CameraControls | null) => {
    if (c && !controls.current) c.setLookAt(...VIEWS.front, 0, TARGET_Y, 0, false);
    controls.current = c;
  }, []);

  // When an exercise is open, light up every muscle it works.
  const highlight = useMemo<Highlight>(() => {
    if (!openExercise) return {};
    const h: Highlight = {};
    for (const m of openExercise.secondaryMuscles) h[m] = 'secondary';
    for (const m of openExercise.primaryMuscles) h[m] = 'primary';
    return h;
  }, [openExercise]);

  const selectMuscle = (target: MuscleTarget | null) => {
    setSelected(target);
    setOpenExercise(null);
    setTreeOpen(false);
  };

  const goTo = (view: keyof typeof VIEWS) => {
    const [x, y, z] = VIEWS[view];
    controls.current?.setLookAt(x, y, z, 0, TARGET_Y, 0, true);
  };

  return (
    <div className={selected ? 'app has-selection' : 'app'}>
      <MuscleTree
        tree={shownTree}
        selected={selected}
        open={treeOpen}
        onSelect={selectMuscle}
        onHover={setTreeHover}
        onClose={() => setTreeOpen(false)}
      />
      <div className="viewport">
        <ErrorBoundary fallback={(e) => <ViewportError error={e} />} onError={() => setModelFailed(true)}>
          <Canvas camera={{ position: VIEWS.front, fov: 35 }} dpr={[1, 2]}>
            <color attach="background" args={[SCENE_COLORS[theme].background]} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[2, 4, 3]} intensity={1.4} />
            <directionalLight position={[-2, 2, -3]} intensity={0.6} />
            <hemisphereLight args={['#ffffff', SCENE_COLORS[theme].ground, 0.6]} />
            <Suspense fallback={null}>
              <Body
                selected={selected}
                highlight={highlight}
                externalHover={treeHover}
                onSelect={selectMuscle}
                onHover={setHovered}
                onTree={setTree}
              />
            </Suspense>
            <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={3} blur={2.5} />
            <CameraControls
              ref={initControls}
              makeDefault
              minDistance={0.4}
              maxDistance={5}
              minPolarAngle={0.2}
              maxPolarAngle={Math.PI / 2 + 0.2}
            />
          </Canvas>
        </ErrorBoundary>

        <div className="view-buttons">
          <button className="tree-open" onClick={() => setTreeOpen(true)}>☰ Muscles</button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {!modelFailed && (
            <>
              <button onClick={() => goTo('front')}>Front</button>
              <button onClick={() => goTo('back')}>Back</button>
            </>
          )}
        </div>
        {hovered && (
          <div className="hover-label">
            <strong>{MUSCLE_GROUPS[hovered.group].name}</strong> · {hovered.label}
          </div>
        )}
        <Loader />
        <a className="credit" href="https://www.z-anatomy.com/" target="_blank" rel="noreferrer">
          3D model: Z-Anatomy, CC BY-SA 4.0
        </a>
      </div>

      <ExercisePanel
        muscle={selected?.group ?? null}
        muscleLabel={selected?.label ?? null}
        exercises={exercises}
        error={error}
        openExercise={openExercise}
        onSelectMuscle={(id) => selectMuscle(id && { group: id })}
        onOpenExercise={setOpenExercise}
      />
    </div>
  );
}

// Shown instead of the 3D body when it can't be displayed; the muscle list and exercises still work.
function ViewportError({ error }: { error: Error }) {
  const noWebGl = /webgl|context/i.test(error.message);
  return (
    <div className="viewport-error" role="alert">
      <h2>{noWebGl ? 'This device can\'t show the 3D body' : 'The 3D body failed to load'}</h2>
      <p className="muted">
        {noWebGl
          ? 'Your browser or device has WebGL turned off or unsupported.'
          : 'Check your connection and reload the page.'}{' '}
        You can still pick muscles from the muscle list and browse every exercise.
      </p>
      {!noWebGl && <button className="icon-btn" onClick={() => window.location.reload()}>Reload</button>}
    </div>
  );
}
