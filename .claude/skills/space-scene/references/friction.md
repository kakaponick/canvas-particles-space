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

### An experiment that sounded like science fiction (2026-11-27)
- Wanted / got: the test of the hypothesis; got "a wire many kilometres long, wound into a coil" and a
  spinning spiral: the operator heard an unbuildable machine and saw a cheap animation.
- Cause: the script reached for the longest ruler instead of the instrument labs already build.
- Now: say the real instrument and draw it plainly: two mirrors on a block a few centimetres apart (an
  optical cavity), round trips of light counted in an atomic clock's second, the same count on Earth and on
  a satellite. Before writing an experiment, ask whether a lab has one on a bench today, and name it so.
- Where: clip 10 of the pop film, `films/fourth_dimension_pop_10_test.js`.

### Saying the physics exactly (2026-11-27)
- Wanted / got: "the ruler's pieces are equal"; the operator: the pieces are not equal, the space in them is.
- Now: pieces deep in a well are shorter on the surface and hold the same amount of space: draw unequal
  lengths with the same count of dots in each. Check a claim's wording against the physics before drawing it.

## The film script

### A move inside `at()` or `shot()` pushed what came after it late (2026-11-27)
- Wanted / got: a caption or a shape at a second inside a shot; seven of twelve agents on the pop film got
  it late by the length of a `to()` written before it (2.4 to 10 s), and one clip failed with "draw() takes
  seconds, 0 or more". A re-voiced line later broke a shot that had checked clean: three `to()`s in one
  `at()` ran one after another, the last ending 6.3 s in, and a move keyed to a spoken word met it once the
  word came sooner ("two moves of one value cannot overlap").
- Cause: `space_guide`, "A film as a script", says of `at` only "a function played from a second already
  past or still to come", and of `to` "time moves on 5 s"; that the second moves inside the function too is
  left to the reader.
- Now: values that move together go in one `to()`; a move beside the rest goes in `meanwhile`; a move keyed
  to a word starts no sooner than the end of the moves before it (`Math.max(word, start + their seconds)`).
  Check every voice's lines file after a re-voice. Missing in the guide: "Inside `at` and `shot` a `to`
  moves that function's own second on, so what is written after it starts when the move ends."
- Where: `src/lib/film_script.ts` (the guide's text); shot "ruler" of `films/fourth_dimension_pop_10_test.js`.

### A shape's `values` given in film seconds (2026-11-27)
- Wanted / got: a shape moving at a second of the film; two agents got it standing still or moving at the
  wrong time, a preview each.
- Cause: `space_guide`, graphics: "values (keyframes, as a caption's)" and `draw`: "a function of its
  seconds".
- Now, missing in the guide: "The seconds of a shape's or a caption's `values` are counted from its own
  start in a script, not from the film's."

### A step in the middle of a clip printed as a ramp (2026-11-27)
- Wanted / got: a `set` at 17.57 s; the timeline printed "0-17.57 s gridRings: 0 > 40", read as a ramp
  from second 0, while the storyboard showed one step at 17.57 s.
- Now, missing in the timeline: a step printed as a step, "17.57 s gridRings: 40".

### Gravity before there is a hole (2026-11-27)
- Wanted / got: matter pulled before the hole shows; at `blackHoleSize` 0 nothing fell.
- Cause: `describe` of `blackHoleSize` says "0 removes the black hole", not that the pull goes with it.
- Now: a hole of size 1 with its lens and ring off. Missing in the spec: "The pull and its reach are in
  black hole radii, so at size 0 there is no gravity either."

## The tools and the machine

### Two commands on one line of `space.mjs` (2026-11-27)
- Wanted / got: several jobs in one call; four agents joined two commands (`preview ... - still ...`,
  `still a.jpg 22 still b.jpg 38.2`) and got `ENOENT ... open '...\still'` or the usage line.
- Cause: `films.md`, section 7: "a set of films goes through each step in one call", and the script's
  header: "Several check, preview or render jobs may follow one another on one line".
- Now, missing in both: "One line holds one command word and its groups of arguments repeated; two
  commands, or two stills, are two calls."

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
