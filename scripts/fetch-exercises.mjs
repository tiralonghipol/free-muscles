// Downloads the public-domain free-exercise-db (github.com/yuhonas/free-exercise-db)
// and writes a trimmed copy to public/exercises.json.
//
//   npm run fetch-exercises            # latest commit on upstream main
//   npm run fetch-exercises -- <sha>   # a specific commit
//
// The commit is recorded in the file, and the app loads exercise photos from jsDelivr at that
// same commit, so data and images always match and never change underneath the site.
import { writeFile } from 'node:fs/promises';

const REPO = 'yuhonas/free-exercise-db';

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const commit = process.argv[2] ?? (await json(`https://api.github.com/repos/${REPO}/commits/main`)).sha;
const raw = await json(`https://cdn.jsdelivr.net/gh/${REPO}@${commit}/dist/exercises.json`);

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

await writeFile(
  new URL('../public/exercises.json', import.meta.url),
  JSON.stringify({ source: { repo: REPO, commit }, exercises }),
);
console.log(`Wrote ${exercises.length} exercises from ${REPO}@${commit.slice(0, 7)}`);
