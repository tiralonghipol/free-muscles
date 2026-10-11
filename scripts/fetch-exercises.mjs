// Downloads the public-domain free-exercise-db (github.com/yuhonas/free-exercise-db)
// and writes a trimmed copy to public/exercises.json.
import { writeFile } from 'node:fs/promises';

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const res = await fetch(SRC);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const raw = await res.json();

const exercises = raw.map((e) => ({
  id: String(e.id),
  name: String(e.name),
  level: e.level ?? null,
  equipment: e.equipment ?? null,
  category: e.category ?? null,
  mechanic: e.mechanic ?? null,
  primaryMuscles: (e.primaryMuscles ?? []).map(String),
  secondaryMuscles: (e.secondaryMuscles ?? []).map(String),
  instructions: (e.instructions ?? []).map(String),
  images: (e.images ?? []).map(String),
}));

await writeFile(new URL('../public/exercises.json', import.meta.url), JSON.stringify(exercises));
console.log(`Wrote ${exercises.length} exercises`);
