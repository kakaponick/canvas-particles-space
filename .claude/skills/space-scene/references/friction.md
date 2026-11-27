# Friction log: where the scene, its tools and its instructions fought an agent

Each entry is time some agent already lost and nothing else yet prevents. `CLAUDE.md`, "Working here", says
when to write one. An entry, newest first within its section:

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
### A script read for pictures and never for what it says (2026-11-27)
- Wanted / got: a narration where every line carries the argument; the operator found stock lines one by one
  ("And that is where it gets weird", "Here is the uncomfortable part", "Only one survives"), a line pointing
  back at a tesseract chapter 3 no longer had, and chapter 8 offering gravitational waves as following from
  the hypothesis's "stretch" though general relativity predicted them in 1916.
- Cause: three review rounds read the frames and the cues; nobody read the lines as text, and a rewritten
  chapter left references to it in later chapters.
- Now: before a film's voice is recorded, read the whole script as text once. Each line answers what it adds
  to the argument; a line any film could say goes; a known result is never offered as support for the
  hypothesis; after a chapter is rewritten, search the later chapters for what it used to show.

### An experiment that sounded like science fiction (2026-11-27)
- Wanted / got: the test of the hypothesis; got "a wire many kilometres long, wound into a coil" and a
  spinning spiral: the operator heard an unbuildable machine and saw a cheap animation.
- Cause: the script reached for the longest ruler instead of the instrument labs already build.
- Now: say the real instrument and draw it plainly: two mirrors on a block a few centimetres apart (an
  optical cavity), round trips of light counted in an atomic clock's second, the same count on Earth and on
  a satellite. Before writing an experiment, ask whether a lab has one on a bench today, and name it so.
- Where: clip 10 of the pop film, `films/fourth_dimension_pop_10_test.js`.

### Light drawn by an analogy while the scene already traces light (2026-11-27)
- Wanted / got: the Shapiro delay as a flash spreading over the sheet; got `gridFront` (d2f4d03), whose
  rays are straight lines on the flat sheet, whose delay is the length of the dent's surface (a picture, not
  the delay: in general relativity it comes from the curved space and the slowed time together) and whose
  "capture" radius was picked by eye, so a dark wedge behind the hole never closes. The operator asked why
  the scene's own physics of light was not used.
- Cause: the brief and the engine work started from the textbook sheet; nobody asked what the scene
  already knows about light. The lens traces real light rays (`kerr_trace.ts`), and the shadow's radius is
  the critical impact parameter, 3√3/2 horizon radii; the particles, on the other hand, follow the field's
  own laws (Gravity Reach, the orbital force, Inertia in `field_step.ts`), not light's.
- Now: a look that shows light takes light's laws from the start: an index n(ρ) = (1 + r_s/4ρ)³/(1 − r_s/4ρ)
  for arrival times (the eikonal, branch light-eikonal), photons on null geodesics for the light itself,
  the scale fixed by the shadow. Ask what the scene already computes before drawing a picture of physics.
  Still missing: a particle law for photons; the arrival-time field of the sheet's flash.
- Where: `gridFront…` (simulation_specs.ts, webgl_shaders.ts `flashAt`), the pop film's chapter 5.

### Saying the physics exactly (2026-11-27)
- Wanted / got: "the ruler's pieces are equal"; the operator: the pieces are not equal, the space in them is.
- Now: pieces deep in a well are shorter on the surface and hold the same amount of space: draw unequal
  lengths with the same count of dots in each. Check a claim's wording against the physics before drawing it.

## The film script

### A rewritten line still timed by its old take (2026-11-27)
- Wanted / got: "predicted by Einstein · 1916" after "a ripple of space"; with the reel's input the ripple
  caption came at 4.45 s, the old take's "ripple" near its end, and the 1916 caption, at its word-count share,
  came before it.
- Cause: a reel's `input` keeps the cues of the take it was spoken from until the line is voiced again, so a
  rewritten line's old cue words, where they survive, land at their old seconds.
- Now: where two captions must keep an order, key the second to `Math.max(its word, the first + a beat)`;
  voice a rewritten line before judging its timing.
- Where: shot "small" of `films/fourth_dimension_pop_08_ripple.js`.

## The scene

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

### A textbook ball hanging under the sheet's throat (2026-11-27)
- Wanted / got: a mass sitting in a dent; got a ball of 1.05 radii at `{ hole: [0, 0] }` under the tip of a
  narrow funnel, a ball on a stalk (pop film 2:55 to 4:04). A shallower `gridDepth` did not help.
- Cause: the sheet's dent is a black hole's well, standing vertical at the shadow's edge (1 radius) at any
  depth, and there is no knob for a wider bowl: a ball as wide as the shadow always ends the throat.
- Now: a ball wider than the throat, lifted into the well so it still covers the shadow (lift + 1 below its
  radius): radius 1.9 at `{ hole: [0, 0.8] }` on depth 4 at tilt 68 lies in the bowl with the walls round its
  upper half; at depth 8 the throat stood over it like a stalk again, and at tilt 66 from depth 3 the neck
  shows from 4.6 on (4.3 still holds). Seen from straight above, slide the lift to 0 while the camera rises.
  A ball over a hole hides the throat's crowded rings inside its radius.
- Where: `BALL`, `LIFT` in `films/fourth_dimension_pop_05_sheet.js` to `_08_ripple.js`.

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

### Master moved three times under one task (2026-11-27)
- Wanted / got: a still of a changed clip after putting it on the screen; got "is behind master: rebase it
  first" from `screen.mjs live` three times in one task, and each rebase of a branch that carries friction
  entries stopped on a conflict in this file, since master was rewriting its sections meanwhile.
- Cause: the screen refuses a branch behind master (live_page.md, "On the operator's screen"), and other
  sessions merge into master every half hour or so; a branch of several commits replays each one.
- Now: stash, `git rebase master`, then `git stash pop`, then `pnpm build` when `src/` moved, before each
  `screen.mjs live`; chain the stills after the screen with `&&`, never `;`, or they render (and tempt a
  look) while the screen still shows the last clip. Keep a conflict in this file by both sides' entries,
  dropping those master closed.
- Where: `scripts/screen.mjs`; the pop film's fixer branch `review3-05-08`.

### Reading a contact sheet's tiles as one frame (2026-11-27)
- Wanted / got: compare two stills stacked side by side; read the right tile's coordinates as the whole
  picture's and "saw" the camera jump. A reviewer reported a blocker in the pop film's clips 6 to 8: "<" and
  ">" kinks belonging to no spoke or ring at x 0.22 and 0.78 of the frame. No single frame has them.
- Cause: the tiles of a preview and of `review.mjs` sheets touch with no gap, so the spokes and long lines
  of one frame meet those of the frame above, below or beside it at the shared edge and read as one zigzag.
- Now: measure inside a tile, or render single stills (`space.mjs still`) when positions matter; a line that
  bends exactly on a tile's edge is two frames. Still missing: a dark gutter between the tiles of a preview
  sheet, which would end this misreading for reviewers too.

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
