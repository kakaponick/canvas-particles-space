# A reel: several films in one video

A JSON object with `clips`; the same tools take it wherever they take a film, and its keys are in
`space_guide`. `films/reel.json` is one.

- Reach for a reel when one film cannot be it: another setup of the scene that should start fresh (a cut,
  with its own seed and warm-up), another kind of picture (the fall into the fractal), or a film that
  exists and is worth a stretch of (`"film": "films/horizon.js"` with `from` and `to`). What one scene can
  do by tracks stays one film: a reel's clips share nothing but the frame.
- Make and check each clip alone first. In a reel it draws the frames it draws alone, so what is left to
  judge is the joins.
- `from` is paid for: a scene only plays forward, so the seconds before it are stepped unseen. A clip cut
  from near the end of a long film costs nearly the whole film.
- A cut wants a change the eye can name (closer, another subject, another colour). Through black is the
  safe join between two pictures that have nothing in common, and a pause the narration can use. A
  dissolve wants two pictures that rhyme: a round shadow into a round bulb of the fractal, one grid into
  another. It holds two scenes at once for its seconds; `oneScene` plays every dissolve through black
  when the machine is short of memory.
- A clip's captions and shapes are its own and end with it. Words that run over a join go on both clips,
  with the same place and size.
- The frame and the rate are the reel's: a clip written for another frame is drawn in the reel's, so place
  each clip's captions for the reel's frame.
- A reel is at most 900 s.
- A reel's `input` keeps the cues of the take each line was spoken from until the line is voiced again, so a
  rewritten line's surviving cue words land at their old seconds. Voice a rewritten line before judging its
  timing; where two captions must keep an order, key the second to `Math.max(its word, the first + a beat)`.
