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
