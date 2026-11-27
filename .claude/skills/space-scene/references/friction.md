# Friction log: where the scene, its tools and its instructions fought an agent

Each entry is time some agent already lost and nothing else yet prevents. One is due, before the report, when
the scene, a knob, a tool or the machine forced a detour; when the instructions (the `space-scene` skill and
its `references/`, `space_guide`, `describe`, the `space` server's text) cost a step: a prediction the tracer
contradicted, a missing gate or trap, two sources that disagree, a fact found only in the code; or when the
operator sends back a defect you could have caught. An entry, newest first within its section:

```
### <what you were trying to do, in a few words> (YYYY-MM-DD)
- Wanted / got: what you meant, and what the picture, the tool or the instruction gave instead.
- Cause: why, once known; for an instruction, its file and section with the words that misled.
- Now: the habit that avoids it, or what is still missing (the knob, the code, the sentence that would have
  saved the step), so the next agent can build it.
- Where: the files, knobs or commands; the film and second if the operator found it.
```

Once the missing piece exists (a knob, a fix in code, a sentence in `knobs.md`, `films.md`, the guide or
`describe`), the change that adds it deletes the entry. A recipe that works goes beside its knob, not here.

## Telling the film

### Galaxies drawn as shaded ovals (2026-11-27)
- Wanted / got: galaxies drifting apart on a growing sheet; ovals with a fill shaded to dark at the edge read
  as cheap stickers (the operator's note).
- Now: draw a galaxy as its stars: two logarithmic arms of scattered points round a dense warm core (round
  ellipticals as a Gaussian ball), each point a circle at the galaxy's place with `shift`, so all ride one
  pair of values; the unresolved light as five nested faint level ovals, never one shaded fill. A circle lying
  on the tipped sheet is a level oval whatever the galaxy's own turn. Still missing: a scene object for a
  galaxy, so the film need not draw some 300 shapes for each.
- Where: `galaxyOf` in `films/fourth_dimension_pop_10_more.js`.

### A galaxy laid on a black hole's well (2026-11-27)
- Wanted / got: a spinning galaxy on the sheet; got the operator's "what are these crooked settings?": the
  disc a solid record at 9000 particles, its core a lit ball at the bottom of a narrow throat, hanging under
  the galaxy, and the size-8 hole's black shadow sticking out above and below the core like a saucer.
- Cause: the sheet's dent is a black hole's throat at any depth, and the core was laid on the hole, which
  sits at the throat's bottom; a shadow of 1 radius is taller than a flattened core.
- Now: a galaxy sits in a shallow dish: the hole small (size 3) and its well widened as many times (Well
  Width), depth 1.2 of the old radii; the core a soft oval in the disc's plane wider and taller than the
  shadow; seen from 76 degrees, so a mass under the sheet hangs clear below the disc instead of projecting
  onto its near edge; the disc's count swept at the framing (2500). Still missing: a body that dents the
  sheet into a dish with no hole in it.
- Where: the third picture of `films/fourth_dimension_pop_10_more.js`.

### Matching a reference by the reviewer's notes, not by the reference (2026-11-27)
- Wanted / got: the infographic's funnel as the reference draws it; the film-review agent called the well
  too flat, then too narrow, then sagging, and each fix followed the last note. The operator sent the well
  back as hanging far below the star.
- Cause: a reviewer judging tiles of 768 px drifts from round to round, and the brief left the look to its
  notes; nothing compared a still with the reference side by side.
- Now: put a still and the reference side by side and fix what differs; take a reviewer's note on looks
  only when it moves the still toward the reference. What is missing is a review step that shows the
  reviewer the reference beside each tile.
- Where: `films/infographic_style.js`, the well (`gridDepth`, `gridLift`).

## The scene

### Rings at equal steps along the well's surface (2026-11-27)
- Wanted / got: two cells of one well, a wide one and a thin one, the same length along the surface; the
  scene's rings are contour lines (equal steps of depth) or, with Ring Spacing, equal radii, and between two
  contour lines a cell is as long as the depth step where the wall is steep and longer everywhere else, so no
  wide and thin cell is ever equal, and no Ring Spacing between the two gives equal surface steps.
- Now: the film rules its own rings as shapes on `{ sheet }` points, one every equal step along the surface
  (a walked table of radius against surface length), leaves the scene's spokes on with Sheet Rings 1 and
  tunes the step so one ring lies on that one ring. Still missing: a Ring Spacing that lays the rings at
  equal steps along the surface, which would also clear them round the shadow as the scene's lines are.
- Where: "cells" in `films/fourth_dimension_pop_06_above.js` (`RINGS`, `WALK`).

### Hiding the hole took every place on the scene to its middle (2026-11-27)
- Wanted / got: galaxies on a flat sheet with the hole hidden (`hide('hole')`); every `{ hole }` and
  `{ sheet }` place, and every radius given in hole radii, collapsed to the frame's middle: no galaxies, the
  labels piled on one point.
- Cause: places on the scene are measured in the shadow's radius as it is drawn, and a hidden shadow has none.
- Now: keep the hole and make it a speck (Black Hole Size 1) under something drawn over it, and give the
  places in the speck's radii. Still missing: places that keep their unit while the hole is hidden, or a
  note in the guide.
- Where: the second picture of `films/fourth_dimension_pop_10_more.js` (`SPECK`, `SCALE`).

### A body that fades in or out over a hole showed the hole through it (2026-11-27)
- Wanted / got: the textbook's ball coming up with the picture and going with it; got a see-through ball with
  the hole's black shadow and the throat's crowded rings inside it at every fade (pop film clips 5 to 8), and
  at the openings the chapter's title lying over the ball.
- Cause: a shape's `opacity` dims its fill too, and shapes lie over the fade, so a half-lit ball shows what
  is under it at full strength.
- Now: lay an opaque black disc of the body's size under it for the body's whole life (same centre and
  values) and ramp only the body. At an opening, the chapter kit fades the picture in under the title, so
  the black disc showed alone on the lit sheet for 0.7 s, a bare black hole (review 5), whatever the ball's
  ramp: hold the whole frame black under the captions with a black rect (`size` [1.9, 1.05], its opacity
  1 until the title is gone at 2.4 s, then 0 over 0.6 s) and ramp the ball over the same 0.6 s. Still
  missing: a word of the chapter kit for "the picture comes up after the title", so no clip needs a rect.
- Where: the ball's draws at the head of `films/fourth_dimension_pop_06_above.js` to `_08_ripple.js`, and at
  "mass" in `_05_sheet.js`.

### A pair's ripple not seen until the merger (2026-11-27)
- Wanted / got: crests running out over the sheet from a circling pair; got a flat-looking sheet until the
  merger, and raising `gridWaveLift` folded the throats into bright needles beside the pair (pop film 5:02).
- Cause: the spiral wave grows as 1 over the pair's distance and its crests lengthen with a slow orbit, so 6
  radii apart it is long and low; it is strongest at the pair's middle, where the steep wells fold first.
- Now: knobs.md, the pair's waves, "Crests seen while the pair still circles far apart": a faster orbit and
  coarser cells, not more lift, make the crests read. Four rounds of review went to lift and clearing alone.
- Still missing: a lift that falls off near the wells (a knob). At lift 3.5 a few pinched lines still
  converge beside the pair's middle; any lift that raises the far crests more folds them into a crease.
- Where: `PAIR`, `WAVES` in `films/fourth_dimension_pop_08_ripple.js`.

## The tools and the machine

### A screen call piped into tail (2026-11-27)
- Wanted / got: stills drawn after the operator's screen showed the clip; `screen.mjs live ... | tail -1 &&
  space.mjs still ...` drew them although the screen had refused ("is behind master"), since the pipe's exit
  is tail's.
- Now: never pipe `screen.mjs live`; chain it bare with `&&`, or read its line before drawing.

### A clip that computes too long to have its lines read (2026-11-27)
- Wanted / got: the reel's lines read by `linesOfReel`; got "could not be read for its lines: Script execution
  timed out after 5000ms" for a clip whose script integrated the well's surface anew inside a bisection.
- Cause: `scripts/voice.mjs` runs each clip in a sandbox with 5 s to play; `space.mjs check` has no such
  limit, so the clip checked clean.
- Now: build a table once and look values up; time a clip's script with `linesOfReel` after adding sums to it.
- Where: `films/fourth_dimension_pop_06_above.js` (`WALK`), `linesOfReel` in `scripts/voice.mjs`.

### A shape's width cannot follow a value (2026-11-27)
- Wanted / got: a body that thins as it stretches; "width takes a number, got 'w'".
- Now: a thick stroke whose `opacity` follows the value over a thin one. Still missing: `width` as a value.
- Where: the falling body in `films/fourth_dimension_pop_10_more.js`.

### A bench whose before refuses the new knob (2026-11-27)
- Wanted / got: `bench.mjs page --against HEAD --set` with the new `gridFrontPhotons` in it, to price the
  photons; the HEAD build answered `set: refused: Unknown key` and was measured on the default scene while
  this checkout drew the photons' scene, two scenes timed against each other, and the run went on.
- Cause: `--set` goes to both builds whole; a key the before does not have makes it refuse the lot, and the
  script prints the refusal and measures anyway.
- Now: measure the change's scene without the new key against HEAD (the cost of the knob at 0), then this
  checkout alone with it (`bench.mjs page --set ...` without `--against`) and read its frame rate. What is
  missing is a bench that stops on a refused set, or sends the before only the keys it knows.
- Where: `scripts/bench.mjs` (`window.space.set` in `page`), the photons' change (light-photons).

### Reading a contact sheet's tiles as one frame (2026-11-27)
- Wanted / got: compare two stills stacked side by side; read the right tile's coordinates as the whole
  picture's and "saw" the camera jump. A reviewer reported a blocker in the pop film's clips 6 to 8: "<" and
  ">" kinks belonging to no spoke or ring at x 0.22 and 0.78 of the frame. No single frame has them.
- Cause: the tiles of a preview and of `review.mjs` sheets touch with no gap, so the spokes and long lines
  of one frame meet those of the frame above, below or beside it at the shared edge and read as one zigzag.
- Now: measure inside a tile, or render single stills (`space.mjs still`) when positions matter; a line that
  bends exactly on a tile's edge is two frames. Still missing: a dark gutter between the tiles of a preview
  sheet, which would end this misreading for reviewers too.

### Delegating a task with its own worktree (2026-11-27)
- A delegated task with worktree isolation fails when the parent thread's folder is not a git checkout:
  delegate to the project with shared isolation and have the child make its own worktree.
