import type { MuscleGroupId } from './muscles';

export interface Exercise {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'expert' | null;
  equipment: string | null;
  category: string | null;
  mechanic: string | null;
  primaryMuscles: MuscleGroupId[];
  secondaryMuscles: MuscleGroupId[];
  instructions: string[];
  /** Full image URLs (resolved on load). */
  images: string[];
}

interface ExerciseFile {
  /** The free-exercise-db commit the data was taken from (scripts/fetch-exercises.mjs). */
  source: { repo: string; commit: string };
  exercises: Exercise[];
}

export async function loadExercises(): Promise<Exercise[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}exercises.json`);
  if (!res.ok) throw new Error(`Failed to load exercises (${res.status})`);
  const { source, exercises }: ExerciseFile = await res.json();
  // Photos come from jsDelivr's CDN pinned to the same commit as the data, so they always match.
  const base = `https://cdn.jsdelivr.net/gh/${source.repo}@${source.commit}/exercises/`;
  return exercises.map((e) => ({ ...e, images: e.images.map((img) => base + img) }));
}

/** Lowercase words, with hyphens dropped so "pull-up" matches "Pullups" and "Pull-Up". */
const normalize = (s: string) => s.toLowerCase().replace(/-/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Exercises whose name contains every word of `query`, best first: names starting with the
 * query, then names with a word starting with it, then the rest; shorter names first within each.
 */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(' ');
  const rank = (name: string) => (name.startsWith(q) ? 0 : ` ${name}`.includes(` ${words[0]}`) ? 1 : 2);
  return exercises
    .map((e) => ({ e, name: normalize(e.name) }))
    .filter(({ name }) => words.every((w) => name.includes(w)))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .map(({ e }) => e);
}
