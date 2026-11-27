// The fourth dimension as popular science, clip 11 of films/fourth_dimension_pop.json: what is known, what is a guess and what is open, and the century of tests any new idea has to match.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_11_known.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  straight: "Let's be straight about what is known here, and what is a guess.",
  facts: 'Known: a dimension is a direction. Gravity bends light and slows clocks. Black holes exist. Space ripples.',
  guess: 'A guess: that the dent in the textbook picture is real, and W is a true fourth direction.',
  unanswered: 'Open: whether matter really shrinks inside a well. Even the author of the hypothesis calls that an unanswered question.',
  century: 'And one more thing. General relativity has passed every test for over a hundred years. Any new idea has to match all of that first.'
}

// ---- the film's kit: the same text in every clip of films/fourth_dimension_pop.json ----
const lines = input.lines ?? {}
const cues = input.cues ?? {}
// The colours: the three directions of space, the fourth (W, and every word about it), the ink, a quieter
// ink for what stands beside it, and gold for what was measured
const X = '#ffb347'
const Y = '#5dff9b'
const Z = '#4da3ff'
const W = '#ff3b5c'
const INK = '#eef2ff'
const SOFT = '#aab6d8'
const GOLD = '#ffd27a'
// Until a voice has spoken a line it takes what its words would at 155 a minute
const long = name => lines[name] ?? +(LINES[name].split(/\s+/).length * 60 / 155).toFixed(1)
// Marks where a line starts, which is where the voice is laid, and tells its length
const say = name => { mark('say:' + name); return long(name) }
// The second of a line a word falls at: heard in the voice, or this share of the line until it is spoken
const heard = (name, word, share) => cues[name]?.[word] ?? +(long(name) * share).toFixed(2)
const until = second => wait(Math.max(0, second - now()))
// The chapter's card on black; the picture comes up under the last of it
const chapter = (number, name) => {
  set({ fade: 1 })
  caption(`*{${number}}`, 2.4, { at: [0.5, 0.43], size: 0.03, font: 'unbounded', accent: W, fade: 0.4 })
  caption(name, 2.4, { at: [0.5, 0.52], size: 0.052, font: 'unbounded', color: INK, fade: 0.4 })
  wait(1.6)
  to({ fade: 0 }, 1.2)
}
// What kind of claim is on the screen: measured physics, plain geometry, the hypothesis, or a question
// nobody has answered. A line that claims nothing about nature (a question, a thought experiment) has none
const STATUS = { known: ['KNOWN PHYSICS', GOLD], math: ['GEOMETRY', SOFT], idea: ['HYPOTHESIS', W], open: ['OPEN QUESTION', INK] }
const status = (kind, seconds) => caption(STATUS[kind][0], seconds, { at: [0.11, 0.94], size: 0.022, font: 'unbounded', color: STATUS[kind][1], fade: 0.4 })
// The one sentence of a shot a viewer should keep, at the foot of the frame
const keep = (text, seconds, more = {}) => caption(text, seconds, { at: [0.5, 0.86], size: 0.038, font: 'noto', accent: W, plate: 0.35, fade: 0.4, ...more })
// The clip leaves through black
const leave = () => { to({ fade: 1 }, 0.8) }
// ---- end of the kit ----

// The picture behind the words is quiet: a small black hole far off at the right, matter circling it slowly,
// lit only by the motion its pull and swirl give it, so the columns of text read over the dark
film({
  fps: 60,
  seed: 11,
  settings: {
    blackHoleSize: 2.2,
    blackHoleX: 0.88,
    blackHoleY: 0.55,
    numParticles: 24000,
    baseSpeed: 0,
    gravityStrength: 8,
    speedGlowKnee: 0.02,
    minOpacity: 0.3,
    // The pull reaches past the frame's far edge, so the field thins toward the left with no edge of its own
    gravityReach: 90,
    gravityInertia: 0.6,
    orbitalStrength: 80,
    trailIntensity: 0.15,
    baseBrightness: 1,
    starsBrightness: 0.8,
    starDensity: 0.15,
    gridSky: 0
  }
})
chapter('11', 'WHAT WE ACTUALLY KNOW')

// Three columns: what was measured, what is guessed, what is open
const COLUMNS = { known: 0.05, guess: 0.36, open: 0.64 }
const HEAD_Y = 0.16
const ROW = 0.1
// The seconds from now to the end of the given lines, each with its pause
const through = (...names) => names.reduce((sum, name) => sum + long(name) + 0.6, 0)
const heading = (text, column, color, seconds) =>
  caption(text, seconds, { at: [column, HEAD_Y], size: 0.034, font: 'unbounded', color, align: 'left', fade: 0.5 })
const item = (text, column, row, seconds, more = {}) =>
  caption(text, seconds, { at: [column, HEAD_Y + 0.1 + ROW * row], size: 0.032, font: 'noto', color: INK, align: 'left', reveal: 'lines', fade: 0.4, ...more })

shot('straight', () => {
  const spoken = say('straight')
  const start = now()
  const board = through('straight', 'facts', 'guess', 'unanswered')
  // Three empty headings, one after another
  at(start + heard('straight', 'known', 0.45), () => heading('KNOWN', COLUMNS.known, GOLD, board - (now() - start)))
  at(start + heard('straight', 'guess', 0.85), () => {
    heading('A GUESS', COLUMNS.guess, W, board - (now() - start))
    heading('OPEN', COLUMNS.open, INK, board - (now() - start))
  })
  wait(spoken + 0.6)
})

shot('facts', () => {
  const spoken = say('facts')
  const start = now()
  status('known', spoken + 0.3)
  const rest = through('facts', 'guess', 'unanswered')
  const facts = [
    ['dimension', 0.12, 'a dimension = a direction'],
    ['gravity', 0.36, 'gravity bends light,\nslows clocks'],
    ['black', 0.68, 'black holes exist'],
    ['ripples', 0.9, 'space ripples']
  ]
  facts.forEach(([word, share, text], index) => {
    const row = [0, 1, 2.3, 3.3][index]
    at(start + heard('facts', word, share), () => item(text, COLUMNS.known, row, rest - (now() - start), { accent: GOLD }))
  })
  wait(spoken + 0.6)
})

shot('guess', () => {
  const spoken = say('guess')
  const start = now()
  status('idea', spoken + 0.3)
  const rest = through('guess', 'unanswered')
  at(start + heard('guess', 'dent', 0.35), () => item('the dent is real', COLUMNS.guess, 0, rest - (now() - start)))
  at(start + heard('guess', 'W', 0.72), () => item('*{W} is a fourth\ndirection', COLUMNS.guess, 1, rest - (now() - start), { accent: W }))
  wait(spoken + 0.6)
})

shot('unanswered', () => {
  const spoken = say('unanswered')
  const start = now()
  status('open', spoken + 0.3)
  at(start + heard('unanswered', 'shrinks', 0.3), () => item('does matter shrink\nin a well?', COLUMNS.open, 0, spoken + 0.6 - (now() - start)))
  at(start + heard('unanswered', 'author', 0.6), () => caption('unanswered', spoken + 0.6 - (now() - start), { at: [COLUMNS.open, HEAD_Y + 0.1 + ROW * 1.6], size: 0.028, font: 'unbounded', color: SOFT, align: 'left', fade: 0.4 }))
  wait(spoken + 0.6)
})

shot('century', () => {
  const spoken = say('century')
  const start = now()
  const life = spoken + 0.8
  status('known', spoken + 0.3)
  // A time line from 1915 to today, a tick for each test general relativity passed
  const left = 0.07
  const right = 0.74
  const y = 0.48
  const place = year => left + (right - left) * (year - 1915) / (2026 - 1915)
  at(start + heard('century', 'General', 0.2), () => {
    const seconds = life - (now() - start)
    draw({ kind: 'line', points: [[left, y], [right, y]], arrow: 'end', color: SOFT, width: 0.0026, draw: 1.2, fade: 0.4 }, seconds)
    caption('1915', seconds, { at: [left, y + 0.06], size: 0.024, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('general relativity', seconds, { at: [left + 0.01, y + 0.11], size: 0.022, font: 'unbounded', color: SOFT, align: 'left', fade: 0.4 })
    caption('today', seconds, { at: [right + 0.035, y], size: 0.024, font: 'unbounded', color: INK, align: 'left', fade: 0.4 })
  })
  const tests = [
    [1919, 'bent starlight'],
    [1959, 'clocks'],
    [1974, 'binary pulsar'],
    [2015, 'waves'],
    [2019, 'a shadow']
  ]
  tests.forEach(([year, text], index) => {
    const x = place(year)
    // The last two are four years apart: their words stand above and below the line in turn
    const up = index % 2 === 0
    at(start + heard('century', 'test', 0.32 + 0.07 * index), () => {
      const seconds = life - (now() - start)
      draw({ kind: 'line', points: [[x, y - 0.025], [x, y + 0.025]], color: GOLD, width: 0.0034, fade: 0.3 }, seconds)
      caption(String(year), seconds, { at: [x, up ? y - 0.06 : y + 0.06], size: 0.026, font: 'unbounded', color: GOLD, fade: 0.3 })
      caption(text, seconds, { at: [x, up ? y - 0.11 : y + 0.11], size: 0.024, font: 'noto', color: INK, fade: 0.3 })
    })
  })
  at(start + heard('century', 'match', 0.78), () => keep('Any new idea must match *{all of it}.', life - (now() - start), { accent: GOLD }))
  wait(spoken + 0.6)
})

leave()
