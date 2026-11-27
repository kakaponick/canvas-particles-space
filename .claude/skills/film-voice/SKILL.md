---
name: film-voice
description: Narration of a space-scene film or reel — its voice script, VoiceStudio or Fish Audio Drama 3 on a rented Runpod machine, delivery tags before each line by the claim it makes, verifying the words heard, mixing the takes at the clips' marks. Read before speaking, re-speaking or re-mixing any film's lines, before renting a machine for them, and when a clip's timing changes under a narration.
---

# The narration of a film

A film's lines live in its clips: each clip's `LINES`, `say('name')` where a line starts, `status('kind')` for
the claim it makes. The narration is made outside the page by `scripts/voice.mjs`, which a film's own
`films/<film>_voice.mjs` calls (`voiceFilm`); `films/fourth_dimension_pop_voice.mjs` is the full example: a
reel's lines read from its clips (`linesOfReel`), four voices, the delivery by status, a built "wow" moment.

Work from the main checkout, not a worktree: the takes and the voices' recordings are in `films/voice/`, out
of git. A take is named by what made it (profile or sample, seed, engine, its fields, the text the model was
given), so only a changed line is spoken again, and a voice tried once costs nothing to hear again.

## The jobs

| Job | Command | Needs |
|---|---|---|
| Speak the lines not yet spoken; write each line's length and cue seconds into the reel as the clips' `input` | `node films/<film>_voice.mjs [speak] [voice]` | the voice's engine (below) |
| Write every take down and show where the words heard differ from the line | `node films/<film>_voice.mjs verify [voice]` | VoiceStudio (its recognizer) |
| Lay the takes at the seconds the clips mark: `films/<film>[_voice].wav` | `node films/<film>_voice.mjs mix [voice]` | nothing but the takes |

The first voice of `VOICES` is the film's own: its reel is `films/<film>.json`. Another voice writes a copy of
the reel paced by its own takes, `films/<film>_<voice>.json`, and its own wav; render that reel with that wav.

**Mix again after every change of a clip's timing** (a shot made longer, a pause, a line moved): the marks move
and the old wav no longer lies under the picture. Mixing needs no machine and takes seconds. Then render.

## Which engine

- **VoiceStudio on this machine** (`engine` without `servers`): OmniVoice and the engines VoiceStudio holds.
  Read the `voicestudio-api` skill first. One client at a time: check the dub server is idle
  (`GET http://127.0.0.1:8765/status` with the header `X-Dub-Client: 1`) before working it, and never change
  its shared settings or create profiles: a voice script only reads profiles.
- **Fish Audio Drama 3 on a rented machine** (`engine: 'drama3'` with `servers`): the best delivery we have,
  and it follows bracketed tags. It needs about 25 GB of a card per server, more than this machine has, so it
  runs on Runpod and the machine lives only while the lines are spoken. Its licence is non-commercial: say so
  before a film is published for money.

## Drama 3 on Runpod

Read the global `runpod-rent` skill before the first rent of a session: the key, the money, the rules.
**Every rent waits for the operator's yes in the current turn**: run `--dry`, then ask with the lines to be
spoken, the voices and the expected minutes and dollars, and rent only after the answer. A yes covers that one
run, not the next re-speak.

```
RUNPOD_KEY_FILE=<the operator's key file> node scripts/drama3_pod.mjs <film> [voice] [--set <DRAMA3_SET>] [--dry]
```

It rents one pod of `scripts/drama3_server.sh` (an A100 80 GB, or the next card in stock: the prebuilt server
does not run on Blackwell), waits for its servers, runs the speak job on them, and deletes the pod whatever
happened, then prints the minutes and the dollars. `--dry` runs the voice script with no server: it lists what
is not spoken yet and rents nothing; run it first. The key file is read inside the process and never printed.

- Default servers: two `Q4_K_S:cuda_perf` on one card. They spoke the 60 lines of `fourth_dimension_pop` in
  3 min 22 s of work; a whole voice of that film cost about $0.5 (November 2026). Start-up is the model's
  download, several minutes.
- The machine serves its stages, its card and its servers' logs on port 8082 (`/stages.txt`, `/gpu.txt`,
  `/smi.txt`), since an API key may not read a pod's log.
- If the run stops with an error, check the account has no pod left (`GET /v2/pods`): a pod bills by the second.
- A pod of other servers (a smaller package, the perf mode off) is `--set`; `scripts/drama3_bench.mjs` compares
  them, and its last results are in `films/voice/bench/` with a page per voice to listen.

## Delivery: the tag before the line

Drama 3 reads bracketed directions in the text, `[plain and matter-of-fact]`, at the start of a line or
anywhere inside it. A voice's `say(name, text)` returns what the model is given; the words heard are checked
against the line without its tags.

1. **Tag each line by the claim it makes**, as its clip labels it on the screen (`statusOf` in
   `fourth_dimension_pop_voice.mjs` reads the labels from the clips):

   | Label | Tag |
   |---|---|
   | KNOWN PHYSICS (`known`) | `[plain and matter-of-fact]` |
   | GEOMETRY (`math`) | `[clear and patient]` |
   | HYPOTHESIS (`idea`) | `[leaning in, a little excited]` |
   | OPEN QUESTION (`open`) | `[quieter, thoughtful, leaving it open]` |

   In the benchmark this was the one setting the operator singled out: it works very well. A line with no
   label (a question, a thought experiment) goes untagged.
2. **Build the key moment.** The film's "wow" (in `fourth_dimension_pop`, the red lines pointing inward) is
   written line by line as a build, tags inside the lines: slowing, a pause, the reveal hushed. Write two or
   three builds (`WOW` a, b, c), speak them all, and let the operator pick by ear; every build must say the
   line's own words (the script checks it).
3. **Settings:** `options: { top_p: 0.97 }` (the operator found it far better than 0.8), seed 7, the voice's
   whole recording as the sample. A take that says the wrong words gets another seed for that line
   (`seeds: { line: 11 }`), not a rewritten line.

## A new voice or language

- A VoiceStudio profile is cloned by its recording and its words (`profile`). A recording kept in the
  repository's `films/voice/` is a `sample: { audio, text }`, its text word for word what is said: Drama 3 is
  given those words, and a profile whose words are wrong (half in another alphabet) clones badly.
- Another language: its lines in a module beside the film (`films/fourth_dimension_pop_ru.mjs`), its cues as
  `'word|слово'` in the order the line says them, and `language` for the recognizer. The picture keeps its
  English captions unless they are translated in the clips.

## What to report

The voice and engine, the lines spoken and re-spoken, what verify found and what was done about it, the wav
and the reel it paces, and for a rented machine its minutes and dollars and that it was deleted.
