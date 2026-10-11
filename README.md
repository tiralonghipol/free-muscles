# Free Muscle

A 3D muscle map you can explore in the browser: tap a muscle to see every exercise that trains it.
It runs on phones, tablets and desktop.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run build      # static site in dist/ — deploy to Vercel, Netlify, Cloudflare Pages, GitHub Pages…
```

## How it works

- **3D:** [React Three Fiber](https://r3f.docs.pmnd.rs/) + drei `CameraControls`. Drag to orbit, pinch or scroll to zoom. There are Front/Back presets.
- **Body:** `public/anatomy.glb` (1.7 MB, Draco-compressed) holds 400+ muscles plus the skeleton, built from [Z-Anatomy](https://www.z-anatomy.com/).
  Every mesh carries `userData` with `kind` (`muscle` / `other` / `bone`), `label` (e.g. "Long head of biceps brachii") and, for muscles, its exercise `group`.
  `src/components/Body.tsx` only reads those fields; the Draco decoder is self-hosted in `public/draco/`.
- **Exercises:** 876 exercises from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), trimmed into `public/exercises.json`.
  Refresh it with `npm run fetch-exercises`. Exercise images load straight from that repo on GitHub.
- **Muscle groups:** the 17 groups use the same names as the exercise DB (`chest`, `lats`, `lower back`, …), so no extra mapping is needed.
  The muscle → group map lives in `GROUP_RULES` in `scripts/build-anatomy.py`. Face, scalp, foot and rib-wall muscles are shown but not clickable.
- **Reverse lookup:** opening an exercise highlights every muscle it works on the model (orange = main target, pale yellow = also works).

## Rebuild the 3D model

Needs Blender 4.2+ (tested with 5.2). Download the two source files from
[Z-Anatomy-Sample](https://github.com/LluisV/Z-Anatomy-Sample/tree/master/Assets/Models/1.0%20Models), then:

```bash
blender -b --factory-startup -P scripts/build-anatomy.py -- \
  MuscularSystem100.fbx SkeletalSystem100.fbx public/anatomy.glb
```

The script drops fasciae, bursae, tendon sheaths and internal muscles, assigns groups, decimates to ~310k triangles and exports with Draco.

## License

App code: [MIT](LICENSE).
`public/anatomy.glb` is derived from Z-Anatomy and is licensed **CC BY-SA 4.0**:
keep the on-screen credit, and any modified version of the model must stay CC BY-SA.
Exercise data is public domain. See [LICENSE](LICENSE) for the full third-party notices.

## Next steps

1. Layer peeling for deep muscles (rotator cuff, psoas, transversus). Every muscle is already its own mesh.
2. Finer muscle divisions (for example front, side and rear delts) with a sub-mapping onto the DB groups.
3. Make it installable as a PWA (`vite-plugin-pwa`) and work offline.
4. Saved workouts and favourites.
