import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { MuscleGroupId } from '../data/muscles';
import { useCameraFocus } from './useCameraFocus';
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
  focus: '#2ec8ff',
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
      ...(k === 'focus' && { emissive: color, emissiveIntensity: 0.25 }),
    }),
  ]),
) as Record<Look, THREE.MeshStandardMaterial>;

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
      m.material = MATERIALS[group ? lookFor(group, label) : kind === 'bone' ? 'bone' : 'other'];
    }
  }, [meshes, selected, highlight, hovered, externalHover]);

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
        setHover(targetOf(e.object) ? e.object : null);
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const target = targetOf(e.object);
        if (target && e.delta <= CLICK_SLOP) onSelect(target);
      }}
    />
  );
}

useGLTF.preload(MODEL_URL, DRACO_URL);
