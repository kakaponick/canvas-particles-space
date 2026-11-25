#!/usr/bin/env node
// The four tools of the space MCP server from a shell, for a session that did not load the server
// (no space_guide, space_describe, space_preview, space_render among its tools). Run it from anywhere
// inside the repository; it needs the built page (pnpm build), Node 22+ and Chrome, Chromium or Edge.
//
//   node space.mjs guide
//   node space.mjs describe [word]
//   node space.mjs preview <film.json> <out.jpg> [seconds,seconds,...]
//   node space.mjs render <film.json> <out.mp4> [medium|high|max] [audio file]
//
// Several preview or render jobs may follow one another on one line, three or four words each; the
// browser is then started once. A seconds list of "-" spreads nine frames over the film.
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
  'node space.mjs preview <film.json> <out.jpg> [seconds,seconds,...]',
  'node space.mjs render <film.json> <out.mp4> [medium|high|max] [audio file]'
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

function readFilm (file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file}: ${error.message}`)
  }
}

// One tool call for each job named on the command line
function readJobs (command, words) {
  if (command === 'guide') return [{ tool: 'space_guide', args: {} }]
  if (command === 'describe') return [{ tool: 'space_describe', args: words[0] ? { filter: words[0] } : {} }]
  const jobs = []
  if (command === 'preview') {
    for (let at = 0; at < words.length;) {
      const [film, out, third] = words.slice(at, at + 3)
      if (!film || !out) throw new Error('preview takes <film.json> <out.jpg> [seconds,seconds,...]')
      // The third word is this job's seconds unless it is the next job's film
      const isTimes = third !== undefined && (third === '-' || /^[\d.,\s]+$/.test(third))
      const args = { film: readFilm(film) }
      if (isTimes && third !== '-') args.at = third.split(',').map(Number)
      jobs.push({ tool: 'space_preview', args, out: path.resolve(out), name: path.basename(film) })
      at += isTimes ? 3 : 2
    }
  } else if (command === 'render') {
    const qualities = ['medium', 'high', 'max']
    for (let at = 0; at < words.length;) {
      const [film, out] = words.slice(at, at + 2)
      if (!film || !out) throw new Error('render takes <film.json> <out.mp4> [medium|high|max] [audio file]')
      at += 2
      const args = { film: readFilm(film), out: path.resolve(out) }
      if (qualities.includes(words[at])) args.quality = words[at++]
      if (words[at] !== undefined && !words[at].toLowerCase().endsWith('.json')) args.audio = path.resolve(words[at++])
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
  await Promise.race([new Promise(resolve => server.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 10_000))])
  server.kill()
}
