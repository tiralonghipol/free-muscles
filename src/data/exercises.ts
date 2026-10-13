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
  images: string[];
}

export const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export async function loadExercises(): Promise<Exercise[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}exercises.json`);
  if (!res.ok) throw new Error(`Failed to load exercises (${res.status})`);
  return res.json();
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
