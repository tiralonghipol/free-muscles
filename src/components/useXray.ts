import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { CameraControls } from '@react-three/drei';

// Offscreen render size for the occlusion test. The test camera is cropped to the selection's
// on-screen box, so these pixels all land on it and off-screen meshes are culled.
const PASS_SIZE = 128;
// Each round ghosts the meshes covering the selection, then looks again for the next layer.
const MAX_LAYERS = 3;
// Only ghost meshes covering a real share of the selection, not a sliver along its edge.
const MIN_SHARE = 0.02;
const MIN_PIXELS = 3;

const target = new THREE.WebGLRenderTarget(1, 1);
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const idMaterials: THREE.MeshBasicMaterial[] = [];

/** Flat colour encoding index+1, written to the target byte-exact (linear, no tone mapping). */
function idMaterial(i: number) {
  if (!idMaterials[i]) {
    const id = i + 1;
    const color = new THREE.Color().setRGB((id >> 16 & 255) / 255, (id >> 8 & 255) / 255, (id & 255) / 255, THREE.LinearSRGBColorSpace);
    idMaterials[i] = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  }
  return idMaterials[i];
}

function render(gl: THREE.WebGLRenderer, root: THREE.Object3D, camera: THREE.Camera, pixels: Uint8Array) {
  gl.setRenderTarget(target);
  gl.clear();
  gl.render(root, camera);
  gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
}

/**
 * Meshes that hide part of `selected` from the current camera. Renders the selection alone to
 * find where it lies on screen, then every mesh in an ID colour: whatever shows up over the
 * selection is covering it. Repeats with those hidden, to catch deeper layers.
 */
/** A copy of `camera` whose view is cropped to the screen-space box around `selected`, or null if it's off screen. */
function croppedCamera(camera: THREE.PerspectiveCamera, selected: Set<THREE.Mesh>, viewport: THREE.Vector2) {
  const box = new THREE.Box3();
  selected.forEach((m) => box.expandByObject(m));
  const ndc = new THREE.Box2();
  const p = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    ndc.expandByPoint(new THREE.Vector2(p.x, p.y));
  }
  ndc.intersect(new THREE.Box2(new THREE.Vector2(-1, -1), new THREE.Vector2(1, 1)));
  if (ndc.isEmpty()) return null;
  const cam = camera.clone();
  const [w, h] = [viewport.x, viewport.y];
  cam.setViewOffset(w, h, ((ndc.min.x + 1) / 2) * w, ((1 - ndc.max.y) / 2) * h, ((ndc.max.x - ndc.min.x) / 2) * w, ((ndc.max.y - ndc.min.y) / 2) * h);
  return cam;
}

function findOccluders(gl: THREE.WebGLRenderer, root: THREE.Object3D, mainCamera: THREE.PerspectiveCamera, meshes: THREE.Mesh[], selected: Set<THREE.Mesh>) {
  const camera = croppedCamera(mainCamera, selected, gl.getDrawingBufferSize(new THREE.Vector2()));
  if (!camera) return new Set<THREE.Mesh>();
  target.setSize(PASS_SIZE, PASS_SIZE);
  const pixels = new Uint8Array(PASS_SIZE * PASS_SIZE * 4);

  const saved = meshes.map((m) => [m.material, m.visible] as const);
  const prevTarget = gl.getRenderTarget();
  const prevClear = gl.getClearColor(new THREE.Color());
  const prevAlpha = gl.getClearAlpha();
  gl.setClearColor(0x000000, 1);

  const occluders = new Set<THREE.Mesh>();
  try {
    // Where on screen the selection is (ignoring everything in front of it).
    meshes.forEach((m) => { m.visible = selected.has(m); m.material = WHITE; });
    render(gl, root, camera, pixels);
    const covered: number[] = [];
    for (let p = 0; p < pixels.length; p += 4) if (pixels[p] > 127) covered.push(p);
    if (covered.length === 0) return occluders;

    meshes.forEach((m, i) => { m.material = idMaterial(i); });
    for (let layer = 0; layer < MAX_LAYERS; layer++) {
      meshes.forEach((m) => { m.visible = !occluders.has(m); });
      render(gl, root, camera, pixels);
      const counts = new Map<number, number>();
      for (const p of covered) {
        const id = (pixels[p] << 16) | (pixels[p + 1] << 8) | pixels[p + 2];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      let added = 0;
      const minPixels = Math.max(MIN_PIXELS, covered.length * MIN_SHARE);
      for (const [id, n] of counts) {
        const mesh = meshes[id - 1];
        if (mesh && n >= minPixels && !selected.has(mesh) && !occluders.has(mesh)) {
          occluders.add(mesh);
          added++;
        }
      }
      if (added === 0) break;
    }
  } finally {
    meshes.forEach((m, i) => { m.material = saved[i][0]; m.visible = saved[i][1]; });
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevAlpha);
  }
  return occluders;
}

const EMPTY = new Set<THREE.Mesh>();

/**
 * X-ray for buried selections: returns the meshes currently covering `selected` (to be drawn
 * see-through). Recomputed when the selection changes and whenever the camera comes to rest.
 */
export function useXray(root: THREE.Object3D, meshes: THREE.Mesh[], selected: THREE.Mesh[]) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as CameraControls | null;
  const [occluders, setOccluders] = useState<Set<THREE.Mesh>>(EMPTY);

  useEffect(() => {
    if (selected.length === 0) {
      setOccluders(EMPTY);
      return;
    }
    const selectedSet = new Set(selected);
    const update = () => {
      const next = findOccluders(gl, root, camera, meshes, selectedSet);
      // Keep the same Set when nothing changed, to skip a re-render.
      setOccluders((prev) => (prev.size === next.size && [...next].every((m) => prev.has(m)) ? prev : next));
    };
    // The camera glides to the selection first, so test once it settles ('rest'); the timeout
    // covers selections that need no camera move, where no 'rest' event comes.
    const timer = setTimeout(update, 700);
    const onRest = () => { clearTimeout(timer); update(); };
    controls?.addEventListener('rest', onRest);
    return () => {
      clearTimeout(timer);
      controls?.removeEventListener('rest', onRest);
    };
  }, [gl, root, camera, controls, meshes, selected]);

  return occluders;
}
