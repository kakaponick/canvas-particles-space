// The narration of films/fourth_dimension_pop.json, a reel: what is said is each clip's own LINES, and the words
// its picture answers to are the cues[line][word] it asks for, both read from the clips (linesOfReel). The jobs
// are scripts/voice.mjs's:
//   DRAMA3_SERVERS=<url>,<url> node films/fourth_dimension_pop_voice.mjs   speaks the lines not yet spoken
//   node films/fourth_dimension_pop_voice.mjs verify                       shows where the words heard differ
//   node films/fourth_dimension_pop_voice.mjs mix                          writes films/fourth_dimension_pop.wav
// A second word names another voice of VOICES below ("speak omnivoice", "mix omnivoice"); "speak ru" writes the
// reel paced by the Russian narration, films/fourth_dimension_pop_ru.json, and "mix ru" its sound.
import fs from 'node:fs'
import process from 'node:process'
import { linesOfReel, voiceFilm } from '../scripts/voice.mjs'
import * as ru from './fourth_dimension_pop_ru.mjs'

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
  for (const [, call, name, rest] of fs.readFileSync(new URL('../' + clip.film, import.meta.url), 'utf8').matchAll(/(say|status)\('(\w+)'([^)]*)/g)) {
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
// "tag by status" did. The 4D explanation of clips 02–03 is built towards a "wow" on the red lines pointing
// inward instead: WOW picks the build (a: hushed wonder, b: open delight, c: only the status tags and
// pauses written as punctuation); every build's takes stay in films/voice/, so trying another needs no machine
// for the lines already spoken
const STATUS_TAG = { known: '[plain and matter-of-fact]', math: '[clear and patient]', idea: '[leaning in, a little excited]', open: '[quieter, thoughtful, leaving it open]' }
const WOW = {
  a: {
    fourth: 'Значит, четвёртому измерению нужно четвёртое направление. [lowering the voice, intrigued] И вот тут начинается странное.',
    taken: '[playful, slowly building tension] Попробуйте. Вверх и вниз: занято. Влево и вправо: занято. Вперёд и назад: занято. [quieter] В нашем пространстве указать больше некуда.',
    trick: '[leaning in, as if sharing a secret] Но есть хитрость. Когда вы рисуете куб на бумаге, третье направление вы подделываете. Дальнюю сторону просто рисуют меньше.',
    copy: '[slow and deliberate] Так сделаем это ещё раз. Нарисуйте маленький куб внутри большого и соедините углы. [a short pause, then quietly amazed] Эти красные линии и есть четвёртое направление, подделанное единственным доступным нам способом.',
    tesseract: '[hushed, full of wonder] У этой фигуры есть имя: [a beat] тессеракт. [softly] Куб, протянутый через четвёртое измерение.',
    inout: '[slowly, letting it land] А теперь посмотрите, куда идут красные линии. [a long pause, then awed, almost whispering] Внутрь. [warm and clear again] Отсюда, где мы стоим, четвёртое направление выглядит как «внутрь» и «наружу».'
  },
  b: {
    fourth: 'Значит, четвёртому измерению нужно четвёртое направление. [grinning] И вот тут начинается странное.',
    taken: '[playful, faster and faster] Попробуйте. Вверх и вниз: занято. Влево и вправо: занято. Вперёд и назад: занято. [throwing up hands] В нашем пространстве указать больше некуда.',
    trick: '[eager, can barely wait] Но есть хитрость. Когда вы рисуете куб на бумаге, третье направление вы подделываете. Дальнюю сторону просто рисуют меньше.',
    copy: '[building excitement] Так сделаем это ещё раз. Нарисуйте маленький куб внутри большого и соедините углы. [excited, amazed] Эти красные линии и есть четвёртое направление, подделанное единственным доступным нам способом.',
    tesseract: '[delighted, triumphant] У этой фигуры есть имя: тессеракт! [with relish] Куб, протянутый через четвёртое измерение.',
    inout: '[curious] А теперь посмотрите, куда идут красные линии. [astonished] Внутрь! [laughs softly, then clear] Отсюда, где мы стоим, четвёртое направление выглядит как «внутрь» и «наружу».'
  },
  c: {
    fourth: '[clear and patient] Значит, четвёртому измерению нужно четвёртое направление… И вот тут начинается странное.',
    copy: '[clear and patient] Так сделаем это ещё раз. Нарисуйте маленький куб внутри большого и соедините углы… Эти красные линии и есть четвёртое направление, подделанное единственным доступным нам способом.',
    tesseract: '[clear and patient] У этой фигуры есть имя… тессеракт. Куб, протянутый через четвёртое измерение.',
    inout: '[clear and patient] А теперь посмотрите, куда идут красные линии… Внутрь. Отсюда, где мы стоим, четвёртое направление выглядит как «внутрь» и «наружу».'
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
    fourth: 'So a fourth dimension needs a fourth direction. [lowering the voice, intrigued] And that is where it gets weird.',
    taken: '[playful, slowly building tension] Try it. Up and down: taken. Left and right: taken. Forward and back: taken. [quieter] In our space, there is nowhere left to point.',
    trick: '[leaning in, as if sharing a secret] But there is a trick. When you draw a cube on paper, you fake the third direction. The far side is simply drawn smaller.',
    copy: '[slow and deliberate] So do it again. Draw a small cube inside the big one, and join the corners. [a short pause, then quietly amazed] Those red lines are the fourth direction, faked the only way we can.',
    tesseract: '[hushed, full of wonder] This shape has a name: [a beat] a tesseract. [softly] A cube, dragged through a fourth dimension.',
    inout: '[slowly, letting it land] And look which way the red lines run. [a long pause, then awed, almost whispering] Inward. [warm and clear again] From where we stand, the fourth direction looks like in, and out.'
  },
  b: {
    fourth: 'So a fourth dimension needs a fourth direction. [grinning] And that is where it gets weird.',
    taken: '[playful, faster and faster] Try it. Up and down: taken. Left and right: taken. Forward and back: taken. [throwing up hands] In our space, there is nowhere left to point.',
    trick: '[eager, can barely wait] But there is a trick. When you draw a cube on paper, you fake the third direction. The far side is simply drawn smaller.',
    copy: '[building excitement] So do it again. Draw a small cube inside the big one, and join the corners. [excited, amazed] Those red lines are the fourth direction, faked the only way we can.',
    tesseract: '[delighted, triumphant] This shape has a name: a tesseract! [with relish] A cube, dragged through a fourth dimension.',
    inout: '[curious] And look which way the red lines run. [astonished] Inward! [laughs softly, then clear] From where we stand, the fourth direction looks like in, and out.'
  },
  c: {
    fourth: '[clear and patient] So a fourth dimension needs a fourth direction… And that is where it gets weird.',
    copy: '[clear and patient] So do it again. Draw a small cube inside the big one, and join the corners… Those red lines are the fourth direction, faked the only way we can.',
    tesseract: '[clear and patient] This shape has a name… a tesseract. A cube, dragged through a fourth dimension.',
    inout: '[clear and patient] And look which way the red lines run… Inward. From where we stand, the fourth direction looks like in, and out.'
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
  // OmniVoice in VoiceStudio, as in films/fourth_dimension_voice.mjs: speed 0.6 brings the profile's
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
    white: ['whitehole']
  },
  profile: 'Theo',
  language: 'English',
  seed: 7,
  voices: VOICES,
  takes: 'fdp_'
})
