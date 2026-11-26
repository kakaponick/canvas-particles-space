# The poster: a YouTube thumbnail planned with the film

On YouTube the thumbnail is a banner looked at for less than a second, before the film and most often instead
of it: it carries one idea and raises a question the film answers. With the title it decides who clicks, and
by what it promises, who stays; YouTube weighs both. So a film made to be published is planned from its poster:
the picture first, then the film that keeps its promise. The poster and the title are one package (the
`youtube-seo` skill writes the title and the description; this file is the picture).

1. **The idea before the timeline.** One sentence: why a viewer clicks, what the poster shows, the moment of
   the film it comes from, and its words, e.g. "the ring lit from below, the hole a third of the frame, words:
   ONE SECOND TO FALL". Intrigue, not a spoiler: an unusual object, a before and after, the moment just before
   something happens; the answer itself stays in the film. The picture shows the what and the title the why,
   or the other way round, each adding to the other. The film reaches that moment in its first seconds where
   it can, in its first third at the latest, in the poster's mood: a poster the film does not keep gets the
   click and loses the viewer.
2. **Look at the niche first.** Open the poster of the top results for the film's main phrases (`videos.csv`
   of `scripts/yt_keywords.mjs` holds their ids; a poster is `https://i.ytimg.com/vi/<id>/hqdefault.jpg`) and
   make what is missing there: another colour, another closeness, another composition.
3. **One focus, at most three elements** on the whole poster: the subject, the background, and at most the
   words or one arrow. Designed for the size it is seen at, 160 to 360 px wide on a phone:
   - the subject (the hole, the ring, the two holes of a merger) a third of the frame or more, set off from a
     plain background by its silhouette, by light, a glow round it;
   - a clear order: the eye lands on the subject first, then on the words; the rule of thirds, or the subject
     on one half and the words on the other;
   - two or three colours, one of them the accent, in a contrasting pair (blue and orange, black and yellow),
     saturation and local contrast a little higher than the film's own. Take the accent from any colour but
     red, which competes with YouTube's own. Let the sky, a nebula or the stars reach the edges: a pure black
     or pure white edge loses the poster's border in the dark or the light theme.
4. **Few words, or none.** Three to five words at most, adding context or an emotion to the title rather than
   repeating it; a number reads faster than a word. In the viewers' language, as one caption in a heavy plain
   face (`unbounded`, which holds Cyrillic, or `orbitron`), its line 1/8 to 1/6 of the frame's height (`size`
   0.125 to 0.17), light on dark with a `plate` where the picture behind is busy, one key word or number in
   the accent colour (`*{word}`). A word that does not read small is cut, not shrunk. A poster whose picture
   says it alone takes no words: make one take without them.
5. **The places it is shown.** Keep the bottom right corner (the length) and the bottom edge (the red bar of
   what was watched) free of anything that matters: leave a margin. The middle holds the point: a vertical
   crop of a 16:9 poster shows only the middle. The channel logo stays off it.
6. **Make it a film of its own, at 4K.** A poster is `films/<name>_poster.js` (or `.json`) beside the film:
   `"size": "4k"` (3840x2160, what YouTube now asks for; 1280x720 is the least a Test & Compare take may be),
   `"intro": false`, the film's `seed`, the settings of the moment it shows (in a script, the same function that
   makes that shot), a `warmup` long enough for the trails, a second or two of `duration`, the words as its
   caption. The poster is the moment staged again, still and lit for it: a frame of the film is often smeared
   by motion and weak in light. A vertical film (a Short) gets a vertical poster of its own, 2160x3840
   (`"width": 2160, "height": 3840`), staged for that frame.
7. **Two or three takes that differ in their idea**, not in a shade: with words and without, the subject close
   and the whole scene, another colour scheme. Each take is a file of its own (`<name>_poster.js`,
   `<name>_poster2.js`). They go to Test & Compare in YouTube Studio on the desktop (up to three; Shorts have
   none), which picks by the share of watch time, not by clicks.
8. **Draw each as a still**, one frame as the render makes it, with no label; several go in one call:
   `node .claude/skills/space-scene/scripts/space.mjs still films/<name>_poster.js films/<name>_poster.jpg 1.5`
   (through the server: `space_preview` with `still` and `out`). Then the shrink test: the same still at 168 px
   wide, the size of a phone's feed,
   `still films/<name>_poster.js out/<name>_poster_small.jpg 1.5 168`. At that size it must be clear what
   happens, and squinting at it must leave one bright patch, the subject. What does not pass is simplified.
9. **The checklist, then the user chooses.** Show the takes side by side with the titles they were made for,
   say which one you would publish and why; the user picks.

- [ ] One idea, said in one sentence
- [ ] The poster and the title complete each other
- [ ] One subject, at most three elements
- [ ] Three to five words at most, heavy, in contrast, one accent
- [ ] Reads at 168 px wide (`still ... 168`), and the squint leaves the subject
- [ ] Bottom right corner and bottom edge free of anything that matters
- [ ] Edges in the sky's colours, the accent a colour other than red
- [ ] The film keeps the promise, in its first seconds where it can
- [ ] 3840x2160 (a Short: 2160x3840), JPG, under 50 MB
- [ ] Two or three takes for Test & Compare
- [ ] Everything on it ours or licensed, and within the community guidelines

Report the poster with the film: the path of the chosen jpg and of the others, its words, the second of the
film it promises, and the titles it stands beside.

To publish, the jpg goes through `postiz upload` (images up to 10 MB) and its `id` and `path` become the
post's `thumbnail` (the `postiz` skill). YouTube takes a custom thumbnail only from a verified channel, as a JPG
or PNG under 50 MB, with a daily limit of uploads ("Daily custom thumbnail limit reached": wait 24 hours). The
API Postiz sets it through may still hold the old 2 MB limit; if the thumbnail is refused, the 4K jpg goes in by
hand in YouTube Studio.

After it is out, the poster is read with retention, against the channel's own other films rather than a norm
from the internet: a high CTR with viewers leaving early means the poster promised more than the film gives; a
low CTR with viewers who stay means the film is good and its poster does not sell it. A film with good
retention and a weak CTR is the one to give a new poster. Keep a table of the tests (film, what was tested,
which take won): after ten or fifteen it shows what this channel's viewers click.

Rules: [YouTube Help, custom thumbnails](https://support.google.com/youtube/answer/72431?hl=en),
[Test & Compare](https://support.google.com/youtube/answer/13861714).
