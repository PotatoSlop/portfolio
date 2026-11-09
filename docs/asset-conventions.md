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
| `hoverGif`      | public path       | `/Assets/software/foo-hover.gif`       |
| `glb`           | public path       | `/Assets/models/knight.glb`            |
| `gallery[]`     | public paths      | `/Assets/software/shot-1.png`          |

Adding work = drop the file under the right `public/Assets/` subfolder and point
the frontmatter field at its `/Assets/…` path. No import, no pipeline step.

## Hover GIFs (`hoverGif`)

A short looping clip that fades in over the card's `cover` still on hover
(`src/lib/motion/hover-gif.ts`). It's only fetched once a pointer enters the grid,
so it doesn't cost anything at page load, but keep it small: aim for ~5–8 s and
under ~3 MB.

- **Frame:** the software card media is a fixed **16:9** cover-fit box. Encode at
  16:9 and the whole frame shows: the GIF layer skips the cover's 1.06× hover
  zoom, so HUD at the frame edges stays intact. If the source isn't 16:9, crop it
  to 16:9 yourself around the action rather than letting `object-fit` decide.
- **Cover:** make the project's `cover` the GIF's **first frame** (exported from
  the source video at the same `-ss`, full resolution, as `.webp`). Hover then
  hands off from the still to the clip without a visible seam, which is why
  hover-GIF covers skip the 1.06× zoom as well.
- **Size:** 960 px wide covers a ~600 CSS-px tile on 2× displays.
- **Recipe:** 15 fps, one global palette, **no dithering**. Flat game UI
  compresses far better without dithering and looks the same. `tpad` holds the
  last frame for a beat so the loop doesn't snap straight back to the start:

```bash
ffmpeg -ss <start> -t <duration> -i in.mp4 -an -vf "fps=15,scale=960:-2:flags=lanczos,tpad=stop_mode=clone:stop_duration=0.5,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" foo-hover.gif
```
