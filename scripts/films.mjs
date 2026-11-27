#!/usr/bin/env node
// The films of films/, one folder each (films/README.md holds the layout and meta.json's keys): where a film's
// file is, who made it, and whether the folder keeps the layout. The other scripts import the finders; the
// commands are for agents and the lint:
//
//   node scripts/films.mjs list                       every film: its kind, its parts and the models that made it
//   node scripts/films.mjs check                      the layout, every meta.json and every films/ path written
//                                                     in the films and the docs; part of pnpm lint
//   node scripts/films.mjs new <film> --kind film|reel|fractal --title "<title>" --about "<one line>"
//                              --model <id> --did "<what>" [--agent "<name>"] [--file <name>.js|.json]
//                                                     a folder and its meta.json for a new film; the film's own
//                                                     file is then written into it
//   node scripts/films.mjs new <film> --take <take> --model <id> --did "<what>" [--file <name>]
//                                                     another attempt at the film's brief, in takes/<take>/
//   node scripts/films.mjs made <film>[/<take>] --model <id> --did "<what>" [--agent "<name>"]
//                                                     one more line in the film's record of who made it
//   node scripts/films.mjs where <film>               the path of the film's own file
//   node scripts/films.mjs audio <film>[/<take>] <sound file> [--for <file>] [--mono]
//                                                     the film's sound for the page: the file (a wav, an mp3...)
//                                                     made into audio/<name>.m4a, named in meta.json's "audio"
//                                                     for the film's own file or the one --for names
//                                                     (voices/ru.json); --mono for a voice alone
//   node scripts/films.mjs tidy [--dry]               moves the renders left loose in films/ into the out/ of
//                                                     the film they are named after
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const filmsDir = path.join(root, 'films')

// Folders of films/ that are not films: the narration's takes, renders without a film
const NOT_FILMS = new Set(['voice', 'out'])
// The folders of a film that hold parts of it to play: a reel's clips, the reels another voice paces, posters
const PARTS = ['clips', 'voices', 'posters']
export const KINDS = ['film', 'reel', 'fractal']
const META_KEYS = ['title', 'about', 'kind', 'film', 'made', 'brief', 'scores', 'audio']
// The sound a film plays on the page: AAC in an MP4 box, which every current browser streams and decodes, its
// index at the head so it plays before it is all there. Speech alone in one channel; a voice over music in two
export const AUDIO_FILE = /\.m4a$/i
const AUDIO_BITRATE = { mono: '64k', stereo: '128k' }
const MADE_KEYS = ['model', 'agent', 'at', 'did', 'commits', 'last', 'from']
const RENDERS = /\.(mp4|webm|mov|wav|mp3|jpe?g)$/i
const FILM_FILE = /\.(json|js)$/i
const MODEL = /^[a-z0-9][a-z0-9.-]*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const slash = file => file.replaceAll(path.sep, '/')
// Today in Moscow, the operator's day
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)

export function readMeta (folder) {
  const file = path.join(folder, 'meta.json')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

// The film folders of films/, by name
export function filmNames () {
  if (!fs.existsSync(filmsDir)) return []
  return fs.readdirSync(filmsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !NOT_FILMS.has(entry.name) && fs.existsSync(path.join(filmsDir, entry.name, 'meta.json')))
    .map(entry => entry.name)
    .sort()
}

// The takes of a film: other attempts at its brief, each a folder of the film's shape
export function takeNames (film) {
  const folder = path.join(filmsDir, film, 'takes')
  if (!fs.existsSync(folder)) return []
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(folder, entry.name, 'meta.json')))
    .map(entry => entry.name)
    .sort()
}

// The file of a film given by its name ("kerr_around"), its folder ("films/kerr_around"), a take
// ("fourth_dimension/takes/b"), a loose file of films/ ("_lab_x.js") or any path to a file; null when none
export function findFilm (given) {
  const name = slash(given.trim()).replace(/\/+$/, '')
  const candidates = [path.resolve(name), path.join(filmsDir, name.replace(/^films\//, ''))]
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      const withExtension = ['.js', '.json'].map(ext => candidate + ext).find(file => fs.existsSync(file))
      if (withExtension) return withExtension
      continue
    }
    if (fs.statSync(candidate).isFile()) return candidate
    const meta = path.join(candidate, 'meta.json')
    if (fs.existsSync(meta)) {
      const file = readMeta(candidate).film
      if (typeof file === 'string') return path.join(candidate, file)
    }
  }
  return null
}

// Every file of films/ that is a film or a part of one, by its path in films/: the files at a film folder's
// top (its own and any other cut of it), its clips/, voices/ and posters/, each take's files, and the loose
// scratch films at the top of films/. Data a film reads (last_parsec's letters/) is none. The page's library
// bundles the same files (PLAYABLE in src/lib/film_library.ts)
export function filmFiles () {
  const found = []
  const add = (folder, depth) => {
    if (!fs.existsSync(folder)) return
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isFile() && FILM_FILE.test(entry.name) && entry.name !== 'meta.json') found.push(slash(path.relative(filmsDir, path.join(folder, entry.name))))
      else if (entry.isDirectory() && depth > 0) add(path.join(folder, entry.name), depth - 1)
    }
  }
  if (!fs.existsSync(filmsDir)) return found
  add(filmsDir, 0)
  for (const name of filmNames()) {
    const folder = path.join(filmsDir, name)
    add(folder, 0)
    for (const part of PARTS) add(path.join(folder, part), 0)
    for (const take of takeNames(name)) add(path.join(folder, 'takes', take), 0)
  }
  return found.sort()
}

// What a film's text is, read the way the page reads it (film_live.ts): a reel has clips, a fractal film a target
export function kindOfText (name, text) {
  if (/\.json$/i.test(name)) {
    try {
      const film = JSON.parse(text)
      if (Array.isArray(film?.clips)) return 'reel'
      return typeof film?.target === 'string' || film?.orbit !== undefined ? 'fractal' : 'film'
    } catch {
      return null
    }
  }
  return /\bfilm\s*\(\s*\{[^)]*\btarget\s*:/.test(text) ? 'fractal' : 'film'
}

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

// ---- check ----

function checkMade (made, where, problems) {
  if (!Array.isArray(made) || made.length === 0) {
    problems.push(`${where}: "made" is the list of who made the film, at least one line ({ model, at, did })`)
    return
  }
  made.forEach((line, index) => {
    const at = `${where} made[${index}]`
    if (typeof line !== 'object' || line === null) return problems.push(`${at}: not an object`)
    for (const key of Object.keys(line)) if (!MADE_KEYS.includes(key)) problems.push(`${at}: unknown key "${key}" (${MADE_KEYS.join(', ')})`)
    if (typeof line.model !== 'string' || !MODEL.test(line.model)) problems.push(`${at}: "model" is the model's id in lower case, as claude-opus-5-5 (or "unknown")`)
    if (typeof line.at !== 'string' || !DATE.test(line.at)) problems.push(`${at}: "at" is a date, YYYY-MM-DD`)
    if (typeof line.did !== 'string' || line.did.trim() === '') problems.push(`${at}: "did" says in a line what was done`)
    if (line.agent !== undefined && (typeof line.agent !== 'string' || line.agent.trim() === '')) problems.push(`${at}: "agent" names the harness, as "Claude Code"`)
    if (line.last !== undefined && (typeof line.last !== 'string' || !DATE.test(line.last))) problems.push(`${at}: "last" is a date, YYYY-MM-DD`)
    if (line.commits !== undefined && !(Number.isInteger(line.commits) && line.commits > 0)) problems.push(`${at}: "commits" is a count`)
  })
}

// One folder of a film or of a take: its meta.json and its own file
function checkFolder (folder, where, isTake, problems) {
  let meta
  try {
    meta = readMeta(folder)
  } catch (error) {
    problems.push(`${where}/meta.json: ${fs.existsSync(path.join(folder, 'meta.json')) ? `not JSON: ${error.message}` : 'missing'}`)
    return
  }
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return problems.push(`${where}/meta.json: not an object`)
  for (const key of Object.keys(meta)) if (!META_KEYS.includes(key)) problems.push(`${where}/meta.json: unknown key "${key}" (${META_KEYS.join(', ')})`)
  for (const key of isTake ? [] : ['title', 'about']) {
    if (typeof meta[key] !== 'string' || meta[key].trim() === '') problems.push(`${where}/meta.json: "${key}" is a line of text`)
  }
  if (!KINDS.includes(meta.kind)) problems.push(`${where}/meta.json: "kind" is one of ${KINDS.join(', ')}`)
  if (typeof meta.film !== 'string' || !FILM_FILE.test(meta.film)) {
    problems.push(`${where}/meta.json: "film" names the film's own .js or .json file in the folder`)
  } else if (!fs.existsSync(path.join(folder, meta.film))) {
    problems.push(`${where}/meta.json: "film" names ${meta.film}, which is not in the folder`)
  } else {
    const kind = kindOfText(meta.film, fs.readFileSync(path.join(folder, meta.film), 'utf8'))
    if (kind === null) problems.push(`${where}/${meta.film}: not JSON`)
    else if (KINDS.includes(meta.kind) && kind !== meta.kind) problems.push(`${where}/meta.json: "kind" is ${meta.kind}, but ${meta.film} reads as a ${kind}`)
  }
  if (meta.brief !== undefined && (typeof meta.brief !== 'string' || !fs.existsSync(path.join(folder, meta.brief)))) {
    problems.push(`${where}/meta.json: "brief" names a file of the folder, the task every take is given`)
  }
  if (meta.scores !== undefined && !Array.isArray(meta.scores)) problems.push(`${where}/meta.json: "scores" is a list`)
  if (meta.audio !== undefined) {
    if (typeof meta.audio !== 'object' || meta.audio === null || Array.isArray(meta.audio)) {
      problems.push(`${where}/meta.json: "audio" maps a file of the folder to its sound: { "<film>.json": "audio/<name>.m4a" }`)
    } else {
      for (const [file, sound] of Object.entries(meta.audio)) {
        if (!FILM_FILE.test(file) || !fs.existsSync(path.join(folder, file))) problems.push(`${where}/meta.json: "audio" names ${file}, which is not a film of the folder`)
        if (typeof sound !== 'string' || !AUDIO_FILE.test(sound)) problems.push(`${where}/meta.json: the sound of ${file} is an .m4a file (node scripts/films.mjs audio)`)
        else if (!fs.existsSync(path.join(folder, sound))) problems.push(`${where}/meta.json: the sound of ${file}, ${sound}, is not in the folder`)
      }
    }
  }
  checkMade(meta.made, `${where}/meta.json`, problems)
}

// films/<path> written in a text: a film, a part or a picture. Renders, the takes of the narration and
// placeholders are not looked for
const WRITTEN = /films\/[\w./-]+\.(?:json|js|mjs|png|jpe?g|webp|gif|avif|py|md)\b/g
const NOT_LOOKED_FOR = /^films\/(?:voice\/|out\/|_lab_)|\/out\/|\.(?:jpe?g)$/
// Docs whose films/ paths are only examples of the format
const EXAMPLES = new Set(['src/lib/film.ts'])

function checkWritten (problems) {
  const listed = git('ls-files', 'films', '.claude/skills', 'docs', 'CLAUDE.md', 'README.md', 'scripts', 'mcp', 'src')
  const files = listed === null
    ? filmFiles().map(file => `films/${file}`)
    : listed.split('\n').filter(file => /\.(js|mjs|cjs|json|md|py|ts|tsx|sh)$/.test(file) && fs.existsSync(path.join(root, file)))
  for (const file of files) {
    // A meta.json's record quotes the subjects of old commits, paths of the old layout among them
    if (EXAMPLES.has(file) || file === 'scripts/films.mjs' || file.endsWith('/meta.json')) continue
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      for (const [written] of line.matchAll(WRITTEN)) {
        const clean = written.replace(/[.]+$/, '')
        if (NOT_LOOKED_FOR.test(clean)) continue
        if (!fs.existsSync(path.join(root, clean))) problems.push(`${file}:${index + 1}: ${clean} is not there`)
      }
    })
  }
}

export function checkFilms () {
  const problems = []
  if (!fs.existsSync(filmsDir)) return problems
  // Only folders at the top: a loose file in git is a film without a folder (scratch films stay out of git)
  const tracked = git('ls-files', 'films')
  if (tracked !== null) {
    for (const file of tracked.split('\n').filter(Boolean)) {
      const parts = file.split('/')
      if (parts.length === 2 && parts[1] !== 'README.md') problems.push(`${file}: a film lives in a folder of its own, films/<film>/ (films/README.md)`)
      if (parts.length > 2 && !NOT_FILMS.has(parts[1]) && !fs.existsSync(path.join(filmsDir, parts[1], 'meta.json'))) {
        problems.push(`films/${parts[1]}/: no meta.json (node scripts/films.mjs new ${parts[1]} ...)`)
      }
    }
  }
  for (const name of filmNames()) {
    checkFolder(path.join(filmsDir, name), `films/${name}`, false, problems)
    for (const take of takeNames(name)) checkFolder(path.join(filmsDir, name, 'takes', take), `films/${name}/takes/${take}`, true, problems)
  }
  checkWritten(problems)
  return [...new Set(problems)]
}

// ---- the commands ----

function options (words) {
  const named = {}
  const rest = []
  for (let index = 0; index < words.length; index++) {
    const word = words[index]
    if (word.startsWith('--')) {
      const key = word.slice(2)
      const next = words[index + 1]
      if (next === undefined || next.startsWith('--')) named[key] = true
      else {
        named[key] = next
        index++
      }
    } else {
      rest.push(word)
    }
  }
  return { named, rest }
}

function madeLine (named) {
  if (typeof named.model !== 'string' || !MODEL.test(named.model)) throw new Error('--model <id>: the model\'s id in lower case, as claude-opus-5-5')
  if (typeof named.did !== 'string' || named.did.trim() === '') throw new Error('--did "<what>": what was done, in a line')
  return { model: named.model, ...(typeof named.agent === 'string' ? { agent: named.agent } : {}), at: today(), did: named.did.trim() }
}

const writeMeta = (folder, meta) => fs.writeFileSync(path.join(folder, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')

// The folder a film or a take is named by: "kerr_around", "films/kerr_around", "fourth_dimension/b"
function folderOf (given) {
  const name = slash(given).replace(/^films\//, '').replace(/\/+$/, '')
  const [film, ...take] = name.split('/').filter(part => part !== 'takes')
  const folder = take.length > 0 ? path.join(filmsDir, film, 'takes', take.join('/')) : path.join(filmsDir, film)
  if (!fs.existsSync(path.join(folder, 'meta.json'))) throw new Error(`No ${slash(path.relative(root, folder))}/meta.json: node scripts/films.mjs new ${name} ...`)
  return folder
}

function list () {
  const rows = filmNames().map(name => {
    const folder = path.join(filmsDir, name)
    const meta = readMeta(folder)
    const parts = filmFiles().filter(file => file.startsWith(`${name}/`) && file !== `${name}/${meta.film}`).length
    const takes = takeNames(name)
    const models = [...new Set([meta, ...takes.map(take => readMeta(path.join(folder, 'takes', take)))].flatMap(each => (each.made ?? []).map(line => line.model)))]
    return [name, meta.kind, String(parts), String(takes.length), models.join(', '), meta.title]
  })
  const head = ['FILM', 'KIND', 'PARTS', 'TAKES', 'MADE BY', 'TITLE']
  const widths = head.map((title, column) => Math.max(title.length, ...rows.map(row => row[column].length)))
  for (const row of [head, ...rows]) console.log(row.map((cell, column) => column === row.length - 1 ? cell : cell.padEnd(widths[column])).join('  '))
}

function create (name, named) {
  if (!/^[a-z0-9][a-z0-9_]*$/.test(name)) throw new Error('A film\'s name is lower case letters, digits and _: it names its folder and its file')
  const line = madeLine(named)
  if (typeof named.take === 'string') {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(named.take)) throw new Error('A take\'s name is lower case letters, digits, _ and -')
    const film = folderOf(name)
    const own = readMeta(film)
    const folder = path.join(film, 'takes', named.take)
    if (fs.existsSync(folder)) throw new Error(`${slash(path.relative(root, folder))} is there already`)
    fs.mkdirSync(folder, { recursive: true })
    const file = typeof named.file === 'string' ? named.file : own.film
    writeMeta(folder, { kind: own.kind, film: file, made: [line] })
    console.log(`Made films/${name}/takes/${named.take}/meta.json: write the take into films/${name}/takes/${named.take}/${file}`)
    return
  }
  const folder = path.join(filmsDir, name)
  if (fs.existsSync(folder)) throw new Error(`films/${name} is there already`)
  const kind = typeof named.kind === 'string' ? named.kind : 'film'
  if (!KINDS.includes(kind)) throw new Error(`--kind is one of ${KINDS.join(', ')}`)
  for (const key of ['title', 'about']) if (typeof named[key] !== 'string') throw new Error(`--${key} "<text>" is asked for`)
  const file = typeof named.file === 'string' ? named.file : `${name}.${kind === 'reel' ? 'json' : 'js'}`
  if (!FILM_FILE.test(file)) throw new Error('--file is a .js or .json name')
  fs.mkdirSync(folder, { recursive: true })
  writeMeta(folder, { title: named.title, about: named.about, kind, film: file, made: [line] })
  console.log(`Made films/${name}/meta.json: write the film into films/${name}/${file}`)
}

function made (name, named) {
  const folder = folderOf(name)
  const meta = readMeta(folder)
  meta.made = [...(Array.isArray(meta.made) ? meta.made : []), madeLine(named)]
  writeMeta(folder, meta)
  console.log(`${slash(path.relative(root, folder))}/meta.json: ${meta.made.length} lines in "made"`)
}

// The ffmpeg the film server uses: SPACE_FFMPEG, ~/.space-film, or the PATH
function findFfmpeg () {
  const exe = process.platform === 'win32' ? '.exe' : ''
  if (process.env.SPACE_FFMPEG) return process.env.SPACE_FFMPEG
  return [path.join(os.homedir(), '.space-film'), ...(process.env.PATH ?? '').split(path.delimiter)]
    .map(dir => path.join(dir, `ffmpeg${exe}`)).find(file => fs.existsSync(file)) ?? null
}

// Makes `sound` (any file ffmpeg reads) the sound of `file`, a film of the folder `film` ("fourth_dimension_pop",
// or "<film>/<take>"): audio/<name>.m4a beside it, AAC at the bitrate its channels ask (`mono` for a voice
// alone, whose wav repeats one channel in two), named in the folder's meta.json under "audio". Returns the path
// written. scripts/voice.mjs calls it after every mix, so the page plays the narration the mix made
export function attachAudio ({ film, file, sound, mono = false }) {
  const folder = folderOf(film)
  const meta = readMeta(folder)
  const own = file ?? meta.film
  if (!fs.existsSync(path.join(folder, own))) throw new Error(`${own} is not a film of ${slash(path.relative(root, folder))}`)
  if (!fs.existsSync(sound)) throw new Error(`No sound at ${sound}`)
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) throw new Error('No ffmpeg: set SPACE_FFMPEG, or put it in ~/.space-film or on the PATH')
  const name = `audio/${path.basename(own).replace(FILM_FILE, '')}.m4a`
  const out = path.join(folder, name)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const made = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', sound, '-vn',
    ...(mono ? ['-ac', '1'] : []), '-c:a', 'aac', '-b:a', AUDIO_BITRATE[mono ? 'mono' : 'stereo'],
    // The index first, so the page plays it as it comes; no encoder's name or date, so the same sound is the same bytes
    '-movflags', '+faststart', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out
  ], { encoding: 'utf8' })
  if (made.status !== 0) throw new Error(`ffmpeg could not make ${name}: ${made.stderr.trim()}`)
  meta.audio = { ...(meta.audio ?? {}), [slash(own)]: name }
  writeMeta(folder, meta)
  return out
}

// Renders written straight into films/ (the habit of the flat layout) go to the out/ of the film whose name
// they start with; one no film claims goes to films/out/. Only files out of git are moved
function tidy (dry) {
  const untracked = new Set((git('ls-files', '--others', 'films') ?? '').split('\n').filter(Boolean).map(file => file.split('/').pop()))
  const names = filmNames().sort((a, b) => b.length - a.length)
  let moved = 0
  for (const file of fs.readdirSync(filmsDir)) {
    const full = path.join(filmsDir, file)
    if (!fs.statSync(full).isFile() || !RENDERS.test(file) || !untracked.has(file)) continue
    const stem = file.replace(/\.[^.]+$/, '')
    const owner = names.find(name => stem === name || stem.startsWith(`${name}_`))
    const target = owner ? path.join(filmsDir, owner, 'out', file) : path.join(filmsDir, 'out', file)
    if (fs.existsSync(target)) {
      console.log(`kept ${file}: ${slash(path.relative(root, target))} is there already`)
      continue
    }
    console.log(`${dry ? 'would move' : 'moved'} films/${file} -> ${slash(path.relative(root, target))}`)
    if (!dry) {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.renameSync(full, target)
    }
    moved++
  }
  console.log(`${moved} render${moved === 1 ? '' : 's'} ${dry ? 'to move' : 'moved'}`)
}

function main () {
  const [command, ...words] = process.argv.slice(2)
  const { named, rest } = options(words)
  if (command === 'list') return list()
  if (command === 'check') {
    const problems = checkFilms()
    for (const problem of problems) console.log(problem)
    console.log(`films: ${filmNames().length} films, ${problems.length === 0 ? 'the layout holds' : `${problems.length} problem${problems.length === 1 ? '' : 's'}`}`)
    if (problems.length > 0) process.exitCode = 1
    return
  }
  if (command === 'new' && rest[0]) return create(rest[0], named)
  if (command === 'made' && rest[0]) return made(rest[0], named)
  if (command === 'where' && rest[0]) {
    const file = findFilm(rest[0])
    if (!file) throw new Error(`No film ${rest[0]}`)
    return console.log(slash(path.relative(root, file)))
  }
  if (command === 'audio' && rest[0] && rest[1]) {
    const out = attachAudio({ film: rest[0], file: typeof named.for === 'string' ? named.for : undefined, sound: path.resolve(rest[1]), mono: named.mono === true })
    return console.log(`Wrote ${slash(path.relative(root, out))}: ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`)
  }
  if (command === 'tidy') return tidy(named.dry === true)
  // The head of this file, down to its first import
  const lines = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split(/\r?\n/)
  console.log(lines.slice(1, lines.findIndex(line => line.startsWith('import'))).map(line => line.replace(/^\/\/ ?/, '')).join('\n'))
  process.exitCode = command ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
