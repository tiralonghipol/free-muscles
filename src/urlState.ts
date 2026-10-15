// The selection lives in the URL so views can be shared and the browser's Back button steps back:
//   ?m=lats                                   muscle group
//   ?m=shoulders&part=Supraspinatus+muscle    one muscle in it
//   ?m=lats&ex=Pullups                        with an exercise open (also without m, from search)
import { MUSCLE_GROUPS, type MuscleGroupId } from './data/muscles';
import type { MuscleTarget } from './data/anatomy';

export interface UrlState {
  selected: MuscleTarget | null;
  exerciseId: string | null;
}

export function readUrl(): UrlState {
  const p = new URLSearchParams(window.location.search);
  const group = p.get('m');
  const selected = group && group in MUSCLE_GROUPS
    ? { group: group as MuscleGroupId, ...(p.get('part') && { label: p.get('part')! }) }
    : null;
  return { selected, exerciseId: p.get('ex') };
}

export function urlFor({ selected, exerciseId }: UrlState): string {
  // Keep any unrelated parameters.
  const p = new URLSearchParams(window.location.search);
  const set = (k: string, v: string | null | undefined) => (v ? p.set(k, v) : p.delete(k));
  set('m', selected?.group);
  set('part', selected?.label);
  set('ex', exerciseId);
  const q = p.toString();
  return window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
}
