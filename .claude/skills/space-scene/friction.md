# Friction with the scene's instructions

The open entries, newest last. `CLAUDE.md`, "Friction with the scene's instructions is written down", says
when an agent writes one; the change that fixes the instruction deletes it. An entry:

```
## <DD.MM.YYYY HH:MM МСК> <the task in a few words>
- Instruction: <the file and section, or the tool, with its words quoted>
- Cost: <the step it took: the prediction the tracer contradicted, the extra tracer, the code read>
- Missing: <the sentence or fact that would have saved the step>
```

## 27.11.2026 09:55 МСК twelve agents, one chapter each of films/fourth_dimension_pop.json
- Instruction: `space_guide`, "A film as a script": "at(12.5, () => { ... }) a function played from a second already past or still to come", and of `to`: "time moves on 5 s".
- Cost: seven of the twelve wrote a caption or a shape after a `to()` inside an `at()` callback or at the top of a shot, and it came late by the length of the move (2.4 to 10 s); one preview each to find it in the printed timeline, and one clip failed with "draw() takes seconds, 0 or more".
- Missing: "Inside `at` and `shot` a `to` moves that function's own second on, so what is written after it starts when the move ends: put a move that should run beside the rest in `meanwhile`."

## 27.11.2026 09:55 МСК twelve agents, one chapter each of films/fourth_dimension_pop.json
- Instruction: references/films.md, section 7: "a set of films goes through each step in one call: `check a.js b.js c.js`, `preview a.js a.jpg - b.js b.jpg -`", and space.mjs's header: "Several check, preview or render jobs may follow one another on one line".
- Cost: four agents joined two commands on one line (`preview ... - still ...`, `still a.jpg 22 still b.jpg 38.2`) and got `ENOENT ... open '...\still'` or the usage line, a failed call each.
- Missing: "One line holds one command word and its groups of arguments repeated; two commands, or two stills, are two calls."

## 27.11.2026 09:55 МСК twelve agents, one chapter each of films/fourth_dimension_pop.json
- Instruction: `CLAUDE.md`, "Checks take turns across the machine": "a preview's output is read unfiltered, so its `waiting for ...` is seen".
- Cost: no agent saw the line though calls stood up to 222 s before their turn, and three took a 2 to 4 minute call for a hang or could not say why it was long. space.mjs gives no progress token, so the server's `waiting` text (`report?.` in `mcp/space_mcp.mjs`) goes nowhere.
- Missing: the line itself on space.mjs's output, or the sentence "through space.mjs a wait prints nothing: a call that is slow is waiting for its turn".

## 27.11.2026 09:55 МСК twelve agents, one chapter each of films/fourth_dimension_pop.json
- Instruction: `describe` of `blackHoleSize`: "0 = none".
- Cost: "gravity before there is a hole" was set as size 0 and nothing fell: one preview, then a hole of size 1 with its lens and ring off.
- Missing: "The pull and its reach are in black hole radii, so at size 0 there is no gravity either."

## 27.11.2026 09:55 МСК twelve agents, one chapter each of films/fourth_dimension_pop.json
- Instruction: `space_guide`, graphics: "values (keyframes, as a caption's)" and `draw`: "a function of its seconds".
- Cost: two agents gave a shape's `values` in film seconds and the shape stood still or moved at the wrong time; one preview each.
- Missing: "The seconds of a shape's or a caption's `values` are counted from its own start in a script, not from the film's."

## 27.11.2026 09:55 МСК twelve agents, one chapter each of films/fourth_dimension_pop.json
- Instruction: SKILL.md, "vectors": "at `baseSpeed` 0 only what gravity moves is lit".
- Cost: a quiet field moved only by a far hole's pull drew almost nothing until `speedGlowKnee` went down to 0.02; one preview.
- Missing: "What gravity moves slowly stays dark at the default `speedGlowKnee`: lower it for a slow fall."

## 27.11.2026 09:55 МСК twelve agents, one chapter each of films/fourth_dimension_pop.json
- Instruction: the timeline a preview prints, for a `set` made in the middle of a clip: "0-17.57 s gridRings: 0 > 40".
- Cost: read as a ramp from second 0; the storyboard showed one step at 17.57 s.
- Missing: a step printed as a step: "17.57 s gridRings: 40".
