# Friction log: where the scene and its tools fought an agent

Read this before a film or a change to the scene: each entry is time some agent already lost. Add an entry
when the scene, a knob, a tool or the machine made you take a detour, or when the operator sent back a defect
you could have caught (the rule is in `CLAUDE.md`, "Working here"). One entry per friction, newest first
within its section:

```
### <what you were trying to do, in a few words>
- Wanted / got: what you meant, and what the picture or the tool did instead.
- Cause: why, once known.
- Now: the fix, the knob or the habit that avoids it; or what is still missing, so the next agent can build it.
- Where: the files, knobs or commands; the film and second if the operator found it.
```

When an entry's "now" becomes code or a rule elsewhere, shorten the entry to a pointer there; delete it when
the friction cannot happen any more.

## Shapes and captions over the scene

### A ruler or an arrow that lies on the curved sheet (2026-11-27)
- Wanted / got: a ruler down the well's wall; got a straight frame line floating over the curved sheet, and
  after a camera move it no longer lay on anything. The operator: "the ruler is not tied to the grid".
- Cause: shapes and captions had only frame, hole and companion places, all flat on the screen.
- Now: `{ sheet: [x, y] }` places lie on the surface (the main well's radii, x right, y away from the flat
  camera) and follow tilt, zoom and the 3D camera; `{ between: [place, place], share }` moves a shape from the
  scene to the frame (a ruler lifted off and laid straight). Tie a ruler to the grid itself: on a spoke
  (every 360 / `gridSpokes` degrees), its marks on the rings (films.md section 14 gives the contour ring
  radius). `films/fourth_dimension_pop_10_test.js` is the worked example.
- Where: `sheetPoint` in `src/lib/space_grid.ts`, `placeOnFrame` in `src/lib/film_captions.ts`.

### Light that "climbs the wall and falls back" drawn as zigzags (2026-11-27)
- Wanted / got: rays rising from a star and falling back; got frame-space triangles round the star (5:48 of
  the pop film), "strange lines".
- Cause: the same frame places, over a well seen from the side.
- Now: smooth paths of `{ sheet }` points on the near wall (angle about -90 faces the camera), radius rising
  and falling along the path. Any shape that explains something in the scene rides it.
- Where: `films/fourth_dimension_pop_09_object.js`, shot "dark".

### Saying the physics exactly (2026-11-27)
- Wanted / got: "the ruler's pieces are equal"; the operator: the pieces are not equal, the space in them is.
- Now: pieces deep in a well are shorter on the surface and hold the same amount of space: draw unequal
  lengths with the same count of dots in each. Check a claim's wording against the physics before drawing it.

## The camera

### Every camera move looked stiff (2026-11-27)
- Wanted / got: a camera that moves like an operator's; got moves that each started and stopped dead, one
  axis at a time, and held shots frozen still. The operator asked twice (GRS 1915's film, then the pop film).
- Cause: a film's default ease was a smooth step from rest to rest, per key and per move, with a jolt of
  acceleration at both ends, and nothing moved the camera between moves. The first fix was a hand-written
  spline in one film (`films/grs1915.js`), which no other film got.
- Now: the engine does it by default. Camera keys glide (no jolt, consecutive moves flow through the key
  between them), `cameraFloat` sways a held camera, `cameraBank` leans it into swings. Write a path as
  back-to-back `to()` calls and overlap axes (films.md section 4).

### "Fly the camera to the grid" done with a zoom (2026-11-27)
- Wanted / got: the camera approaching the well; `cameraZoom` gave a magnified picture with nothing moving,
  and the operator asked for a real camera.
- Cause: the flat mode has no camera move but `gridTilt`; a zoom is a longer lens, not an approach.
- Now: put the clip in 3D (`threeD`, `threeDEase` 0, `cameraYaw` 0, `cameraPitch` about -62 looks like the
  flat mode's `gridTilt` 62) and fly with `cameraMoveIn`, `cameraPitch` and `cameraLookPitch` (radii of the
  hole; 15 in at pitch -42 with the head up 12 framed the well's far wall). The review checklist calls a keyed
  `cameraZoom` approach a defect.

## Particles

### The field vanished once the clip went 3D (2026-11-27)
- Wanted / got: space falling into the Earth's well down every spoke, as in the flat mode; got an almost
  empty sheet.
- Cause: in 3D gravity ends at the sphere of Gravity Reach and at `baseSpeed` 0 the warm-up drains the field,
  with nothing refilling it.
- Now: the matter on the well is a flow laid on the sheet: `flowA` 1.6, `flowACount` 9000, `flowAFrom` 8,
  `flowATo` 1, `flowASpread` 6, `flowALife` 8, `flowASwirl` 0.1, `flowATrail` 0.6, `flowASize` 1.2, and dim
  it (`flowA` 0.6) while something is read on the wall. Set `flowAColor`: the default is orange.

### A uniform white line or tube down the throat (2026-11-27)
- Wanted / got: matter fading down the well's wall; got a hard white tube and lines (3:01, 3:38).
- Cause: every particle equally bright, stamped brighter-of-two, with long strokes where the throat is steep.
- Now: each particle its own light and width (`particleLightSpread`, `particleSizeSpread`), redshift near a
  hole (`gravityRedshift`), and a stroke the sheet stretches keeps its own light (`gridRideStretch` 1).

### A ring of particles at the horizon (2026-11-27)
- Wanted / got: an even field; got a bright ring at 1–1.5 radii.
- Cause: particles born again on the horizon's rim when nowhere else was free.
- Now: rebirth spreads evenly over the frame (`rebirth` in `field_step.ts`). A ring no law puts there is an
  artefact; look for where particles are born.

### A cloud under the Earth instead of matter on the sheet (2026-11-27)
- Wanted / got: matter lying on the well; got a cloud floating in front of it.
- Cause: `gridRideDepth` is in hole radii, so a small hole (size 4) had a thin slab; at the default
  `gridRideSoft` gathered matter hangs between its flight and the surface.
- Now: `gridRideDepth` 400 and `gridRideSoft` 0.01 for a small hole.

## Bodies over a hole

### A black hole showing round or before a planet (2026-11-27)
- Wanted / got: the Earth; got a bare black disc before its picture came up, a dark crescent round it after a
  fly-in, and the hole's black disc left when the picture faded.
- Cause: the hole under the picture is drawn from the first frame and its shadow is wider than the photo's
  disc from some angles.
- Now: draw the body's picture from the chapter card's last second (`at(1.6, ...)`) and keep it as long as
  the hole is there; widen it or shrink `blackHoleSize` if a rim of shadow shows; turn off what the body
  could not have: `gravityRedshift` 0, `gridThroatGlow` 0, `gridLight` 0 (the Earth's well is a billionth of
  a black hole's; the throat glow also washes out white marks on the wall).

### The flat mode's traced lens drew a black band (2026-11-27)
- Wanted / got: a hole arriving; got a black band across the field (2:21 of the pop film).
- Cause: the flat mode's Ray Traced lens shows the field as if it lay behind the hole.
- Now: bring such a hole in 3D with a traced disc (`flowTrace`).

## The grid

### Equal-radius rings made the sheet unreadable (2026-11-27)
- Wanted / got: cells of the flat sheet to show stretching; `gridRingSpacing` 1 at 72 rings filled the frame
  with fine rings, and the operator preferred the contour rings.
- Now: keep contour rings (`gridRingSpacing` 0): each ring is the same step down the well, which is the step
  along W, and that is what a ruler on the wall reads.

## Review

### Defects the operator found that a look would have caught (2026-11-27)
- Wanted / got: a finished film; got a stream of corrections by timestamp (2:21, 3:01, 3:38, 5:48, 6:18).
- Cause: previews only at seconds chosen in advance; nobody looked at all of it.
- Now: the review gate (SKILL.md, "A film", step 6). A preview of 11 frames takes about 2.4 s, so the whole
  film as contact sheets costs minutes. Stills cannot show motion or flicker: watch a shot whose point is
  motion.

### Reading a contact sheet's tiles as one frame (2026-11-27)
- Wanted / got: compare two stills stacked side by side; read the right tile's coordinates as the whole
  picture's and "saw" the camera jump.
- Now: measure inside a tile, or render single stills (`space.mjs still`) when positions matter.

## Narration

### A longer clip under an old mix (2026-11-27)
- Now: a change to a clip's timing moves the marks; mix again (`node films/<film>_voice.mjs mix [voice]`,
  seconds, no machine) before rendering. The `film-voice` skill has the rest.

## The machine and the tools

### Text with backslashes or CRLF edited through the shell (2026-11-27)
- Wanted / got: a quick node or sed replacement; got halved backslashes (`/^\d+$/` lost its slash, template
  strings broke) and replacements that matched nothing in CRLF files.
- Now: edit with the Edit tool; a script that matches multi-line text normalizes `\r\n` first.

### Master moved while the work was being checked (2026-11-27)
- Wanted / got: fast-forward master; got "not possible to fast-forward" twice, other sessions having
  committed meanwhile, and a background render reading files the merge was changing.
- Now: rebase the branch on master right before the merge, build again, and render only from a checkout
  nothing is merging into.

### Subagents (2026-11-27)
- Review agents return findings as text and do not write files: the coordinator saves them.
- A delegated task with worktree isolation fails when the parent thread's folder is not a git checkout:
  delegate to the project with shared isolation and have the child make its own worktree.

### Runpod (2026-11-27)
- Pods are created through REST v2 at `api.runpod.io/v2/pods` with `image`, `cloud`, `gpu`, `disk`, `ports`,
  `env`, `cmd`; a 400 "no longer any instances" means no stock: try the next card. One failed create inside
  `Promise.all` once left a pod running: use `allSettled` and delete in `finally`. `scripts/drama3_pod.mjs`
  does all of it.
