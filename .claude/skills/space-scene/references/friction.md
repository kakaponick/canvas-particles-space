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

## The tools and the machine

### Reading a contact sheet's tiles as one frame (2026-11-27)
- Wanted / got: compare two stills stacked side by side; read the right tile's coordinates as the whole
  picture's and "saw" the camera jump.
- Now: measure inside a tile, or render single stills (`space.mjs still`) when positions matter.

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
