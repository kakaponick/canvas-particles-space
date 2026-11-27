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

### A small device drawn at its place on the scene (2026-11-27)
- Wanted / got: a light clock standing on the Earth; drawn in the hole's radii it came out 40 px tall once
  the 3D camera pulled back, the mirrors and the light unreadable.
- Cause: a scene place is the right home for what explains the scene, not for an apparatus the eye must
  read.
- Now: draw the apparatus large on the frame's empty side and give it a dashed lead and a dot to its
  place. A thin lead in a pale colour disappears over a lit field: lead and dot in the accent colour, width
  about 0.0024. Probe where a `{ sheet }` point lands with a few labelled dots in a throwaway still before
  aiming a lead at it: far out on the flat the projection is not where a flat guess puts it.
- Where: `clockBody`, `clockLead`, `inset` in `films/fourth_dimension_pop_10_test.js`, shots "mirrors" and
  "count".

### An experiment that sounded like science fiction (2026-11-27)
- Wanted / got: the test of the hypothesis; got "a wire many kilometres long, wound into a coil" and a
  spinning spiral: the operator heard an unbuildable machine and saw a cheap animation.
- Cause: the script reached for the longest ruler instead of the instrument labs already build.
- Now: say the real instrument and draw it plainly: two mirrors on a block a few centimetres apart (an
  optical cavity), round trips of light counted in an atomic clock's second, the same count on Earth and on
  a satellite. Before writing an experiment, ask whether a lab has one on a bench today, and name it so.
- Where: clip 10 of the pop film, `films/fourth_dimension_pop_10_test.js`.

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

### A violet nebula and lilac particles in every clip (2026-11-27)
- Wanted / got: a sky that serves the film; got nebula `#6a2cc0` with a pink core `#ff7ab8` in ten films and a
  third of the particles lilac. The operator: "violet and lilac are AI slop's favourite colours", and the
  nebula's dust muddied the Earth's frames.
- Cause: the scene's nebula is off by default and its default colours are teal and blue; agents picked violet
  themselves and the block travelled from clip to clip.
- Now: films.md section 1 says where colours come from and starts the sky at stars on black. The pop film's
  clips 1, 2, 3, 5, 6 and 12 dropped the nebula; clips 2 and 3 keep their field white and pale blue, 12000
  particles with shorter trails, so the axes and figures read over it.
- Where: films.md section 1; `films/fourth_dimension_pop_02_ladder.js`.

### Matter falling in from every side in 3D (2026-11-27)
- Wanted / got: matter falling into the hole from all round; the field with `baseSpeed` 0.25 to refill it
  drew parallel streaks across the whole frame as the camera turned, rain with nothing falling in.
- Cause: the drift moves every particle the same way, and a turning camera streaks the field's trails.
- Now: three flows tipped 0, 60 and 120 degrees, each `Thick` 0.5 with `Bell` 1, `Swirl` 0, falling from 5.5
  radii (`Spread` 3) to 0.9, field off: a ball of strokes all pointing at the hole, lines of the scene that a
  turn does not smear. A flow's band matters as much as its count: from 9 or 10 radii wide 6 or 7 the near
  matter carpets the flat or streaks the frame like a starburst at any count; narrow the band to the part
  of the frame the shot is about first, then sweep the count.
- Where: `FALL` in `films/fourth_dimension_pop_07_creature.js`, `WHIRL` in `fourth_dimension_pop_08_ripple.js`.

### One recipe's particle count copied into every clip (2026-11-27)
- Wanted / got: a count fitted to each shot; got `numParticles` 20000 with the same size, brightness and
  opacity in four clips of the pop film framed differently, and 10000 with `flowACount` 9000 in two more.
- Cause: films.md gave 20000 as the setup's value (found at one framing) and SKILL.md called a neighbour
  film's settings a tested start, so the number travelled unchanged; nothing asked for it to be measured.
- Now: films.md, "On the sheet", and SKILL.md step 1 ask for counts, sizes and brightness found at the
  shot's own framing; the reviewers flag a well burned white or bare and shots framed apart with one count.
  Still missing: the field on the sheet (films.md, "On the sheet") draws still dots on the flat at every
  count up to 200000 and nothing on the wall, so its recipe needs mending; flows on the sheet work and
  their count sweeps on a track, a second a step.
- Where: films.md section 16, `.claude/agents/film-review.md` defect 3.

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

### Hiding the hole under a body took the well with it (2026-11-27)
- Wanted / got: chapter 06 of the pop film opening on chapter 05's mass ball, the bare hole hidden; with
  `hide('hole')` the sheet lay flat, square at any `gridRings`, and the ball at `{ hole: [0, 0] }` was gone.
- Cause: a hidden hole is no hole for the scene: the sheet's dent and rings and every `{ hole }` place go too.
- Now: leave the hole shown and cover its shadow with the body's picture (radius 1.05 covers it from above
  and from the side at tilt 68); `hide('ring')` alone keeps the ring from edging the picture.
- Where: `films/fourth_dimension_pop_06_above.js`, the mass drawn before shot "flyup".

### A small black hole behind a board of text (2026-11-27)
- Wanted / got: a quiet black hole beside the words of the pop film's clip 11; got a thin white ring like a UI
  icon over film-grain fuzz: 24000 field particles at `baseSpeed` 0 lit only as noise.
- Cause: the field's light is its speed, and slow matter far from a small hole draws nothing that reads.
- Now: one flow falling in and winding (`flowA` 1.8, From 7, To 0.8, Spread 4, Swirl 0.8, the field off), its
  count swept at the framing: 3000 read as a spiral round the shadow, 5000 and up a disc that pulls the eye.
  A ring flow (From equal to To) beside it drew a solid band, a tube: leave it out.
- Where: `films/fourth_dimension_pop_11_known.js`.

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

### A light front on the sheet that read white, and a "view from above" that was edge on (2026-11-27)
- Wanted / got: a warm band of light sweeping the sheet, seen in 3D from above; the default warm white
  `gridFrontColor` added to the blue lines came out white at every `gridFront`, and the brief's
  `cameraPitch` -89 drew the sheet edge on.
- Cause: the band adds to the line's colour, so a pale warm colour over cyan fills all three channels. In 3D
  `cameraPitch` 0 faces the sheet and -89 is the textbook's cut (knobs.md section 11 says so; the brief had
  it the other way round).
- Now: knobs.md, the sheet, `gridFront`: #ffa040 at 1.2 over `gridSheet` 0.35 reads warm; from straight
  above is 3D `cameraPitch` 0 or the flat mode's `gridTilt` 0. On 60 contour rings the band lights only
  short pieces far out: square cells show its whole shape.
- Where: the tracers in the light-front commit's message.

### The lattice as a blurred cross, and a turn that showed nothing (2026-11-27)
- Wanted / got: the 3D lattice arriving as the clip turns 3D; got a thick blurred "+" through the hole at
  the change, and a camera yaw from 34 to 70 degrees whose first and last frames looked alike.
- Cause: the cross is the lattice seen down the line of flight while `threeDEase` eases the camera in (its
  rows pile up there), not the lens opening: setting `lensingRadius` and `gridLatticeWarp` at once did not
  remove it. A cube of cells is its own mirror image across yaw 45, so a yaw through 45 reads as no change.
- Now: keep `gridLattice` at 0 until about 1.9 s into a 2.6 s ease, then bring it up. Turn on one side of 45
  and carry the move in pitch and a small `cameraMoveIn` too, with the near half drawn (`gridLatticeNear`
  below 1, `threeDFrontDepth` above 0) and the far half dimmed (`gridLatticeFar` 0.25): the near cells slide
  past the far ones.
- Where: shots "us" and "chair" of `films/fourth_dimension_pop_07_creature.js`.

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

### A re-voiced line broke a shot that checked clean before (2026-11-27)
- Wanted / got: a new take of the ruler line; got "two moves of one value cannot overlap" at the mix.
- Cause: `to()` moves time as `wait()` does, so three `to()`s in one `at()` run one after another and the
  last ended 6.3 s into the shot; a later move keyed to a spoken word met it once the word came sooner.
- Now: values that move together go in one `to()`; a move keyed to a word starts no sooner than the end of
  the moves before it (`Math.max(word, start + their seconds)`). Check every voice's lines file after a
  re-voice, not only the one you work with.
- Where: shot "ruler" of `films/fourth_dimension_pop_10_test.js`.

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

### A narration that ran the reel past 600 s (2026-11-27)
- Wanted / got: the Russian and en2 reels rendered; got "the reel is 613 s long; 600 s is the most".
- Now: render the reel in two halves (a copy of the reel JSON with the first and the last clips, run from the
  repo root so its `films/...` paths resolve), then join them with `~/.space-film/ffmpeg.exe -f concat` and
  lay the whole narration over (`-map 0:v -map 1:a -c:v copy`). ffmpeg is a Windows program: the list file
  names `C:/...` paths, never Git Bash's `/c/...`.

### Removing a worktree with linked node_modules (2026-11-27)
- Wanted / got: `git worktree remove`; got a hook blocking the walk through `node_modules` junctions that
  point into the main checkout, and a half-removed folder once.
- Now: unlink the junctions first, from PowerShell: `cmd /c rmdir <worktree>\node_modules` (and any nested
  `node_modules` junction), then `git worktree remove --force <worktree>`. `rmdir` on a junction removes
  the link, not the main checkout's packages.

### Subagents (2026-11-27)
- Review agents return findings as text and do not write files: the coordinator saves them.
- A delegated task with worktree isolation fails when the parent thread's folder is not a git checkout:
  delegate to the project with shared isolation and have the child make its own worktree.

### Runpod (2026-11-27)
- Pods are created through REST v2 at `api.runpod.io/v2/pods` with `image`, `cloud`, `gpu`, `disk`, `ports`,
  `env`, `cmd`; a 400 "no longer any instances" means no stock: try the next card. One failed create inside
  `Promise.all` once left a pod running: use `allSettled` and delete in `finally`. `scripts/drama3_pod.mjs`
  does all of it.
