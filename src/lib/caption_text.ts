// The words of a film's caption, read once. A caption's text carries a few marks that popular science
// needs and plain text cannot say: a raised or lowered part (r_{s}, c^{2}), a stressed term (*{event horizon})
// and a number that is read from the film as it plays (#{cameraZoom:1}). Each mark is a sign and a brace, so
// text without them, an underscore or an asterisk of its own included, is drawn as it always was.
import { fail } from './agent_values'

export interface CaptionRun {
  text: string
  // 1 is raised, -1 lowered, 0 on the line
  shift: -1 | 0 | 1
  // Drawn in the caption's accent colour
  accent: boolean
  // A live number in place of words: the key it reads, the digits after its point, and a comma for the point
  value: { key: string, digits: number, comma: boolean } | null
}

const VALUE_SPEC = /^([A-Za-z][A-Za-z0-9]*)(?::(\d)(,)?)?$/

function parseLine (line: string, where: string): CaptionRun[] {
  const runs: CaptionRun[] = []
  let plain = ''
  const flush = (shift: CaptionRun['shift'], accent: boolean) => {
    if (plain !== '') runs.push({ text: plain, shift, accent, value: null })
    plain = ''
  }
  // Reads up to the brace that closes this part, or to the line's end, and returns where it stopped
  const read = (from: number, shift: CaptionRun['shift'], accent: boolean, inside: boolean): number => {
    let at = from
    while (at < line.length) {
      const sign = line[at]
      if (inside && sign === '}') {
        flush(shift, accent)
        return at + 1
      }
      if (line[at + 1] === '{' && (sign === '^' || sign === '_' || sign === '*' || sign === '#')) {
        flush(shift, accent)
        if (sign === '#') {
          const end = line.indexOf('}', at + 2)
          const spec = end < 0 ? null : VALUE_SPEC.exec(line.slice(at + 2, end).trim())
          if (!spec) fail(`${where}: #{...} takes a key and the digits after its point, as in #{cameraZoom:1} or #{years:1,} for a comma`)
          runs.push({ text: '', shift, accent, value: { key: spec[1], digits: spec[2] === undefined ? 0 : Number(spec[2]), comma: spec[3] === ',' } })
          at = end + 1
        } else if (sign === '*') {
          at = read(at + 2, shift, true, true)
        } else {
          if (shift !== 0) fail(`${where}: a raised or lowered part cannot hold another one`)
          at = read(at + 2, sign === '^' ? 1 : -1, accent, true)
        }
        continue
      }
      plain += sign
      at++
    }
    if (inside) fail(`${where}: a { is never closed in "${line}"`)
    flush(shift, accent)
    return at
  }
  read(0, 0, false, false)
  return runs
}

// A caption's lines, each as the runs it is drawn from
export const parseCaption = (text: string, where: string): CaptionRun[][] => text.split('\n').map(line => parseLine(line, where))

// The letters a caption shows, without its marks; a live number stands as a digit
export const captionLetters = (lines: CaptionRun[][]) => lines.map(line => line.map(run => run.value ? '0' : run.text).join('')).join('\n')

export const captionKeys = (lines: CaptionRun[][]) => [...new Set(lines.flatMap(line => line.flatMap(run => run.value ? [run.value.key] : [])))]

export function writeNumber (value: number, digits: number, comma: boolean) {
  const written = value.toFixed(digits)
  return comma ? written.replace('.', ',') : written
}

// Every character the bundled faces of a caption can draw between them (the display face asked for, then
// Noto Sans, Noto Sans Math and Noto Sans Symbols), read from the font files' own character maps: Latin,
// Cyrillic, Greek, mathematics, arrows, the signs of the Sun, the planets and the stars. Hex ranges
const COVERED = '20-7e a0-ff 131 152-153 190 1b5 237 2bb-2bc 2c6 2d4-2d5 2da 2dc 300-30c 310-312 315 31a 323 326-327 329 32c-333 338 33a 33f 346 34d ' +
  '370-377 37a-37f 384-38a 38c 38e-3a1 3a3-3e1 3f0-45f 490-491 4b0-4b1 606-60a 60c 627-628 62a-63a 641-64a 660-66c 66e-66f 6a1 6ba 6f0-6f9 1d46 ' +
  '2000-200b 2010 2013-201a 201c-201e 2020-2022 2025-2026 202f 2032-203a 203c 2040 2043-2044 2047 2050 2057 205f 20ac 20d0-20f0 2102 2107 210a-2113 ' +
  '2115-2116 2118-211d 2122 2124 2126-2129 212b-212d 212f-2138 213c-214b 2160-2183 2185-2188 218a-218b 2190-2315 2317 2319 231c-2323 2329-232a ' +
  '232c-237a 237c 2380-23b9 23be-23ce 23d0-23e8 2422-2423 2460-2500 2506 250c 2510 2514 2518 2550 2571-2572 2577 2580 2584 2588 258c 2590-2593 ' +
  '25a0-25ff 2605-2606 2609-260d 2613 2621 2624-262f 2638-2653 2660-2667 2669-267e 2680-2689 2690-269d 26a2-26bc 26ce 26e2-26ff 2713 271d-2721 272a ' +
  '2736 2739 273d 2772-2773 2776-2793 279b 27c0-27ff 2900-2b04 2b0e-2b4c 2b50-2b54 2bfe 3012 3030 fe00 ff5b ff5d 1d400-1d454 1d456-1d49c 1d49e-1d49f ' +
  '1d4a2 1d4a5-1d4a6 1d4a9-1d4ac 1d4ae-1d4b9 1d4bb 1d4bd-1d4c3 1d4c5-1d505 1d507-1d50a 1d50d-1d514 1d516-1d51c 1d51e-1d539 1d53b-1d53e 1d540-1d544 ' +
  '1d546 1d54a-1d550 1d552-1d6a5 1d6a8-1d7cb 1d7ce-1d7ff 1ee00-1ee03 1ee05-1ee1f 1ee21-1ee22 1ee24 1ee27 1ee29-1ee32 1ee34-1ee37 1ee39 1ee3b 1ee42 ' +
  '1ee47 1ee49 1ee4b 1ee4d-1ee4f 1ee51-1ee52 1ee54 1ee57 1ee59 1ee5b 1ee5d 1ee5f 1ee61-1ee62 1ee64 1ee67-1ee6a 1ee6c-1ee72 1ee74-1ee77 1ee79-1ee7c ' +
  '1ee7e 1ee80-1ee89 1ee8b-1ee9b 1eea1-1eea3 1eea5-1eea9 1eeab-1eebb 1eef0-1eef1 1f100-1f10c 1f110-1f16c 1f170-1f190 1f19b-1f1ac 1f546-1f549 1f54f ' +
  '1f610 1f700-1f773 1f780-1f7d8'

const RANGES = COVERED.split(' ').map(range => {
  const [from, to] = range.split('-').map(end => parseInt(end, 16))
  return [from, to ?? from] as const
})

// The characters of `text` that no bundled face of a caption holds, each once
export function strangeLetters (text: string) {
  const strange = new Set<string>()
  for (const letter of text) {
    const code = letter.codePointAt(0) ?? 0
    if (code === 10 || RANGES.some(([from, to]) => code >= from && code <= to)) continue
    strange.add(letter)
  }
  return [...strange]
}
