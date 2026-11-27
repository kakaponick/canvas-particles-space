// The review gate of a film (SKILL.md, "A film", step 6): draws the whole film as contact sheets, a frame every
// `--every` seconds and at both ends of every shot, and writes what a reviewer needs beside them: for each sheet
// its clip, the film's own seconds and the reel's, the shots, lines and captions in it, and the shapes drawn on
// the frame rather than on the scene, which are the first suspects. The film-review agent (.claude/agents/
// film-review.md) reads the sheets; this script reads nothing into them.
//   node .claude/skills/space-scene/scripts/review.mjs sheets <reel.json | film.js> [--input <lines.json>] [--every 1.5] [--clips 3,4]
//   node .claude/skills/space-scene/scripts/review.mjs verdict <reel.json | film.js> pass|fail "<one line>"
//   node .claude/skills/space-scene/scripts/review.mjs status [film]
// Sheets go to .claude/skills/space-scene-workspace/review/<film>/ (out of git), the manifest to manifest.json
// there. `verdict` records the reviewers' verdict for the film as it is now (verdict.json, with the time and the
// hash of every clip's script and the reel); the Stop hook .claude/hooks/review_gate.mjs holds an answer back
// while a rendered mp4 of the film is newer than a passing verdict, or the scripts changed since.
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const SPACE = path.join(root, '.claude/skills/space-scene/scripts/space.mjs')
export const REVIEW_ROOT = path.join(root, '.claude/skills/space-scene-workspace/review')
// Frames on one sheet: four across, three down, each 512 pixels wide
const PER_SHEET = 12

const nameOf = file => path.basename(file).replace(/\.(json|js)$/, '')

// The clips of a reel, or the film alone as one clip; each with the input its script reads
export function clipsOf (file, input) {
  const full = path.resolve(root, file)
  if (full.endsWith('.json')) {
    const reel = JSON.parse(fs.readFileSync(full, 'utf8'))
    if (Array.isArray(reel.clips)) return reel.clips.map((clip, index) => ({ index, name: clip.name ?? `clip ${index + 1}`, film: clip.film, input: clip.input ?? null, transition: clip.transition ?? null }))
  }
  return [{ index: 0, name: nameOf(file), film: path.relative(root, full).replace(/\\/g, '/'), input: input ? JSON.parse(fs.readFileSync(path.resolve(root, input), 'utf8')) : null, transition: null }]
}

// What a film's script and the reel are now: the verdict holds to these
export function fingerprint (file) {
  const hash = crypto.createHash('sha1')
  hash.update(fs.readFileSync(path.resolve(root, file)))
  for (const clip of clipsOf(file)) hash.update(fs.readFileSync(path.join(root, clip.film)))
  return hash.digest('hex').slice(0, 16)
}

function space (args) {
  return execFileSync(process.execPath, [SPACE, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
}

// The timeline space.mjs check prints: the film's length and each entry with its span
function timelineOf (clip, inputFile) {
  const text = space(['check', clip.film, ...(inputFile ? ['--input', inputFile] : [])])
  const length = Number(/The film: ([\d.]+) s/.exec(text)?.[1])
  const entries = []
  for (const line of text.split('\n')) {
    const found = /^\s+([\d.]+)(?:-([\d.]+))? s\s+(.*)$/.exec(line)
    if (found) entries.push({ from: Number(found[1]), to: Number(found[2] ?? found[1]), what: found[3] })
  }
  return { length, entries }
}

function sheets (file, { input, every, only }) {
  const film = nameOf(file)
  const out = path.join(REVIEW_ROOT, film)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'review-'))
  const manifest = { film: file, made: new Date().toISOString(), every, partial: Boolean(only), fingerprint: fingerprint(file), clips: [] }
  let offset = 0
  for (const clip of clipsOf(file, input)) {
    let inputFile = null
    if (clip.input) {
      inputFile = path.join(temp, `input_${clip.index}.json`)
      fs.writeFileSync(inputFile, JSON.stringify(clip.input))
    }
    const { length, entries } = timelineOf(clip, inputFile)
    // A dissolve lays the clip over the end of the one before
    if (clip.transition?.seconds && clip.transition.kind !== 'cut') offset -= clip.transition.seconds
    const start = offset
    offset += length
    if (only && !only.includes(clip.index + 1)) continue
    const shots = entries.filter(entry => /^shot "/.test(entry.what)).map(entry => ({ name: /^shot "(.*)"$/.exec(entry.what)[1], from: entry.from, to: entry.to }))
    // A frame every `every` seconds, and one just inside each end of every shot, where joins and arrivals break
    const seconds = new Set()
    for (let second = Math.min(every / 2, length); second < length; second += every) seconds.add(+second.toFixed(2))
    for (const shot of shots) {
      seconds.add(+Math.min(shot.from + 0.4, length - 0.05).toFixed(2))
      seconds.add(+Math.max(shot.to - 0.3, 0).toFixed(2))
    }
    const sorted = [...seconds].filter(second => second >= 0 && second < length).sort((a, b) => a - b)
    const entry = { number: clip.index + 1, name: clip.name, film: clip.film, length, reelStart: +start.toFixed(2), shots, sheets: [] }
    for (let first = 0; first < sorted.length; first += PER_SHEET) {
      const batch = sorted.slice(first, first + PER_SHEET)
      const sheet = path.join(out, `clip${String(clip.index + 1).padStart(2, '0')}_${String(first / PER_SHEET + 1).padStart(2, '0')}.jpg`)
      space(['preview', clip.film, sheet, batch.join(','), ...(inputFile ? ['--input', inputFile] : [])])
      const from = batch[0]
      const to = batch.at(-1)
      const during = item => item.from <= to && item.to >= from
      entry.sheets.push({
        file: path.relative(root, sheet).replace(/\\/g, '/'),
        seconds: batch,
        reel: batch.map(second => clock(start + second)),
        shots: shots.filter(during).map(shot => shot.name),
        captions: entries.filter(item => during(item) && /^caption "/.test(item.what)).map(item => `${item.from}-${item.to} s ${item.what}`),
        // The first suspects: a line, curve or arrow fixed to the frame while the scene under it moves or curves
        frameShapes: entries.filter(item => during(item) && /^draws (a line|a curve|an arrow)\b.* on the frame/.test(item.what)).map(item => `${item.from}-${item.to} s ${item.what}`)
      })
    }
    manifest.clips.push(entry)
    console.log(`clip ${clip.index + 1} "${clip.name}": ${sorted.length} frames on ${entry.sheets.length} sheets`)
  }
  fs.rmSync(temp, { recursive: true, force: true })
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Wrote ${path.relative(root, path.join(out, 'manifest.json'))}`)
}

const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function verdict (file, result, line) {
  if (result !== 'pass' && result !== 'fail') throw new Error('verdict takes pass or fail')
  if (!line) throw new Error('verdict takes one line saying what the reviewers found')
  const out = path.join(REVIEW_ROOT, nameOf(file))
  const manifest = path.join(out, 'manifest.json')
  if (!fs.existsSync(manifest)) throw new Error(`no sheets for ${file}: run "review.mjs sheets ${file}" first`)
  const made = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  const now = fingerprint(file)
  if (made.partial) throw new Error('the sheets cover only some clips (--clips): a verdict needs the whole film')
  if (made.fingerprint !== now) throw new Error(`the sheets were drawn from other scripts than ${file} has now: draw them again`)
  fs.writeFileSync(path.join(out, 'verdict.json'), JSON.stringify({ film: file, result, line, at: new Date().toISOString(), fingerprint: now }, null, 2) + '\n')
  console.log(`${file}: ${result}, ${line}`)
}

// Whether a film's verdict passes and still holds: null when it does, the reason otherwise
export function holdsBack (file) {
  const out = path.join(REVIEW_ROOT, nameOf(file))
  const verdictFile = path.join(out, 'verdict.json')
  if (!fs.existsSync(verdictFile)) return 'it has no review verdict'
  const told = JSON.parse(fs.readFileSync(verdictFile, 'utf8'))
  if (told.result !== 'pass') return `its review failed: ${told.line}`
  if (told.fingerprint !== fingerprint(file)) return 'its scripts changed after the review passed'
  return null
}

function status (only) {
  if (!fs.existsSync(REVIEW_ROOT)) return console.log('no film has been reviewed')
  for (const film of fs.readdirSync(REVIEW_ROOT)) {
    if (only && film !== only) continue
    const verdictFile = path.join(REVIEW_ROOT, film, 'verdict.json')
    const told = fs.existsSync(verdictFile) ? JSON.parse(fs.readFileSync(verdictFile, 'utf8')) : null
    console.log(`${film}: ${told ? `${told.result} at ${told.at}, ${told.line}` : 'sheets drawn, no verdict'}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = name => { const at = args.indexOf(name); return at < 0 ? null : args.splice(at, 2)[1] }
  const input = flag('--input')
  const every = Number(flag('--every') ?? 1.5)
  const clips = flag('--clips')
  const [job, file, ...rest] = args
  try {
    if (job === 'sheets' && file) sheets(file, { input, every, only: clips ? clips.split(',').map(Number) : null })
    else if (job === 'verdict' && file) verdict(file, rest[0], rest.slice(1).join(' '))
    else if (job === 'status') status(file)
    else throw new Error('review.mjs sheets <reel.json | film.js> [--input <lines.json>] [--every 1.5] [--clips 3,4] | verdict <film> pass|fail "<line>" | status [film]')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
