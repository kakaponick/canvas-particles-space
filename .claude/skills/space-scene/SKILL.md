---
name: space-scene
description: The black-hole particle scene of this repository from outside its UI - the map from a physical effect to its knobs, the tracer still that tests a look, films through the space MCP server, window.space on the live page. Use whenever a task sets up, changes, screenshots or explains the scene, picks values for a physical effect, makes, previews or renders a film or video ("ролик", "видео", "покажи", "настрой сцену"), or only describes a picture or a motion it wants to see; also before adding or renaming a setting, an intro parameter, a layer or a preset.
---

# The space scene, for agents

The scene runs on real laws: gravity pulls, the horizon captures, light bends round the hole, stars orbit,
two holes spiral and send out waves. Every effect asked for is one of those laws, and every law has its
knobs: numbers, switches, colours and choices in two registries, the simulation settings and the parameters
of the opening. A picture is made by a loop: find the law, say what it will change in the frame, test that
with one cheap still, and compare.

## Words

These words carry the rest of this skill, of `references/` and of the guides.

- **tracer**: the cheap test of a prediction: one still of a 720p film with the effect alone switched on,
  or a sweep of one knob. Its recipe is below.
- **gate**: the knob or knobs without which a law's effect does not show (a lens needs something behind it,
  a ring needs matter falling in, a particle that does not move draws no stroke). Each law's section of
  knobs.md opens with its `Gate:` line.
- **said / grown**: a said look is drawn from the knobs at once: the lens, the shadow, the photon ring's own
  glow, the grids, the flows, the horizon grid, the camera; it takes `"warmup": 0`. A grown look needs the
  field to fill: trails, capture, rings that inertia closes, a ring fed by infall, a long exposure; it takes
  a warm-up of seconds. `warmup` applies only to a film with `"intro": false`.
- **vectors**: the particles are the vectors of every shot: each stroke points where its particle goes, so
  whatever a shot says moves (matter, light, space itself) is shown by them. A particle's brightness is its
  own speed across the screen: at `baseSpeed` 0 only what gravity moves is lit, a particle that stands
  still draws nothing, and a camera that moves streaks the trails without lighting them.
- **radii**: black hole radii, the unit of every length round the hole (CLAUDE.md); knobs.md, "The unit
  everything is measured in", converts them to Schwarzschild radii.
- **the real thing** (**1×**): a knob whose 1 is nature's value; its description says so. knobs.md,
  "Nature and its stand-ins", tells the laws at nature's values from the ones a stand-in draws.

## The loop

1. **Wish -> law.** A request says "make the hole heavier", "show how light bends", "let two of them
   merge". Find the law in [references/knobs.md](references/knobs.md), which is organised by what happens
   physically. Look in `films/` for a film that already shows the law (films.md, "Films to start from"):
   its settings are a tested start for the law, not for the amounts. A count, a size or a brightness
   (`numParticles`, a flow's Count, `particleSize`, `baseBrightness`) was right for that film's framing
   only, as a number in a recipe was right for its tracer's: sweep it again at the shot's own framing (the
   sweep below) and write down where each amount came from. A preset is a law's starting point too:
   `describe` with the preset's name lists what it sets. Done when you can name the section, its gate and
   the knobs that take part.
2. **Ranges.** Read each range and meaning from `describe` with a word from that section (`space_describe`
   for films, `window.space.describe('lens')` on the page) when you set it.
3. **Prediction.** Write one sentence: what the particles will do (fall, orbit, swirl, stream, ride the
   sheet, stand dark) and what else changes, which way, and where to look: the shadow's edge, the Einstein
   ring, the strokes round the hole, the sheet's well. Done when the sentence names the particles' motion
   and a place in the frame. In a film the shot's job comes with it, from the idea (below): what the viewer
   learns or feels there, and the frame's one subject.
4. **Tracer.** First put it on the operator's screen ([references/live_page.md](references/live_page.md), "On the
   operator's screen"): the operator sees a simulation before you do. Then draw the one still (or sweep) that tests the sentence, its `warmup` by the look: 0 if said, seconds if grown.
5. **Compare.** Done when the tracer shows the predicted change where it was predicted. When it shows
   nothing, the law's gate is shut: open it and draw the tracer again. When it shows a change elsewhere or of
   another kind, the prediction misread the law: read the section's traps and predict again. A value that
   `set`, a check or a render moved into range is a value you got wrong: read the line that says so.

A task's effect is finished when its last tracer (or the film's preview at that second) shows every
predicted change in its place.

### The tracer

A look of the particle field is grown (a flow's is said). "Matter circles the hole" predicts a bright ring of streaks round the
shadow, with the streaks farther out swinging into it:

```json
{ "duration": 2, "size": "720p", "intro": false, "warmup": 8,
  "settings": { "gravityInertia": 0.92, "orbitalStrength": 90, "gravityStrength": 5, "gravityReach": 8,
                "baseSpeed": 1, "trailIntensity": 0.08 } }
```

- `"intro": false`: the opening otherwise fills the first six seconds with the star and its explosion.
- `"warmup"`: seconds for a grown look, the time the field needs to fill (up to 10; 8 gathers a ring); 0
  for a said one. A said tracer, the lens made visible: `"warmup": 0, "settings": { "gridSky": 0.5,
  "lensingRadius": 3 }`.
- `settings`: the law's knobs and its gate, the rest at the page's defaults: the flat scene with every
  other layer off, `fieldEnabled` on. A particle look keeps the particles moving (a flight, or gravity
  that moves them), since what stands still draws nothing.
- Draw it as one still at second 1: `space_preview` with `"at": [1], "still": true`, or
  `space.mjs still tracer.json out/tracer.jpg 1`. 720p judges the shape; a dim look (a slow fall, the far
  field) is judged for brightness in a still at the film's own size, since thin strokes thin further in a
  contact sheet.

### The sweep

A sweep is the tracer for how a knob feels: when the request leaves a value to taste (how strong, how wide,
how fast), run one before choosing. A picture that is wrong is not swept: read one still, name the cause,
change the one knob it names and draw again; sweep only a knob whose law gives no prediction. The knob steps over 3 to 5 values on a track with `hold`, and one
preview shows a frame at the end of each step. Inertia, the share of the speed gravity gives that a
particle keeps, swept over the ring above:

```json
{ "duration": 15, "size": "720p", "intro": false, "warmup": 8,
  "settings": { "orbitalStrength": 90, "gravityStrength": 5, "gravityReach": 8, "baseSpeed": 1,
                "trailIntensity": 0.08 },
  "tracks": { "gravityInertia": [[0, 0], [5, 0.5, "hold"], [10, 0.9, "hold"]] } }
```

`space_preview` with `"at": [4.9, 9.9, 14.9]`: streaks flying outward that curl only near the hole at 0, a
loose swirl at 0.5, a closed bright ring at 0.9. Start from 0 or the default, so the first frame is the picture without
the effect. A grown knob steps every 5 seconds, since the field regrows after each step and the warm-up
runs only before the first; a said knob steps every second (`lensingRadius` over 0, 1.5, 3, 4.5, 6 at
`gridSky` 0.5 widens the bent circle of the grid step by step). Choose the value whose frame shows the
shot's sentence.

## A film

A film is one description: frame and length, a seed, starting settings and a timeline on which any number,
switch or colour moves along keyframes, layers switch, the opening's events fire again, the scene's time
slows or stops, and shapes and captions lie over the picture. It plays in a scene of its own from the
page's defaults, and the same film draws the same frames every time it is rendered on this machine. A film of a few things is a JSON
object; anything longer is a script that plays it forward. Several films joined into one video are a reel
(`clips`).

1. **The idea, before any knob**: five lines at the head of the film's file, the one image the viewer
   keeps, the question the film opens, the turn, the climax, the ending; then each shot's job, its one
   subject and how its pace differs from its neighbours'. films.md, section 1, gives the devices this scene
   has. Done when one sentence says what the viewer leaves with and which shot turns it.
2. Read `space_guide` once: the format, the script language, reels and recipes.
3. Run the loop for every effect the idea asks for. Its tracers' settings become the film's; a film in
   `films/` gives tested settings for a law, never the shape of yours.
4. Write the film: a project film is a folder of `films/` with its `meta.json` (`node scripts/films.mjs new`;
   films.md, section 7, says how, and that your model's id goes into it), a throwaway goes to a temp folder.
   Before a film longer than one shot read [references/films.md](references/films.md): cut it into shots, and give the particles of
   each shot a look (its section "The particle field: a look for every shot").
5. `space_preview` with no seconds draws one frame of every shot (the storyboard) and prints the timeline
   the film was understood as; ask for the seconds where something changes as well. Done when every shot's
   frame shows its sentence with the captions covered, the frames in order show the turn and the climax
   without a word, and the preview prints no `Crowded:` line (words on
   words, or a shape's stroke through words, measured on the frames it drew). `space_check` reads the timeline without drawing:
   for a script's JSON, or a film too long to draw yet.
6. `space_render` writes the mp4 once, at the default quality.
7. **A review, on the operator's word.** The film is reported after the render; reviewers who did not make
   it look at all of it only when the operator asks for a review:
   - `node .claude/skills/space-scene/scripts/review.mjs sheets <film or reel>` draws the whole film as
     contact sheets (a frame every 1.5 s and both ends of every shot) into
     `.claude/skills/space-scene-workspace/review/<film>/`, with `manifest.json` naming each frame's second
     in the video and the shapes fixed to the frame (the first suspects).
   - Launch the `film-review` agent on the manifest, one per three or four clips, in parallel. Give it the
     manifest's path and its clips, not your view of them.
   - Fix every blocker and major, draw the sheets of the changed clips again (`--clips`) and have them read
     again, then draw the whole film once more and record the verdict:
     `review.mjs verdict <film> pass "<what was found and fixed>"`.

Without a browser (a machine with no Chrome, or an operator who forbids it),
`node .claude/skills/space-scene/scripts/plan.mjs <film>` writes and plans a film in Node and prints what
a check prints but the frames: the errors, the values moved onto a slider, its length and parts.

Without the `space_*` tools the same commands run from anywhere in the repository:

```
node .claude/skills/space-scene/scripts/space.mjs guide
node .claude/skills/space-scene/scripts/space.mjs describe orbit
node .claude/skills/space-scene/scripts/space.mjs still out/tracer.json out/tracer.jpg 1
node .claude/skills/space-scene/scripts/space.mjs preview films/waltz/waltz.json out/waltz.jpg 4,12,29.5,31
node .claude/skills/space-scene/scripts/space.mjs check films/language/language.js
node .claude/skills/space-scene/scripts/space.mjs render films/waltz/waltz.json films/waltz/out/waltz.mp4 high
```

Several films go through one call; films.md, "Checking before rendering", says how. The server and the
script both serve `dist/`, the built page: after a change to `src/`, `pnpm build` first, or they draw the
old scene and reject keys the code already has. Films, scripts and docs are read as they are.

## Elsewhere

| The task | Where |
|---|---|
| A key's range, default, unit, figures, real-physics anchor | `describe` with a filter word |
| Which knobs belong to a law, how they act on each other, its gate and traps | [references/knobs.md](references/knobs.md), the section of the law |
| The craft of a film that reads: shots, the camera's moves, captions, timing, the particles on the sheet | [references/films.md](references/films.md) |
| A YouTube film: its poster, planned before the timeline | [references/poster.md](references/poster.md) |
| Several films joined into one video (a reel) | [references/reels.md](references/reels.md) |
| A film above 60 fps | [references/high_frame_rates.md](references/high_frame_rates.md) |
| A film's narration: voices, Drama 3 on Runpod, the tag before each line, mixing | the `film-voice` skill |
| A review of a whole film, when the operator asks for one | step 6 above, the `film-review` agent |
| Where the scene, its tools and its instructions already fought an agent, and what avoids it; where to log a new friction | [references/friction.md](references/friction.md) |
| The live page: `window.space` in a browser, screenshots, the user's own Chrome | [references/live_page.md](references/live_page.md) |
| A Mandelbrot (fractal) zoom: its own renderer, format and targets | `space_fractal_guide` (or `space.mjs fractal-guide`) |
| A new knob, or an effect no combination of knobs gives | `CLAUDE.md`, "Driving the scene as an agent"; `docs/films.md` for film code |

## What to report

What was set, and where the result is: the screenshot, the film's json and mp4 as paths, and for a YouTube
film its poster's jpg with its words. For a film the operator had reviewed, the verdict and what its reviewers found. Repeat anything the scene adjusted, name what was not looked at, and
name every gate that had to be opened: the next request will need it. After a code change, name the knobs
it added.
