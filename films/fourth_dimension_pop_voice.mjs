// The narration of films/fourth_dimension_pop.json, a reel: what is said is each clip's own LINES, and the words
// its picture answers to are the cues[line][word] it asks for, both read from the clips (linesOfReel). The jobs
// are scripts/voice.mjs's:
//   DRAMA3_SERVERS=<url>,<url> node films/fourth_dimension_pop_voice.mjs   speaks the lines not yet spoken
//   node films/fourth_dimension_pop_voice.mjs verify                       shows where the words heard differ
//   node films/fourth_dimension_pop_voice.mjs mix                          writes films/fourth_dimension_pop.wav
// A second word names another voice of VOICES below ("speak omnivoice", "mix omnivoice"); "speak ru" writes the
// reel paced by the Russian narration, films/fourth_dimension_pop_ru.json, and "mix ru" its sound.
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

const VOICES = {
  // Fish Audio Drama 3 (Q4_K_S experts) on audio.cpp servers of a rented machine, cloning Theo's recording.
  // Its takes need no machine once spoken; the servers are asked for only the lines not yet spoken.
  // Its licence is non-commercial
  drama3: { engine: 'drama3', fields: {}, own: true, servers: process.env.DRAMA3_SERVERS?.split(',') ?? [] },
  // OmniVoice in VoiceStudio, as in films/fourth_dimension_voice.mjs: speed 0.6 brings the profile's
  // 250 words a minute to a narrator's 150
  omnivoice: { engine: 'omnivoice', fields: { num_step: '48', speed: '0.6' } },
  // The Russian narration (fourth_dimension_pop_ru.mjs) in Drama 3, cloning the VoiceStudio profile of a
  // Russian speaker. top_p 0.97 sounded much better than 0.8 in the benchmark (scripts/drama3_bench.mjs)
  ru: {
    engine: 'drama3',
    fields: { options: { top_p: 0.97 } },
    servers: process.env.DRAMA3_SERVERS?.split(',') ?? [],
    language: 'Russian',
    lines: ru.LINES,
    cues: ruCues,
    profile: 'YouTube · QxkFrDTCKxg_3594f32f'
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
