// The narration of films/fourth_dimension/fourth_dimension.json, a reel: each line is spoken by VoiceStudio on this machine in
// the voice of the profile named below, and the film waits for it, since every clip reads the length of its
// lines as input and marks the second each one starts at (say() in the clips). The jobs are scripts/voice.mjs's:
//   node films/fourth_dimension/voice.mjs          speaks the lines not yet spoken and writes their lengths
//                                                  into the reel, as each clip's input
//   node films/fourth_dimension/voice.mjs verify   shows where the words heard differ from the line
//   node films/fourth_dimension/voice.mjs mix      writes films/fourth_dimension/out/fourth_dimension.wav: give it to space_render
// A second word names another voice of VOICES below ("speak omnivoice", "mix omnivoice").
import { voiceFilm } from '../../scripts/voice.mjs'

// The delivery: without it the profile speaks at 220 words a minute, with it at about 155
const DELIVERY = 'Speak slowly and calmly, in a low voice full of wonder, like the narrator of a space documentary. Pause between sentences.'

// The engines the film is spoken by: the one VoiceStudio is asked for, what it is told beside the line, and
// what tells its takes and files from the film's own. The film's voice is the first.
const VOICES = {
  // CosyVoice 3 takes its delivery in words
  cosyvoice: { engine: 'cosyvoice', fields: { instruct: DELIVERY }, own: true },
  // OmniVoice takes only tags for a delivery. It speaks this profile at 250 words a minute; speed 0.6 brings
  // that to the narrator's 150 and keeps the pauses it makes between sentences. A line spoken sentence by
  // sentence lost the ends of its one-word sentences ("Length." was heard as "link"). 48 steps is the
  // setting the profile's owner rated best by ear. A take can begin with the last words of the profile's own
  // sample ("verify" shows them, heard before the line): such a line is given a seed of its own in `seeds`
  // and is spoken again
  omnivoice: { engine: 'omnivoice', fields: { num_step: '48', speed: '0.6' }, seeds: { falling: 11 } }
}

// What is said, by the name the clips call it by. Words are spelled the way they are spoken
const LINES = {
  // the ladder
  taught: 'You were taught that space has three dimensions. Length. Width. And height.',
  fourth: 'But one hypothesis says there is a fourth. And that you have felt it every second of your life.',
  point: 'Start with a point. Zero dimensions.',
  line: 'Pull that point in one direction, and it becomes a line.',
  square: 'Pull the line in a new direction. A square.',
  cube: 'Once more. A cube.',
  rule: 'The rule is simple. Each new dimension is one more direction.',
  taken: 'So where does the fourth one point? Up, sideways, forward. Every direction we know is already taken.',
  inward: 'Only one way is left. Inward. Place a copy of the cube inside the cube, and join their corners.',
  hypercube: 'This is a hypercube. And the red lines are the fourth dimension.',
  ends: 'In the fourth dimension, inside and outside are two ends of one direction.',
  // the well
  limit: 'To find that direction in the real world, we need a place where gravity is pushed to its limit.',
  hole: 'A black hole. This is how we picture one today. A shadow, a ring of light, and a sky bent around it.',
  textbook: 'And this is how every textbook draws its gravity. A sheet of space, with a well in it.',
  axes: 'Two of the axes, X and Y, are space. The third, call it W, is gravity.',
  literally: 'Physicists call the well just a picture. This hypothesis takes it literally.',
  down: 'But then the well goes down. Down into what?',
  rise: "Let's change the angle. Rise above the sheet, and look straight down.",
  vanished: 'The well is gone. But its depth is not. Each ring is one step down the well. And from above, the steps crowd toward the centre.',
  circle: 'The depth is still here. It simply points inward. A circle inside a circle, and W is the line between them. Just like the cube inside the cube.',
  creature: 'Now imagine a creature living inside this sheet. Completely flat. It cannot look down into the well. It has no word for down. It only knows that everything slides toward the centre.',
  we: 'We are that creature. Our sheet just has three dimensions.',
  falls: 'And the well we cannot see, falls into a fourth dimension.',
  everywhere: 'The fourth dimension is not somewhere far away. It points inward. Toward every star. Toward every planet. Toward the ground beneath your feet.',
  weight: 'You cannot see it. But you can feel it. You call it weight.',
  // what follows
  stretch: 'If the hypothesis is right, gravity does not curve space, as Einstein proposed. It stretches it, along W.',
  ripple: 'And space that can stretch can also ripple. In twenty fifteen, we caught such a ripple, from two black holes merging more than a billion light years away.',
  proton: 'It stretched the space around us by a thousandth of the width of a proton.',
  star: 'And at the bottom of the well? Take a neutron star. A heavy object, resting at the bottom of a deep well.',
  object: 'Add more mass, and the well grows deeper. Until even light cannot climb out. That is a black hole. Not a hole in space. An object, as simple as a neutron star.',
  nothing: 'So nothing has to break. The singularity. The wormhole. The white hole. In our nature, most likely, none of them is possible. There is only a well, and a simple object resting at the bottom of it.',
  // the experiment
  test: 'Is there a way to test this? In twenty twenty-one, an atomic clock caught time running at different speeds across a single millimetre of height.',
  ruler: 'If we can build an atomic clock, we can build an atomic ruler. Picture a coil of superconductor, almost three hundred thousand kilometres long. More than three quarters of the way to the Moon. Exactly the distance light travels in one second.',
  photon: 'Send a photon through it on Earth, deep in the well. Then far out in space, where the well is almost flat. And time it.',
  answers: 'Relativity says: one second, both times. The hypothesis says: out there, where matter is no longer squeezed along W, the photon needs more than one second.',
  question: 'Would matter really shrink? Even the author of the hypothesis calls that an open question.',
  // A line of its own, so that the picture can hold the author's notes for as long as they take to read
  one: 'One coil. One photon. One second, or a little more.',
  // the fall
  hypothesis: 'For now, this is only a hypothesis. It still has to face the equations, and the experiments.',
  falling: 'But the next time you feel your own weight, remember. There may be a direction you cannot point to. And you are already falling into it.'
}

// The words the picture answers to: the second each is said at goes to the clips as input.cues[line][word].
// A word the recognizer tends to mishear names what it hears instead after a bar
const CUES = {
  taught: ['length', 'width|with', 'height'],
  taken: ['up', 'sideways', 'forward', 'every'],
  inward: ['inward', 'place'],
  hypercube: ['red'],
  hole: ['shadow', 'ring', 'sky'],
  textbook: ['sheet', 'well'],
  axes: ['x', 'y', 'w|double'],
  down: ['down'],
  rise: ['rise'],
  vanished: ['depth', 'ring', 'above'],
  circle: ['inward', 'circle', 'w|double', 'cube'],
  creature: ['flat', 'look', 'slides'],
  we: ['three'],
  falls: ['falls'],
  everywhere: ['inward', 'star', 'planet', 'ground'],
  weight: ['feel', 'weight|wait'],
  stretch: ['stretches'],
  ripple: ['ripple', 'two'],
  proton: ['proton'],
  star: ['neutron|new'],
  object: ['deeper', 'light', 'black', 'object'],
  nothing: ['singularity', 'wormhole', 'white|whitehole', 'likely', 'well', 'simple'],
  test: ['clock', 'millimetre|millimeter'],
  ruler: ['ruler', 'coil', 'kilometres|kilometers', 'moon', 'second'],
  photon: ['earth', 'space', 'time'],
  answers: ['relativity', 'hypothesis', 'more'],
  question: ['question'],
  one: ['coil', 'photon', 'second'],
  falling: ['remember', 'falling']
}

await voiceFilm({ film: 'fourth_dimension', lines: LINES, cues: CUES, profile: 'Theo', language: 'English', seed: 7, delivery: DELIVERY, voices: VOICES, takes: 'fd_' })
