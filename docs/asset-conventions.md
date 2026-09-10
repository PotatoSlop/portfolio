# Asset conventions

**One root for all media: `public/Assets/`.** Everything a page references —
covers, sprites, GLBs, videos, PDFs, photos — lives under `public/Assets/` and is
referenced by an **absolute public path** (e.g. `/Assets/design/3d/boat.png`).
There is no longer a second copy of media under `src/assets/`.

## Why one root

Previously, cover stills lived in `src/assets/` (so Astro's `image()` pipeline
could optimize them) while sprites, GLBs, videos, and PDFs lived in
`public/Assets/`. That split was invisible to a human reader: two files serving
the same gallery section (`design/2d`) sat in two different trees purely because
of _how_ they were rendered. We collapsed to a single, legible root.

**Trade-off:** covers are now plain `<img src="/Assets/…">` with no build-time
resize/`webp`/hashing. On a portfolio-scale site this is acceptable; if a page
ever needs responsive optimization back, that specific image can be reintroduced
through `src/assets/` + `astro:assets` in isolation — the rest stay public.

## Folder layout

```
public/Assets/
  design/2d/      2D pieces + pixel-art sprites (guy.png, days-of-love.jpg, …)
  design/3d/      3D piece cover renders (boat.png, knight.png, mech.jpg)
  design/uiux/    UI/UX cover shots
  engineering/    engineering project covers
  software/       software project covers + landing screenshots
  images/         portrait + misc site imagery (irlHeadshot.jpg)
  models/         .glb / .fbx 3D models
  documents/      résumé PDFs (scanned by src/lib/resumes.ts)
  motion/ video/ icons/ Photography/   supporting media
```

## Field reference (content schemas)

| Field           | Type              | Example                                |
| --------------- | ----------------- | -------------------------------------- |
| `cover`         | public path       | `/Assets/design/3d/boat.png`           |
| `sprite`        | public path       | `/Assets/design/2d/guy.png`            |
| `posterVideo`   | public path       | `/Assets/engineering/foo.mp4`          |
| `glb`           | public path       | `/Assets/models/knight.glb`            |
| `gallery[]`     | public paths      | `/Assets/software/shot-1.png`          |

Adding work = drop the file under the right `public/Assets/` subfolder and point
the frontmatter field at its `/Assets/…` path. No import, no pipeline step.
