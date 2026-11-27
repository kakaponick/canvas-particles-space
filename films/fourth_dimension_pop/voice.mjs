// The narration of films/fourth_dimension_pop/fourth_dimension_pop.json, a reel: what is said is each clip's own LINES, and the words
// its picture answers to are the cues[line][word] it asks for, both read from the clips (linesOfReel). The jobs
// are scripts/voice.mjs's:
//   DRAMA3_SERVERS=<url>,<url> node films/fourth_dimension_pop/voice.mjs   speaks the lines not yet spoken
//   node films/fourth_dimension_pop/voice.mjs verify                       shows where the words heard differ
//   node films/fourth_dimension_pop/voice.mjs mix                          writes films/fourth_dimension_pop/out/fourth_dimension_pop.wav
//   node films/fourth_dimension_pop/voice.mjs plan                         lists the lines not yet spoken
// A second word names another voice of VOICES below ("speak omnivoice", "mix omnivoice"); "speak ru" writes the
// reel paced by the Russian narration, films/fourth_dimension_pop/voices/ru.json, and "mix ru" its sound; the Russian
// voices usachev and surdin pace films/fourth_dimension_pop/voices/usachev.json and _surdin.json the same way.
import fs from 'node:fs'
import process from 'node:process'
import { linesOfReel, voiceFilm } from '../../scripts/voice.mjs'
import * as ru from './ru.mjs'

const { lines, cues } = linesOfReel('fourth_dimension_pop')

// The Russian cues as scripts/voice.mjs takes them: 'word|слово', in the order the Russian line says them
const said = text => text.toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u)
const ruCues = Object.fromEntries(Object.entries(ru.CUES).map(([name, pairs]) => {
  const line = said(ru.LINES[name])
  const at = word => line.indexOf(said(word.split('|')[0]).join(''))
  return [name, Object.entries(pairs).sort((a, b) => at(a[1]) - at(b[1])).map(([key, word]) => `${key}|${word}`)]
}))

// The kind of claim each line makes, as its clip labels it on the screen: the status('kind') that follows the
// line's say('name'), and every later line of its clip while a label held to the clip's end (end - now()) stays
// up. A line that claims nothing (a question, a thought experiment) has none
const statusOf = {}
const labelled = new Set()
for (const clip of JSON.parse(fs.readFileSync(new URL('./fourth_dimension_pop.json', import.meta.url), 'utf8')).clips) {
  let last = null
  let held = null
  for (const [, call, name, rest] of fs.readFileSync(new URL('../../' + clip.film, import.meta.url), 'utf8').matchAll(/(say|status)\('(\w+)'([^)]*)/g)) {
    if (call === 'say') {
      last = name
      if (held) statusOf[name] = held
    } else if (last && !labelled.has(last)) {
      // A line's first label is its own: a later one (09's open question after the hypothesis) comes in after it
      labelled.add(last)
      statusOf[last] = name
      held = /end - now/.test(rest) ? name : null
    }
  }
}
// The Russian delivery, in Drama 3's bracketed tags: each line read the way its label reads (measured physics
// plainly, geometry patiently, the hypothesis leaning in, the open question quietly), as the benchmark's
// "tag by status" did. The 4D explanation of clips 02–03 is built towards a "wow" on the last word of 03,
// "inward", instead: WOW picks the build (a: hushed wonder, b: open delight, c: only the status tags and
// pauses written as punctuation); every build's takes stay in films/voice/, so trying another needs no machine
// for the lines already spoken
const STATUS_TAG = { known: '[plain and matter-of-fact]', math: '[clear and patient]', idea: '[leaning in, a little excited]', open: '[quieter, thoughtful, leaving it open]' }
const WOW = {
  a: {
    fourth: 'Значит, четвёртому измерению нужно четвёртое направление. [lowering the voice, intrigued] Куда бы оно указывало?',
    stepup: '[slowly, letting it land] На ступень выше то же было бы верно и для нас. Четвёртое направление не выглядело бы новым способом указать. [a short pause, then quietly amazed] Оно выглядело бы как внутрь.'
  },
  b: {
    fourth: 'Значит, четвёртому измерению нужно четвёртое направление. [grinning] Куда бы оно указывало?',
    stepup: '[curious] На ступень выше то же было бы верно и для нас. Четвёртое направление не выглядело бы новым способом указать. [astonished] Оно выглядело бы как внутрь!'
  },
  c: {
    fourth: '[clear and patient] Значит, четвёртому измерению нужно четвёртое направление… Куда бы оно указывало?',
    stepup: '[clear and patient] На ступень выше то же было бы верно и для нас. Четвёртое направление не выглядело бы новым способом указать… Оно выглядело бы как внутрь.'
  }
}
const WOW_BUILD = WOW[process.env.WOW ?? 'a']
// The build's text must say the line's own words: the words heard are checked against the line, not the build
const plain = text => text.replace(/\[[^\]]*\]\s*/g, '').replace(/…/g, '.').replace(/\s+/g, ' ').trim()
for (const [name, text] of Object.entries(WOW).flatMap(([, build]) => Object.entries(build))) {
  if (said(plain(text)).join(' ') !== said(ru.LINES[name]).join(' ')) throw new Error(`The build of "${name}" changes its words`)
}
const sayRu = (name, text) => WOW_BUILD[name] ?? (statusOf[name] ? `${STATUS_TAG[statusOf[name]]} ${text}` : text)
// The same delivery and the same three builds for the English lines
const WOW_EN = {
  a: {
    fourth: 'So a fourth dimension needs a fourth direction. [lowering the voice, intrigued] Where would it point?',
    stepup: '[slowly, letting it land] One step up, the same would hold for us. A fourth direction would not look like a new way to point. [a short pause, then quietly amazed] It would look like inward.'
  },
  b: {
    fourth: 'So a fourth dimension needs a fourth direction. [grinning] Where would it point?',
    stepup: '[curious] One step up, the same would hold for us. A fourth direction would not look like a new way to point. [astonished] It would look like inward!'
  },
  c: {
    fourth: '[clear and patient] So a fourth dimension needs a fourth direction… Where would it point?',
    stepup: '[clear and patient] One step up, the same would hold for us. A fourth direction would not look like a new way to point… It would look like inward.'
  }
}
for (const [name, text] of Object.entries(WOW_EN).flatMap(([, build]) => Object.entries(build))) {
  if (said(plain(text)).join(' ') !== said(lines[name]).join(' ')) throw new Error(`The English build of "${name}" changes its words`)
}
const WOW_EN_BUILD = WOW_EN[process.env.WOW ?? 'a']
const sayEn = (name, text) => WOW_EN_BUILD[name] ?? (statusOf[name] ? `${STATUS_TAG[statusOf[name]]} ${text}` : text)

const VOICES = {
  // Fish Audio Drama 3 (Q4_K_S experts) on audio.cpp servers of a rented machine, cloning Theo's recording.
  // Its takes need no machine once spoken; the servers are asked for only the lines not yet spoken.
  // Its licence is non-commercial
  drama3: { engine: 'drama3', fields: {}, own: true, servers: process.env.DRAMA3_SERVERS?.split(',') ?? [] },
  // OmniVoice in VoiceStudio, as in films/fourth_dimension/voice.mjs: speed 0.6 brings the profile's
  // 250 words a minute to a narrator's 150
  omnivoice: { engine: 'omnivoice', fields: { num_step: '48', speed: '0.6' } },
  // The Russian narration (fourth_dimension_pop_ru.mjs) in Drama 3, cloning the VoiceStudio profile of a
  // Russian speaker. top_p 0.97 sounded much better than 0.8 in the benchmark (scripts/drama3_bench.mjs), and
  // the delivery by status worked well there; say() adds it, with the build towards the 4D "wow"
  ru: {
    engine: 'drama3',
    fields: { options: { top_p: 0.97 } },
    say: sayRu,
    servers: process.env.DRAMA3_SERVERS?.split(',') ?? [],
    language: 'Russian',
    lines: ru.LINES,
    cues: ruCues,
    profile: 'YouTube · QxkFrDTCKxg_3594f32f'
  },
  // Two Russian narrations in the same settings, a test of Drama 3's cloning, not for publishing. usachev
  // clones the operator's VoiceStudio profile "Руслан Усачев" (its recording and its words); surdin clones
  // 12.2 s of "Неземной подкаст" on the James Webb telescope (the feed's first episode, from 1:07), cut into
  // films/voice/ (ignored by git) with its words written word for word
  usachev: {
    engine: 'drama3',
    fields: { options: { top_p: 0.97 } },
    say: sayRu,
    servers: process.env.DRAMA3_SERVERS?.split(',') ?? [],
    language: 'Russian',
    lines: ru.LINES,
    cues: ruCues,
    profile: 'Руслан Усачев'
  },
  surdin: {
    engine: 'drama3',
    fields: { options: { top_p: 0.97 } },
    say: sayRu,
    servers: process.env.DRAMA3_SERVERS?.split(',') ?? [],
    language: 'Russian',
    lines: ru.LINES,
    cues: ruCues,
    sample: {
      audio: 'films/voice/surdin_sample.wav',
      text: 'Ничего подобного мы даже не представляли себе, что можно запустить в космос. Дело в том, что для запуска телескоп должен быть небольшим, компактным, чтобы его можно было всунуть под обтекатель ракеты.'
    }
  },
  // The English narration in the same settings, cloning the English speaker of the VoiceStudio profile
  // "YouTube · sQUILVdbo4Y_55637575" from its recording copied out of git (films/voice/en2_sample.wav): the
  // profile's own words write "spacetime" half in Cyrillic, and Drama 3 is given the words the recording says
  en2: {
    engine: 'drama3',
    fields: { options: { top_p: 0.97 } },
    say: sayEn,
    servers: process.env.DRAMA3_SERVERS?.split(',') ?? [],
    sample: {
      audio: 'films/voice/en2_sample.wav',
      text: 'whose shapes are subtly changed by the warped spacetime between us and them. But how can we know that those shapes were warped if we have no idea what shape the galaxies originally were? Well, that\'s the brilliance of weak gravitational lensing.'
    }
  }
}

await voiceFilm({
  film: 'fourth_dimension_pop',
  lines,
  cues,
  // What the recognizer writes for a word the picture answers to: numbers in figures, American spelling
  heardAs: {
    w: ['double'],
    x: ['ex'],
    y: ['why'],
    sixty: ['60'],
    fifteen: ['2015'],
    thirty: ['30'],
    twenty: ['20'],
    kilometre: ['kilometer', 'km'],
    kilometres: ['kilometers', 'km'],
    millimetre: ['millimeter'],
    centimetres: ['centimeters', 'cm'],
    white: ['whitehole']
  },
  profile: 'Theo',
  language: 'English',
  seed: 7,
  voices: VOICES,
  takes: 'fdp_'
})
