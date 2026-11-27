# Films

One folder per film. The folder's name is the film's name: it names the film's file, its renders, its
narration and its address on the page (`?film=<name>`). `node scripts/films.mjs list` shows them all;
`node scripts/films.mjs check`, part of `pnpm lint`, holds the layout below.

```
films/
  <film>/
    meta.json          what the film is and who made it (below)
    <film>.js|.json    the film itself: a script or its JSON, a reel, or a fractal film
    clips/             a reel's clips, numbered in the reel's order (01_down.js)
    voices/            the reel paced by another voice (scripts/voice.mjs writes them: ru.json)
    posters/           the posters: stills made by films of their own (poster.js)
    voice.mjs          the narration's maker (the film-voice skill); its lines in another language beside it
    brief.md           the task the film was made from, word for word: what every take is given
    takes/<take>/      another attempt at the brief: a meta.json and its own file, the folder's shape
    out/               renders: mp4, wav, posters' jpg; out of git
    ...                pictures and data the film reads (earth.png, letters/)
  voice/               the narration's takes, shared by every film; out of git
  out/                 renders no film claims; out of git
  _lab_<name>.js       a scratch film (the live page's), out of git
```

A film's file names its parts by their path from the repository's root, as the film server reads them:
`"film": "films/fourth_dimension_pop/clips/01_down.js"`, `"src": "films/fourth_dimension/earth.png"`.

## meta.json

```json
{
  "title": "Around a spinning hole",
  "about": "Over a spinning hole from pole to pole, the ring's bright side following the spin.",
  "kind": "film",
  "film": "kerr_around.js",
  "made": [
    { "model": "claude-opus-5-5", "agent": "Claude Code", "at": "2026-11-25", "did": "wrote the film" }
  ]
}
```

- `title`, `about`: a name and one line, which the page's library shows.
- `kind`: `film`, `reel` (a film with `clips`) or `fractal` (a zoom into the Mandelbrot set); the check reads
  the film's file and holds that the two agree.
- `film`: the film's own file in the folder.
- `made`: who made the film, one line per sitting of work, the newest last; never rewritten. `model` is the
  model's id in lower case (`claude-opus-5-5`, `unknown` when it is not known), `at` the day (Moscow), `did`
  what was done in a line, `agent` the harness. An agent that makes or changes a film adds its line in the
  same commit: `node scripts/films.mjs made <film> --model <id> --agent "<harness>" --did "<what>"`. The
  lines with `"from": "git"` were read from the `Co-Authored-By` lines of the commits that made the film
  before there was a `meta.json`, one per model, with the count of its commits and its first and last day.
- `brief`: the brief's file, when the film has one.
- `scores`: kept for the scores of an eval; nothing writes it yet.

A take's `meta.json` has the same keys without `title` and `about`, which are the film's.

## Takes, evals and benchmarks

The folder is laid out for comparing attempts at one film. The film's `brief.md` is the task, word for word;
each attempt is a take (`node scripts/films.mjs new <film> --take <take> --model <id> --did "<what>"`), its
own file in `takes/<take>/` and its own record of who made it. A take is a film like any other: the page's
library lists it under its film, the film server and `space.mjs` take its path, and `bench.mjs films` draws
it. The scores an eval gives a take go into that take's `meta.json` as `scores`, in a shape the eval will
set.
