#!/usr/bin/env node
// The tools of the space MCP server from a shell, for a session that did not load the server
// (no space_guide, space_describe, space_check, space_preview, space_render among its tools). Run it from
// anywhere inside the repository; it needs the built page (pnpm build), Node 22+ and Chrome, Chromium or Edge.
//
//   node space.mjs guide
//   node space.mjs describe [word]
//   node space.mjs check <film> [out.json]  |  check <film> <film> ...
//   node space.mjs preview <film> <out.jpg> [seconds,seconds,...]
//   node space.mjs still <film> <out.jpg> <second> [width]   one frame as the render makes it, with no label,
//                                                          or shrunk to width pixels
//   node space.mjs render <film> <out.mp4> [medium|high|max] [audio file]
//
// A film is a .json file, or a script that plays it forward: a .js file. "--input <file.json>" anywhere on
// the line is what a script reads as input. check writes the JSON a script comes to when it is given a place.
// Several jobs of one command may follow one another on one line (check a.js b.js, preview a.js a.jpg -
// b.js b.jpg -); the browser is then started once, where each call starts its own (about a second). One
// line holds one command word: two commands, or two stills, are two calls. A seconds list of "-" leaves the choice of
// frames to the film: a frame of each shot, or nine spread over it. A preview prints the timeline a check
// does, so a film about to be previewed needs no check of its own.
//
// A zoom into the Mandelbrot set takes the same commands with "fractal-" before them (fractal-guide,
// fractal-check, fractal-preview, fractal-render) and a fractal film, a .json file or a .js script.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const USAGE = [
  'node space.mjs guide',
  'node space.mjs describe [word]',
  'node space.mjs check <film.json|film.js> [out.json]  |  check <film> <film> ...',
  'node space.mjs preview <film.json|film.js> <out.jpg> [seconds,seconds,...]',
  'node space.mjs still <film.json|film.js> <out.jpg> <second> [width]',
  'node space.mjs render <film.json|film.js> <out.mp4> [medium|high|max] [audio file]',
  'and --input <file.json> for what a script reads as input',
  'node space.mjs fractal-guide | fractal-check <fractal> [out.json] | fractal-preview <fractal> <out.jpg> [seconds,...] |',
  '  fractal-render <fractal> <out.mp4> [medium|high|max] [audio file]: a zoom into the Mandelbrot set, .json or .js'
].join('\n')

function findRoot () {
  for (const start of [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]) {
    for (let dir = start; ; dir = path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'mcp', 'space_mcp.mjs'))) return dir
      if (dir === path.dirname(dir)) break
    }
  }
  throw new Error('Run this inside the canvas-particles-space repository')
}

const isScript = file => /\.[cm]?js$/i.test(file)
const isFilm = file => isScript(file) || file.toLowerCase().endsWith('.json')

// The film a file holds, as the tools take it: a script as its text, a JSON film as its object
function readFilm (file, input) {
  try {
    const text = fs.readFileSync(file, 'utf8')
    if (!isScript(file)) return { film: JSON.parse(text) }
    return input === undefined ? { script: text } : { script: text, input }
  } catch (error) {
    throw new Error(`${file}: ${error.message}`)
  }
}

// One tool call for each job named on the command line
function readJobs (command, given) {
  if (command?.startsWith('fractal-')) {
    // The same jobs on the fractal tools, which take a fractal film the same two ways
    const kind = command.slice('fractal-'.length)
    if (!['guide', 'check', 'preview', 'render'].includes(kind)) throw new Error(USAGE)
    return readJobs(kind, given).map(job => ({ ...job, tool: job.tool.replace(/^space_/, 'space_fractal_') }))
  }
  const words = [...given]
  let input
  const flag = words.indexOf('--input')
  if (flag >= 0) {
    const [, file] = words.splice(flag, 2)
    if (!file) throw new Error('--input takes a JSON file')
    try {
      input = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      throw new Error(`${file}: ${error.message}`)
    }
  }
  if (command === 'guide') return [{ tool: 'space_guide', args: {} }]
  if (command === 'describe') return [{ tool: 'space_describe', args: words[0] ? { filter: words[0] } : {} }]
  const jobs = []
  if (command === 'check') {
    if (words.length === 0) throw new Error('check takes <film.json|film.js> [out.json], or several films')
    // The JSON a script comes to is written only for one script and its place: in a list of films a .json
    // word is a film, never a file to write over
    const [film, out] = words
    if (words.length === 2 && isScript(film) && out.toLowerCase().endsWith('.json')) {
      jobs.push({ tool: 'space_check', args: { ...readFilm(film, input), out: path.resolve(out) }, name: path.basename(film) })
    } else {
      for (const each of words) jobs.push({ tool: 'space_check', args: readFilm(each, input), name: path.basename(each) })
    }
  } else if (command === 'preview') {
    for (let at = 0; at < words.length;) {
      const [film, out, third] = words.slice(at, at + 3)
      if (!film || !out) throw new Error('preview takes <film> <out.jpg> [seconds,seconds,...]')
      // The third word is this job's seconds unless it is the next job's film
      const isTimes = third !== undefined && (third === '-' || /^[\d.,\s]+$/.test(third))
      const args = readFilm(film, input)
      if (isTimes && third !== '-') args.at = third.split(',').map(Number)
      jobs.push({ tool: 'space_preview', args, out: path.resolve(out), name: path.basename(film) })
      at += isTimes ? 3 : 2
    }
  } else if (command === 'still') {
    for (let at = 0; at < words.length;) {
      const [film, out, second, width] = words.slice(at, at + 4)
      if (!film || !out || !/^\d+(\.\d+)?$/.test(second ?? '')) throw new Error('still takes <film> <out.jpg> <second> [width]')
      const args = { ...readFilm(film, input), at: [Number(second)], still: true }
      // A whole number after the second is the width to shrink it to; the next job starts with a film's path
      const shrunk = width !== undefined && /^\d+$/.test(width)
      if (shrunk) args.stillWidth = Number(width)
      jobs.push({ tool: 'space_preview', args, out: path.resolve(out), name: path.basename(film) })
      at += shrunk ? 4 : 3
    }
  } else if (command === 'render') {
    const qualities = ['medium', 'high', 'max']
    for (let at = 0; at < words.length;) {
      const [film, out] = words.slice(at, at + 2)
      if (!film || !out) throw new Error('render takes <film> <out.mp4> [medium|high|max] [audio file]')
      at += 2
      const args = { ...readFilm(film, input), out: path.resolve(out) }
      if (qualities.includes(words[at])) args.quality = words[at++]
      if (words[at] !== undefined && !isFilm(words[at])) args.audio = path.resolve(words[at++])
      jobs.push({ tool: 'space_render', args, name: path.basename(film) })
    }
  }
  if (jobs.length === 0) throw new Error(USAGE)
  return jobs
}

const [command, ...words] = process.argv.slice(2)
let jobs
let root
try {
  root = findRoot()
  jobs = readJobs(command, words)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}

const server = spawn(process.execPath, [path.join(root, 'mcp', 'space_mcp.mjs')], { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] })
const waiting = new Map()
let nextId = 1
readline.createInterface({ input: server.stdout }).on('line', line => {
  const message = JSON.parse(line)
  if (message.id === undefined) return
  waiting.get(message.id)?.resolve(message)
  waiting.delete(message.id)
})
server.once('exit', () => {
  for (const pending of waiting.values()) pending.reject(new Error('The server stopped before it answered'))
  waiting.clear()
})
const call = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++
  waiting.set(id, { resolve, reject })
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
})

try {
  await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'space-scene-skill', version: '1' } })
  for (const job of jobs) {
    const reply = await call('tools/call', { name: job.tool, arguments: job.args })
    if (reply.error) throw new Error(reply.error.message)
    const { content, isError } = reply.result
    const text = content.filter(part => part.type === 'text').map(part => part.text).join('\n')
    const label = jobs.length > 1 ? `${job.name}: ` : ''
    if (isError) {
      console.log(`${label}FAILED: ${text}`)
      process.exitCode = 1
      continue
    }
    const image = content.find(part => part.type === 'image')
    if (image) {
      fs.mkdirSync(path.dirname(job.out), { recursive: true })
      fs.writeFileSync(job.out, Buffer.from(image.data, 'base64'))
      console.log(`${label}Wrote ${job.out}\n${text}`)
    } else {
      console.log(label + text)
    }
  }
} catch (error) {
  console.error('FAILED:', error.message)
  process.exitCode = 1
} finally {
  // Closing its input is how the server is told to leave; it then closes its browser and removes the profile
  server.stdin.end()
  // The timer is let go once the server has left: a pending one would hold this process for its ten seconds
  let timer
  await Promise.race([
    new Promise(resolve => server.once('exit', resolve)),
    new Promise(resolve => { timer = setTimeout(resolve, 10_000) })
  ])
  clearTimeout(timer)
  server.kill()
}
