import * as THREE from 'three';
import type { MuscleGroupId } from './muscles';

// Fields written into every mesh's glTF extras by scripts/build-anatomy.py.
export interface MeshInfo {
  kind: 'muscle' | 'other' | 'bone';
  group?: MuscleGroupId;
  label: string;
  side?: 'l' | 'r';
}

export interface MuscleTarget {
  group: MuscleGroupId;
  label?: string; // A single muscle; omitted for the whole group.
}

export interface TreeMuscle {
  label: string;
  y: number;
}

export interface TreeGroup {
  id: MuscleGroupId;
  muscles: TreeMuscle[];
}

// Head-to-toe order for the tree. Group centroids overlap too much (e.g. middle back vs traps) to sort by height.
const GROUP_ORDER: MuscleGroupId[] = [
  'neck', 'traps', 'shoulders', 'chest', 'biceps', 'triceps', 'forearms', 'lats', 'middle back',
  'abdominals', 'lower back', 'glutes', 'abductors', 'adductors', 'quadriceps', 'hamstrings', 'calves',
];

export const meshInfo = (o: THREE.Object3D) => o.userData as MeshInfo;

/** Display name for a structure: drops the redundant trailing "muscle". */
export const shortLabel = (label: string) => label.replace(/ muscles?$/, '');

/** Groups in GROUP_ORDER, each with its muscles ordered head to toe by the height of their centre on the model. */
export function buildMuscleTree(scene: THREE.Object3D): TreeGroup[] {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();
  const groups = new Map<MuscleGroupId, Map<string, number[]>>();

  scene.traverse((o) => {
    const { group, label } = meshInfo(o);
    if (!(o instanceof THREE.Mesh) || !group) return;
    const y = box.setFromObject(o).getCenter(centre).y;
    if (!groups.has(group)) groups.set(group, new Map());
    const muscles = groups.get(group)!;
    if (!muscles.has(label)) muscles.set(label, []);
    muscles.get(label)!.push(y);
  });

  const mean = (ys: number[]) => ys.reduce((a, b) => a + b, 0) / ys.length;
  return GROUP_ORDER.filter((id) => groups.has(id)).map((id) => ({
    id,
    muscles: [...groups.get(id)!].map(([label, ys]) => ({ label, y: mean(ys) })).sort((a, b) => b.y - a.y),
  }));
}
