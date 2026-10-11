import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { CameraControls } from '@react-three/drei';
import { meshInfo, type MuscleTarget } from '../data/anatomy';
import { MUSCLE_GROUPS } from '../data/muscles';

/** Whole-body framing: camera this far from the body's mid-height. */
export const HOME = { targetY: 0.95, distance: 3.2 };

// Extra room around the focused muscles, and the closest the camera may get.
const PADDING = 1.6;
const MIN_DISTANCE = 0.6;

const VIEWS = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  side: new THREE.Vector3(1, 0, 0),
  otherSide: new THREE.Vector3(-1, 0, 0),
};

// Resolution of the offscreen silhouette renders used to compare views.
const PROBE_SIZE = 96;
// Below this many visible pixels in every view the muscle counts as buried (e.g. rectus abdominis
// under the external oblique's aponeurosis) and the group's configured view is used instead.
const MIN_VISIBLE_PIXELS = 40;
const probeTarget = new THREE.WebGLRenderTarget(PROBE_SIZE, PROBE_SIZE);
const probeCamera = new THREE.OrthographicCamera();
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });

/**
 * The view (front/back/either side) from which most of `picked` is unobstructed. Renders the model
 * from each view into a tiny offscreen target, picked meshes white and everything else black, and
 * counts the white pixels; far cheaper than raycasting hundreds of rays against ~300k triangles.
 */
function mostVisibleView(gl: THREE.WebGLRenderer, root: THREE.Object3D, picked: THREE.Mesh[], all: THREE.Mesh[]): THREE.Vector3 | null {
  const box = new THREE.Box3();
  for (const m of picked) box.expandByObject(m);
  const target = box.getCenter(new THREE.Vector3());
  const r = box.getBoundingSphere(new THREE.Sphere()).radius;
  Object.assign(probeCamera, { left: -r, right: r, top: r, bottom: -r, near: 0.01, far: 6 });
  probeCamera.updateProjectionMatrix();

  const saved = all.map((m) => m.material);
  const pickedSet = new Set(picked);
  all.forEach((m) => { m.material = pickedSet.has(m) ? WHITE : BLACK; });
  const prevTarget = gl.getRenderTarget();
  const prevClear = gl.getClearColor(new THREE.Color());
  const prevAlpha = gl.getClearAlpha();
  gl.setClearColor(0x000000, 1);

  const pixels = new Uint8Array(PROBE_SIZE * PROBE_SIZE * 4);
  let best = VIEWS.front;
  let bestCount = -1;
  for (const view of Object.values(VIEWS)) {
    probeCamera.position.copy(target).addScaledVector(view, 3);
    probeCamera.lookAt(target);
    gl.setRenderTarget(probeTarget);
    gl.clear();
    gl.render(root, probeCamera);
    gl.readRenderTargetPixels(probeTarget, 0, 0, PROBE_SIZE, PROBE_SIZE, pixels);
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 127) count++;
    if (count > bestCount) {
      best = view;
      bestCount = count;
    }
  }

  gl.setRenderTarget(prevTarget);
  gl.setClearColor(prevClear, prevAlpha);
  all.forEach((m, i) => { m.material = saved[i]; });
  return bestCount >= MIN_VISIBLE_PIXELS ? best : null;
}

/**
 * Moves the camera to frame the selected group or muscle, looking from the side it sits on.
 * Groups use their configured view (calves mix front and back muscles, so no single geometric
 * rule fits); a single muscle is viewed from wherever most of it is visible.
 * Deselecting zooms back out to the whole body.
 */
export function useCameraFocus(root: THREE.Object3D, meshes: THREE.Mesh[], selected: MuscleTarget | null) {
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as CameraControls | null;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const hadSelection = useRef(false);

  const group = selected?.group;
  const label = selected?.label;

  // Which way to look only depends on the selection; cache it so resizes just re-fit the distance.
  const view = useRef<{ key: string; dir: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!controls) return;

    if (!group) {
      // Only zoom out when a selection is cleared, not on every resize while browsing freely.
      if (!hadSelection.current) return;
      hadSelection.current = false;
      // Back to the whole body, keeping whichever side the user is looking from.
      const az = controls.azimuthAngle;
      controls.setLookAt(
        Math.sin(az) * HOME.distance, HOME.targetY, Math.cos(az) * HOME.distance,
        0, HOME.targetY, 0, true,
      );
      return;
    }

    const picked = meshes.filter((m) => {
      const info = meshInfo(m);
      return info.group === group && (!label || info.label === label);
    });
    if (picked.length === 0) return;
    hadSelection.current = true;

    const key = `${group}/${label ?? ''}`;
    if (view.current?.key !== key) {
      const dir = (label && mostVisibleView(gl, root, picked, meshes)) || VIEWS[MUSCLE_GROUPS[group].view];
      view.current = { key, dir };
    }

    const box = new THREE.Box3();
    for (const m of picked) box.expandByObject(m);
    const target = box.getCenter(new THREE.Vector3());

    // Distance that fits the bounding sphere in whichever field of view (vertical or horizontal) is tighter.
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius * PADDING;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (size.width / size.height));
    const distance = Math.max(MIN_DISTANCE, radius / Math.sin(Math.min(vFov, hFov) / 2));

    const eye = target.clone().addScaledVector(view.current.dir, distance);
    controls.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true);
    // Re-fit when the viewport resizes (e.g. the phone bottom sheet growing on selection).
  }, [gl, root, controls, camera, meshes, group, label, size.width, size.height]);
}
