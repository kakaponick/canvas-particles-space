// The narration of films/scale/scale.json, a reel of two clips: their LINES are read from the clips and
// spoken by VoiceStudio on this machine in the voice of the profile named below, and laid at the seconds the
// clips mark (say: in their marks). The clips do not wait for the voice, so each line must end before the
// next one starts; the mix says which do not. The jobs are scripts/voice.mjs's:
//   node films/scale/voice.mjs          speaks the lines not yet spoken
//   node films/scale/voice.mjs verify   shows where the words heard differ from the line
//   node films/scale/voice.mjs mix      writes films/scale/out/scale.wav and the page's films/scale/audio/scale.m4a
import { linesOfReel, voiceFilm } from '../../scripts/voice.mjs'

const { lines } = linesOfReel('scale')

// OmniVoice clones the profile best at 48 steps (its owner rated it 9 of 10 by ear). Its fields are the
// delivery too: the takes of the film's own voice are named by its delivery, so a change of them speaks the
// lines again
const FIELDS = { num_step: '48', speed: '1.0' }
// Lines the recognizer heard said wrong in the first takes (seed 7) get a seed of their own
const VOICES = {
  omnivoice: { engine: 'omnivoice', fields: FIELDS, own: true, seeds: { proton: 11, cygnus: 11, sun: 11, m87: 11, laniakea: 11, even: 11 } }
}

await voiceFilm({ film: 'scale', lines, cues: {}, profile: 'Владимир Сурдин', language: 'Russian', seed: 7, delivery: JSON.stringify(FIELDS), voices: VOICES, takes: 'sc_' })
