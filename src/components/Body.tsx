import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { MuscleGroupId } from '../data/muscles';
import { useCameraFocus } from './useCameraFocus';
import { useXray } from './useXray';
import { buildMuscleTree, meshInfo, type MuscleTarget, type TreeGroup } from '../data/anatomy';

export type Highlight = Partial<Record<MuscleGroupId, 'primary' | 'secondary'>>;

// Built by scripts/build-anatomy.py from Z-Anatomy (CC BY-SA 4.0). See MeshInfo for each mesh's userData.
const MODEL_URL = `${import.meta.env.BASE_URL}anatomy.glb`;
const DRACO_URL = `${import.meta.env.BASE_URL}draco/`;

interface BodyProps {
  selected: MuscleTarget | null;
  highlight: Highlight;
  /** Hover coming from outside the canvas (the muscle tree). */
  externalHover: MuscleTarget | null;
  onSelect: (target: Required<MuscleTarget>) => void;
  onHover: (target: Required<MuscleTarget> | null) => void;
  onTree: (tree: TreeGroup[]) => void;
}

const COLORS = {
  base: '#b5524a',
  hover: '#e8836f',
  selected: '#ffb347',
  // A single muscle picked inside its group: contrasting cyan, with the rest of the group dimmed.
  focus: '#45b8e0',
  groupDimmed: '#b9783f',
  primary: '#ff8a2a',
  secondary: '#f3e3a6',
  other: '#8c5550',
  bone: '#e6dccb',
};

type Look = keyof typeof COLORS;

// One shared material per look keeps the 600+ meshes on a handful of shader programs.
const MATERIALS = Object.fromEntries(
  Object.entries(COLORS).map(([k, color]) => [
    k,
    new THREE.MeshStandardMaterial({
      color,
      roughness: k === 'bone' ? 0.75 : 0.55,
      // Slight glow so the focused muscle still reads when it sits in shadow.
      ...(k === 'focus' && { emissive: color, emissiveIntensity: 0.1 }),
    }),
  ]),
) as Record<Look, THREE.MeshStandardMaterial>;

// See-through twins of each look, for meshes covering a buried selection (see useXray).
const GHOSTS = Object.fromEntries(
  Object.entries(MATERIALS).map(([k, m]) => [
    k,
    Object.assign(m.clone(), { transparent: true, opacity: 0.65, depthWrite: false }),
  ]),
) as Record<Look, THREE.MeshStandardMaterial>;

// Drawn over everything for a buried selection, so it stays visible through any number of
// ghosted layers while those stay opaque enough to read and click.
const XRAY_OVERLAY = new THREE.MeshBasicMaterial({
  color: COLORS.focus,
  transparent: true,
  opacity: 0.4,
  depthTest: false,
  depthWrite: false,
});

// Pointer travel (px) above which a click is treated as the end of a drag.
const CLICK_SLOP = 6;

function targetOf(o: THREE.Object3D): Required<MuscleTarget> | null {
  const { group, label } = meshInfo(o);
  return group ? { group, label } : null;
}

const matches = (t: MuscleTarget | null, group: MuscleGroupId, label: string) =>
  !!t && t.group === group && (!t.label || t.label === label);

export function Body({ selected, highlight, externalHover, onSelect, onHover, onTree }: BodyProps) {
  const { scene } = useGLTF(MODEL_URL, DRACO_URL);
  const [hovered, setHovered] = useState<MuscleGroupId | null>(null);
  const hoveredMesh = useRef<THREE.Object3D | null>(null);

  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) list.push(o);
    });
    return list;
  }, [scene]);

  useEffect(() => onTree(buildMuscleTree(scene)), [scene, onTree]);
  useCameraFocus(scene, meshes, selected);

  // X-ray only for a single picked muscle (both sides): a whole group usually has big visible
  // members, and ghosting everything around its deep ones (e.g. the chest for the rotator cuff)
  // hides more than it shows.
  const focusLabel = selected?.label;
  const selectedMeshes = useMemo(
    () => (focusLabel ? meshes.filter((m) => meshInfo(m).label === focusLabel) : []),
    [meshes, focusLabel],
  );
  const ghosts = useXray(scene, meshes, selectedMeshes);

  // Overlay copies of the selected meshes (geometry shared), only while something covers them.
  useEffect(() => {
    if (ghosts.size === 0) return;
    const overlay = new THREE.Group();
    for (const m of selectedMeshes) {
      const copy = new THREE.Mesh(m.geometry, XRAY_OVERLAY);
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(m.matrixWorld);
      copy.renderOrder = 10; // after the ghosted (transparent) meshes
      copy.raycast = () => {};
      overlay.add(copy);
    }
    scene.add(overlay);
    return () => {
      scene.remove(overlay);
    };
  }, [scene, selectedMeshes, ghosts]);

  useEffect(() => {
    const lookFor = (group: MuscleGroupId, label: string): Look => {
      if (selected?.group === group) {
        if (!selected.label) return 'selected';
        return selected.label === label ? 'focus' : 'groupDimmed';
      }
      if (highlight[group]) return highlight[group]!;
      if (hovered === group || matches(externalHover, group, label)) return 'hover';
      return 'base';
    };
    for (const m of meshes) {
      const { kind, group, label } = meshInfo(m);
      const look = group ? lookFor(group, label) : kind === 'bone' ? 'bone' : 'other';
      m.material = (ghosts.has(m) ? GHOSTS : MATERIALS)[look];
    }
  }, [meshes, selected, highlight, hovered, externalHover, ghosts]);

  // A ghosted mesh lets the pointer through only where the selected muscle shows behind it;
  // elsewhere it stays clickable, so neighbours of the selection can still be picked.
  const hitOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const first = e.intersections[0]?.object ?? null;
    if (!first || !ghosts.has(first as THREE.Mesh)) return first;
    const behind = e.intersections.find((i) => !ghosts.has(i.object as THREE.Mesh))?.object;
    return behind && selectedMeshes.includes(behind as THREE.Mesh) ? behind : first;
  };

  const setHover = (mesh: THREE.Object3D | null) => {
    if (mesh === hoveredMesh.current) return;
    hoveredMesh.current = mesh;
    const target = mesh ? targetOf(mesh) : null;
    setHovered(target?.group ?? null);
    onHover(target);
    document.body.style.cursor = target ? 'pointer' : 'auto';
  };

  return (
    <primitive
      object={scene}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const hit = hitOf(e);
        setHover(hit && targetOf(hit) ? hit : null);
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const hit = hitOf(e);
        const target = hit && targetOf(hit);
        if (target && e.delta <= CLICK_SLOP) onSelect(target);
      }}
    />
  );
}

useGLTF.preload(MODEL_URL, DRACO_URL);
