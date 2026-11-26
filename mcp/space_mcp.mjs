#!/usr/bin/env node
// MCP server that turns the scene into short videos. It serves the built page (dist/) from this machine,
// keeps one headless Chrome on it and gives an agent five tools: space_guide (how to write a film),
// space_describe (what can be set), space_check (what a film will be, without drawing it), space_preview
// (a contact sheet of frames, or one clean frame as a still) and space_render (the mp4). A film comes as its JSON or as a script that
// writes it. Four more do the same for a zoom into the Mandelbrot set (space_fractal_guide, _check,
// _preview, _render). The page does the work through window.space.film and window.space.fractal; this
// file only carries text in and files out.
// No dependencies: the protocol is JSON-RPC lines on stdio, the browser is driven over its DevTools socket.
// A preview or a render waits its turn with the measurements of scripts/bench.mjs (scripts/turn.mjs), so a
// film is never drawn while a build is being measured on this machine.
//
//   node mcp/space_mcp.mjs          after `pnpm build`; .mcp.json starts it for Claude Code
//   SPACE_DIST=path                 another build of the page
//   CHROME_PATH=path                another Chrome, Chromium or Edge
//
// On a machine with Electron and an ffmpeg that has h264_nvenc, a render is encoded outside the browser,
// which is what makes 4K fast (findLocalEncoder; docs/films.md says where the two are looked for):
//   SPACE_ELECTRON=path             Electron's program
//   SPACE_FFMPEG=path               ffmpeg
//   SPACE_BROWSER_ENCODER=1         Chrome and its own encoder, as on a machine without them
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { spawn, spawnSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'
import { takeTurn } from '../scripts/turn.mjs'

const SERVER = { name: 'space-film', version: '1.0.0' }
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.resolve(process.env.SPACE_DIST ?? path.join(ROOT, 'dist'))
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac'
}
const PAGE_READY_MS = 30_000
const PROGRESS_EVERY_MS = 1000

const INSTRUCTIONS = 'Makes 1-180 s videos of a black-hole particle scene from a "film": one JSON object, or a short ' +
  'script that plays the film forward. Call space_guide first for both and their recipes, space_describe to find ' +
  'setting names, space_check to read a film back as a timeline, space_preview to look at frames, then space_render ' +
  'to write the mp4. A film with "clips" is a reel: several films and fractal films cut, faded or dissolved into ' +
  'one video of up to 600 s. The space_fractal_ tools make a zoom into the Mandelbrot set the same way, as deep as asked: ' +
  'space_fractal_guide first.'

// A film comes one of two ways, and every tool that takes a film takes either
const FILM_INPUT = {
  film: { type: 'object', description: 'The film as JSON, as space_guide describes it', additionalProperties: true },
  script: { type: 'string', description: 'The film as a script instead: JavaScript that plays it forward, as space_guide describes it' },
  input: { type: 'object', description: 'What a script reads as "input": one script, several films', additionalProperties: true }
}

// A fractal film comes the same two ways
const FRACTAL_INPUT = {
  film: { type: 'object', description: 'The fractal film as JSON, as space_fractal_guide describes it', additionalProperties: true },
  script: { type: 'string', description: 'The fractal film as a script instead: JavaScript that plays it forward, as space_fractal_guide describes it' },
  input: { type: 'object', description: 'What a script reads as "input"', additionalProperties: true }
}

// For a reel: its dissolves hold two scenes at once unless this asks for one
const ONE_SCENE = { type: 'boolean', description: 'For a reel (a film with "clips"): play every dissolve through black, so two scenes are never drawn at once' }

const TOOLS = [
  {
    name: 'space_guide',
    description: 'How to write a film for the scene: the JSON format, the script language, a reel of several films in one video, and ready recipes. Read it first.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'space_describe',
    description: 'What a film can set and animate: settings, intro parameters and presets, with ranges. ' +
      'Without a filter it lists every key in one line each; a filter word ("lens", "ring", "title", "orbit") gives the full meaning of the matches.',
    inputSchema: {
      type: 'object',
      properties: { filter: { type: 'string', description: 'A word to search keys, names and descriptions for' } }
    }
  },
  {
    name: 'space_check',
    description: 'Reads a film without drawing it, in a moment: its length and frame, the timeline it was understood as ' +
      '(one line for each thing, in the order it happens), what was adjusted, and every mistake at once. ' +
      'For a script also the seconds it marked, and the JSON it comes to when "out" names a file for it.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FILM_INPUT,
        out: { type: 'string', description: 'Path of a .json file to write the film a script comes to; relative paths start at the working directory' }
      }
    }
  },
  {
    name: 'space_preview',
    description: 'Draws frames of a film side by side in one picture, each with its second, exactly as the render will make them. ' +
      'A film cut into shots is shown as its storyboard: one frame from the middle of each shot, with its name. ' +
      'Use it to check a film before rendering. With "still" it draws one frame as it is, for a poster or a YouTube thumbnail.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FILM_INPUT,
        at: { type: 'array', items: { type: 'number' }, description: 'Seconds to show; a frame of each shot, or evenly spread, when left out' },
        frames: { type: 'number', description: 'How many frames to spread evenly over the film when "at" is left out (default 9)' },
        still: { type: 'boolean', description: 'One frame, the first second of "at", at the film\'s own size and with no label: a picture to use as it is' },
        stillWidth: { type: 'number', description: 'A still shrunk to this many pixels wide, to judge a poster at the size a feed shows it (168)' },
        out: { type: 'string', description: 'Where to write the picture as a .jpg as well; relative paths start at the working directory' },
        oneScene: ONE_SCENE
      }
    }
  },
  {
    name: 'space_render',
    description: 'Renders a film to an mp4 file (H.264) and reports its length, size and anything it adjusted.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FILM_INPUT,
        out: { type: 'string', description: 'Path of the mp4 to write; relative paths start at the working directory' },
        quality: { type: 'string', enum: ['medium', 'high', 'max'], description: 'Bitrate; high by default' },
        audio: { type: 'string', description: 'Path of an audio file (mp3, wav, m4a, ogg) laid under the picture from its start' },
        oneScene: ONE_SCENE
      },
      required: ['out']
    }
  },
  {
    name: 'space_fractal_guide',
    description: 'How to write a fractal film: a zoom into the Mandelbrot set, to any depth, as one JSON object. Read it first.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'space_fractal_check',
    description: 'Reads a fractal film without drawing it: the target found and its digits, the precision, the zoom over time, ' +
      'the tracks, captions and shots, the steps a pixel takes, what was adjusted, and every mistake at once. ' +
      'For a script also the seconds it marked, and the JSON it comes to when "out" names a file for it.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FRACTAL_INPUT,
        out: { type: 'string', description: 'Path of a .json file to write the film a script comes to; relative paths start at the working directory' }
      }
    }
  },
  {
    name: 'space_fractal_preview',
    description: 'Draws frames of a fractal film side by side in one picture, each with its second, magnification and steps, ' +
      'exactly as the render will make them, and the milliseconds a frame took.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FRACTAL_INPUT,
        at: { type: 'array', items: { type: 'number' }, description: 'Seconds to show; evenly spread when left out' },
        frames: { type: 'number', description: 'How many frames to spread evenly over the film when "at" is left out (default 9)' }
      }
    }
  },
  {
    name: 'space_fractal_render',
    description: 'Renders a fractal film to an mp4 file (H.264) and reports its length, size, depth and anything it adjusted.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FRACTAL_INPUT,
        out: { type: 'string', description: 'Path of the mp4 to write; relative paths start at the working directory' },
        quality: { type: 'string', enum: ['medium', 'high', 'max'], description: 'Bitrate; high by default' },
        audio: { type: 'string', description: 'Path of an audio file (mp3, wav, m4a, ogg) laid under the picture from its start' }
      },
      required: ['out']
    }
  }
]

// ---- The page: a static server for dist/ and one headless Chrome on it ----

function findChrome () {
  const fromEnv = process.env.CHROME_PATH
  if (fromEnv) return fromEnv
  const home = os.homedir()
  const candidates = process.platform === 'win32'
    ? [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        path.join(process.env.LOCALAPPDATA ?? path.join(home, 'AppData/Local'), 'Google/Chrome/Application/chrome.exe'),
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ]
      : (process.env.PATH ?? '').split(path.delimiter).flatMap(dir =>
          ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].map(name => path.join(dir, name)))
  const found = candidates.find(candidate => fs.existsSync(candidate))
  if (!found) throw new Error('No Chrome, Chromium or Edge found. Set CHROME_PATH to the browser to use.')
  return found
}

// A machine that encodes outside the browser: Electron as the page's browser (local_host.cjs), which lets
// the page write frames into ffmpeg, and an ffmpeg that reaches the graphics card's H.264 encoder. Each is
// named by its variable or stands in ~/.space-film (electron/, ffmpeg); ffmpeg may also be on the PATH.
// Null without either, and where the card's encoder does not answer: the film is then Chrome's to encode
function findLocalEncoder () {
  if (process.env.SPACE_BROWSER_ENCODER === '1') return null
  const home = path.join(os.homedir(), '.space-film')
  const exe = process.platform === 'win32' ? '.exe' : ''
  const electron = process.env.SPACE_ELECTRON ??
    path.join(home, 'electron', process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : `electron${exe}`)
  const ffmpeg = process.env.SPACE_FFMPEG ?? [home, ...(process.env.PATH ?? '').split(path.delimiter)]
    .map(dir => path.join(dir, `ffmpeg${exe}`)).find(file => fs.existsSync(file))
  if (!ffmpeg || !fs.existsSync(electron) || !fs.existsSync(ffmpeg)) return null
  // One black frame through the card's encoder: ffmpeg may be built without it, the machine may have no such card
  const tried = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x256:r=30', '-frames:v', '1',
    '-c:v', 'h264_nvenc', '-f', 'null', '-'
  ], { stdio: 'ignore', timeout: 15_000, windowsHide: true })
  return tried.status === 0 ? { electron, ffmpeg } : null
}

let studio = null

async function openStudio () {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error(`The page is not built: ${DIST} has no index.html. Run "pnpm build" in ${ROOT} first.`)
  }
  if (typeof WebSocket !== 'function') throw new Error('Node 22 or newer is needed (it has WebSocket built in).')

  // Files that go in (audio) and come out (the mp4) pass through this server under one-off tokens
  const uploads = new Map()
  const downloads = new Map()
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const [, area, kind, token] = url.pathname.split('/')
    if (area === '__film' && kind === 'upload' && request.method === 'POST' && uploads.has(token)) {
      // The page sends the file as it encodes it, a piece at a time with the place the piece belongs at
      // ("at"); the last pieces go back to the start to fill in the index, so pieces are written in place
      const target = uploads.get(token)
      let position = Number(url.searchParams.get('at') ?? 0)
      const refuse = error => {
        target.error ??= error
        if (!response.headersSent) response.writeHead(500).end(String(error))
        request.destroy()
      }
      if (!Number.isSafeInteger(position) || position < 0) return refuse(new Error('at takes a place in the file'))
      try {
        target.file ??= fs.openSync(target.path, 'w+')
      } catch (error) {
        return refuse(error)
      }
      request.on('data', piece => {
        try {
          fs.writeSync(target.file, piece, 0, piece.length, position)
          position += piece.length
        } catch (error) {
          refuse(error)
        }
      })
      request.on('end', () => {
        if (target.error) return
        target.written = true
        response.writeHead(204).end()
      })
      return
    }
    if (area === '__film' && kind === 'file' && downloads.has(token)) {
      const source = downloads.get(token)
      response.writeHead(200, { 'content-type': MIME[path.extname(source).toLowerCase()] ?? 'application/octet-stream' })
      fs.createReadStream(source).pipe(response)
      return
    }
    let file = path.resolve(DIST, '.' + decodeURIComponent(url.pathname))
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    response.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(response)
  })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'space-film-'))
  const flags = [
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    // The film is drawn with the graphics card, and nothing may slow the page while no one looks at it
    '--ignore-gpu-blocklist', '--enable-gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required'
  ]
  const local = findLocalEncoder()
  // Electron started from a program that is itself Electron run as Node would run as Node too
  const { ELECTRON_RUN_AS_NODE: _asNode, ...env } = process.env
  const chrome = local
    ? spawn(local.electron, [path.join(ROOT, 'mcp', 'local_host.cjs'), ...flags], {
        stdio: ['ignore', 'ignore', 'pipe'], env: { ...env, SPACE_FFMPEG: local.ffmpeg }
      })
    : spawn(findChrome(), [
        '--headless=new', ...flags, '--no-first-run', '--no-default-browser-check', '--window-size=1280,720', 'about:blank'
      ], { stdio: ['ignore', 'ignore', 'pipe'] })

  // The profile goes with the browser. The browser lets go of its files a moment after it is killed, so
  // the removal retries, and it is done before this returns: the server exits right after closing, and a
  // timer set here would never fire
  const close = () => {
    studio = null
    try { chrome.kill() } catch {}
    server.close()
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 }) } catch {}
  }

  try {
    const socketUrl = await new Promise((resolve, reject) => {
      let log = ''
      chrome.stderr.on('data', chunk => {
        log += chunk
        const match = log.match(/DevTools listening on (ws:\/\/\S+)/)
        if (match) resolve(match[1])
      })
      chrome.once('error', reject)
      chrome.once('exit', code => reject(new Error(`The browser closed while starting (code ${code})`)))
      setTimeout(() => reject(new Error('The browser did not start in 20 s')), 20_000).unref()
    })
    // Electron opens its window a moment after its socket
    let target
    for (const deadline = Date.now() + 20_000; !target; await new Promise(resolve => setTimeout(resolve, 100))) {
      const targets = await (await fetch(`http://127.0.0.1:${new URL(socketUrl).port}/json`)).json()
      target = targets.find(entry => entry.type === 'page')
      if (!target && Date.now() > deadline) throw new Error('The browser opened no page in 20 s')
    }
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', () => reject(new Error('Could not reach the browser')), { once: true })
    })

    let nextId = 0
    const pending = new Map()
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      const waiting = pending.get(message.id)
      if (!waiting) return
      pending.delete(message.id)
      waiting.resolve(message)
    })
    const lost = () => {
      for (const waiting of pending.values()) waiting.reject(new Error('The browser closed'))
      pending.clear()
      close()
    }
    socket.addEventListener('close', lost)
    chrome.once('exit', lost)

    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
    // Runs an expression in the page and returns its value; a thrown error arrives with its message
    const evaluate = async (expression) => {
      const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      const failure = reply.result?.exceptionDetails
      if (failure) {
        const text = failure.exception?.description ?? failure.text ?? 'The page threw an error'
        // The message may run over several lines (a film's problems come as a list); the stack below it goes
        const lines = text.split('\n')
        const stack = lines.findIndex(line => /^\s+at /.test(line))
        throw new Error(lines.slice(0, stack < 0 ? lines.length : Math.max(stack, 1)).join('\n').replace(/^(Uncaught )?(\(in promise\) )?Error: /, ''))
      }
      if (reply.error) throw new Error(reply.error.message)
      return reply.result?.result?.value
    }

    await send('Page.enable')
    await send('Page.navigate', { url: `${origin}/?agent` })
    const deadline = Date.now() + PAGE_READY_MS
    while ((await evaluate('typeof window.space === "object" && typeof window.space.film === "object"').catch(() => false)) !== true) {
      if (Date.now() > deadline) throw new Error('The page did not load window.space.film; rebuild it with "pnpm build".')
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    // The page's own scene is not watched by anyone: it rests, so the machine draws only films
    await evaluate('window.space.pause()')

    studio = { origin, uploads, downloads, evaluate, close, local: local !== null }
    return studio
  } catch (error) {
    close()
    throw error
  }
}

const getStudio = async () => studio ?? openStudio()
const inPage = (call, ...args) => `window.space.${call}(${args.map(arg => JSON.stringify(arg ?? null)).join(', ')})`

// ---- Tools ----

// The film a call names: the JSON object, or a script, whose mistakes of grammar are found here with their line
// (the page's own reading of a script names the mistake but not where it is)
function filmOf (args) {
  const script = typeof args.script === 'string' ? args.script : typeof args.film === 'string' ? args.film : undefined
  if (script === undefined) {
    if (typeof args.film !== 'object' || args.film === null) throw new Error('Give the film: "film" (the JSON object) or "script" (the script as text)')
    return args.film
  }
  try {
    // Only read, never run: the script runs in the page
    void new vm.Script(`(function () {${script}\n})`, { filename: 'film-script.js' })
  } catch (error) {
    const line = /film-script\.js:(\d+)/.exec(String(error.stack))
    throw new Error(`${line ? `line ${line[1]}: ` : ''}the script cannot be read as JavaScript: ${error.message}`)
  }
  return script
}

// The films a reel's clips may be
const CLIP_FILMS = ['film', 'fractal']
// A clip's film given as the name of a file on this machine, and not as a script
const CLIP_FILE = /^[\w ./\\:~-]+\.(json|js)$/i

// A reel (a film with "clips") as the page takes it: a clip's film named by a path is read here, from the
// folder the server runs in, a .json file as its object and a .js file as its script; a clip's script gets
// the same reading of its grammar a film's does. Anything else is the film it was. What cannot be read is
// thrown, or written into `told` when a check wants it beside what the page finds
function reelOf (film, told = null) {
  if (typeof film !== 'object' || film === null || !Array.isArray(film.clips)) return film
  const problems = []
  const clips = film.clips.map((clip, index) => {
    if (typeof clip !== 'object' || clip === null) return clip
    const read = { ...clip }
    for (const kind of CLIP_FILMS) {
      let source = clip[kind]
      if (typeof source !== 'string') continue
      const where = `clips[${index}].${kind}`
      if (CLIP_FILE.test(source.trim())) {
        // From the folder the server runs in
        const file = path.resolve(source.trim())
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
          problems.push({ where, text: `no film at ${file}` })
          continue
        }
        const written = fs.readFileSync(file, 'utf8')
        if (path.extname(file).toLowerCase() === '.json') {
          try {
            read[kind] = JSON.parse(written)
          } catch (error) {
            problems.push({ where, text: `${file} is not JSON: ${error.message}` })
          }
          continue
        }
        source = written
        read[kind] = written
      }
      try {
        void new vm.Script(`(function () {${source}\n})`, { filename: 'film-script.js' })
      } catch (error) {
        const line = /film-script\.js:(\d+)/.exec(String(error.stack))
        problems.push({ where, text: `${line ? `line ${line[1]}: ` : ''}the script cannot be read as JavaScript: ${error.message}` })
      }
    }
    return read
  })
  if (told) told.push(...problems)
  else if (problems.length > 0) throw new Error(problems.map(problem => `${problem.where}: ${problem.text}`).join('\n'))
  return { ...film, clips }
}

// A fractal film comes as a film does: its JSON, or a script read here for its grammar
const fractalOf = args => filmOf(args)

// The problems a message lists, one each: a numbered list under a first line, or the message itself
function listed (message) {
  const lines = message.split('\n')
  if (lines.length < 2 || !lines[0].endsWith(':') || !lines[1].startsWith('1. ')) return [message]
  const problems = []
  for (const line of lines.slice(1)) {
    if (/^\d+\. /.test(line)) problems.push(line.replace(/^\d+\. /, ''))
    else problems[problems.length - 1] += '\n' + line
  }
  return problems
}

// Pictures a film's graphics may name by a path on this machine
const PICTURES = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']

// The pictures a film's graphics name by a path, each handed to the page under a one-off token, as the audio
// is. A script's paths are known only once the page has written its JSON, so the page writes it first
async function filmPictures (page, film, input) {
  // A reel's pictures are those of its clips that are films of the scene, each found as a film's are
  if (typeof film === 'object' && film !== null && Array.isArray(film.clips)) {
    const all = { images: {}, missing: [], releases: [] }
    for (const [index, clip] of film.clips.entries()) {
      if (typeof clip !== 'object' || clip === null || (typeof clip.film !== 'object' && typeof clip.film !== 'string') || clip.film === null) continue
      const found = await filmPictures(page, clip.film, clip.input).catch(() => null)
      if (!found) continue
      Object.assign(all.images, found.images)
      all.missing.push(...found.missing.map(line => `clips[${index}].film.${line}`))
      all.releases.push(found.release)
    }
    return { images: all.images, missing: all.missing, release: () => all.releases.forEach(release => release()) }
  }
  const written = typeof film === 'string' ? (await page.evaluate(inPage('film.script', film, input))).film : film
  const graphics = Array.isArray(written?.graphics) ? written.graphics : []
  const images = {}
  const missing = []
  const tokens = []
  for (const [index, graphic] of graphics.entries()) {
    const src = graphic?.kind === 'image' && typeof graphic.src === 'string' ? graphic.src.trim() : ''
    if (src === '' || src in images || ['data:', 'blob:', 'http://', 'https://'].some(start => src.toLowerCase().startsWith(start))) continue
    const file = path.resolve(process.cwd(), src)
    if (!PICTURES.includes(path.extname(file).toLowerCase())) {
      missing.push(`graphics[${index}].src: ${src} is not a picture this server hands out (${PICTURES.join(', ')})`)
    } else if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      missing.push(`graphics[${index}].src: no picture at ${file}`)
    } else {
      const token = crypto.randomUUID()
      page.downloads.set(token, file)
      tokens.push(token)
      images[src] = `${page.origin}/__film/file/${token}`
    }
  }
  return { images, missing, release: () => tokens.forEach(token => page.downloads.delete(token)) }
}

const round = (value) => typeof value === 'number' ? Number(value.toFixed(4)) : value

function describeText (settings, intro, presets, introPresets, layerInfo, filter) {
  const full = Boolean(filter)
  const lines = []
  const about = entry => full ? entry.description : entry.hint ?? entry.description
  // What a film cannot set: it has no cursor and no device of its own
  const filmless = ['blackHoleFollowing', 'fpsCounter', 'frameRateCap', 'scrollSpeedStep']

  const sliders = settings.sliders.filter(entry => !filmless.includes(entry.key))
  if (sliders.length > 0) {
    lines.push('SETTINGS  set in "settings", animate in "tracks"')
    for (const entry of sliders) {
      lines.push(`  ${entry.key}  ${round(entry.min)}..${round(entry.max)}, default ${round(entry.default)}  ${entry.label}: ${about(entry)}`)
    }
  }
  const toggles = settings.toggles.filter(entry => !filmless.includes(entry.key))
  if (toggles.length > 0) {
    lines.push('SWITCHES  true or false, in "settings"; in "tracks" a switch flips at its second')
    for (const entry of toggles) lines.push(`  ${entry.key}  default ${entry.default}  ${entry.description}`)
  }
  // A page built before the colour settings has none to list
  const colors = settings.colors ?? []
  if (colors.length > 0) {
    lines.push('COLOURS  "#rrggbb", in "settings"; in "tracks" a colour moves channel by channel')
    for (const entry of colors) lines.push(`  ${entry.key}  default ${entry.default}  ${entry.label}: ${about(entry)}`)
  }
  const other = settings.other.filter(entry => !filmless.includes(entry.key))
  if (other.length > 0) {
    lines.push('OTHER  in "settings"; the background channels also in "tracks"')
    for (const entry of other) lines.push(`  ${entry.key}  ${entry.description}`)
  }
  if (intro.length > 0) {
    lines.push('INTRO PARAMETERS  set in "intro.params", animate in "tracks" (numbers and colours)')
    for (const entry of intro) {
      const range = entry.type === 'colour'
        ? `colour, default ${entry.default}`
        : entry.options
          ? `one of ${entry.options.map(option => `"${option}"`).join(' | ')}, default "${entry.default.name}"`
          : `${round(entry.min)}..${round(entry.max)}${entry.unit ? ' ' + entry.unit : ''}, default ${round(entry.default)}`
      lines.push(`  ${entry.key}  ${range}  ${entry.label}: ${about(entry)}`)
    }
  }
  const word = filter?.toLowerCase()
  const layers = layerInfo.layers.filter(layer => !word || layer.toLowerCase().includes(word) || layerInfo.about[layer].toLowerCase().includes(word))
  if (layers.length > 0) {
    lines.push('LAYERS  switch along the film in "layers" (true shows), hide for the whole film in "intro.hide"; an event is also fired again in "cues"')
    for (const layer of layers) lines.push(`  ${layer}  ${layerInfo.events.includes(layer) ? 'event' : 'state'}  ${layerInfo.about[layer]}`)
  }
  if (!full) {
    lines.push(`PRESETS  "preset": ${presets.map(preset => preset.name).join(' | ')}`)
    lines.push(`INTRO PRESETS  "intro.preset": ${introPresets.map(preset => preset.name).join(' | ')}`)
    lines.push('TIME  "speed": the pace of the scene\'s time along the film, 0 (a still frame) to 4, as keyframes or one number')
    lines.push('Give a filter word for the full meaning of the keys that match it.')
  }
  return lines.length > 0 ? lines.join('\n') : `Nothing matches "${filter}". Call space_describe without a filter for every key.`
}

async function runTool (name, args, report) {
  const text = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }] })
  const page = await getStudio()

  if (name === 'space_guide') return text(await page.evaluate(inPage('film.guide')))

  if (name === 'space_describe') {
    const filter = typeof args.filter === 'string' && args.filter.trim() !== '' ? args.filter.trim() : undefined
    const [settings, intro, presets, introPresets, layerInfo] = await Promise.all([
      page.evaluate(filter ? inPage('describe', filter) : 'window.space.describe()'),
      page.evaluate(filter ? inPage('intro.describe', filter) : 'window.space.intro.describe()'),
      page.evaluate('window.space.preset.list().presets'),
      page.evaluate('window.space.intro.preset.list().presets'),
      page.evaluate('window.space.intro.layers()')
    ])
    return text(describeText(settings, intro, presets, introPresets, layerInfo, filter))
  }

  if (name === 'space_check') {
    // What this machine cannot read of a reel's clips is told together with what the page finds wrong
    const unreadClips = []
    const film = reelOf(filmOf(args), unreadClips)
    // A picture named by a path is looked for here, and told with whatever else the page found wrong
    let unread = null
    const checked = await page.evaluate(inPage('film.check', film, args.input)).catch(error => { unread = error })
    const pictures = await filmPictures(page, film, args.input).catch(() => null)
    pictures?.release()
    const lost = pictures?.missing ?? []
    if (unreadClips.length > 0) {
      // The page told those clips too, without the file or the line: its telling of them gives way to this one
      const found = unread ? listed(unread.message).filter(line => !unreadClips.some(problem => line.startsWith(problem.where + ':'))) : []
      const all = [...found, ...unreadClips.map(problem => `${problem.where}: ${problem.text}`), ...lost]
      throw new Error(all.length === 1 ? all[0] : `${all.length} things in this reel cannot be read:\n${all.map((line, index) => `${index + 1}. ${line}`).join('\n')}`)
    }
    if (unread) throw lost.length > 0 ? new Error(`${unread.message}\nAnd on this machine:\n${lost.join('\n')}`) : unread
    if (lost.length > 0) throw new Error(lost.join('\n'))
    const lines = [
      `The film: ${+checked.duration.toFixed(2)} s, ${checked.fps} fps, ${checked.width}x${checked.height}, ${checked.frames} frames.`,
      ...(checked.notes.length > 0 ? [`Adjusted: ${checked.notes.join('; ')}`] : []),
      'Timeline:',
      ...checked.timeline.map(line => '  ' + line)
    ]
    if (typeof film === 'string') {
      const written = await page.evaluate(inPage('film.script', film, args.input))
      const marks = Object.entries(written.marks).map(([mark, second]) => `${mark} ${second} s`)
      if (marks.length > 0) lines.push(`Marks: ${marks.join(', ')}`)
      if (typeof args.out === 'string' && args.out.trim() !== '') {
        const out = path.resolve(process.cwd(), args.out)
        fs.mkdirSync(path.dirname(out), { recursive: true })
        fs.writeFileSync(out, JSON.stringify(written.film, null, 1) + '\n')
        lines.push(`Wrote ${out}`)
      }
    }
    return text(lines.join('\n'))
  }

  if (name === 'space_preview') {
    const film = reelOf(filmOf(args))
    const options = {}
    if (args.oneScene === true) options.oneScene = true
    if (Array.isArray(args.at)) options.at = args.at
    if (typeof args.frames === 'number') options.frames = args.frames
    if (args.still === true) options.still = true
    if (typeof args.stillWidth === 'number') options.stillWidth = args.stillWidth
    if (args.input !== undefined) options.input = args.input
    const pictures = await filmPictures(page, film, args.input)
    if (pictures.missing.length > 0) throw new Error(pictures.missing.join('\n'))
    options.images = pictures.images
    const sheet = await withProgress(page, report, () => page.evaluate(inPage('film.preview', film, options))).finally(pictures.release)
    const note = sheet.notes.length > 0 ? `\nAdjusted: ${sheet.notes.join('; ')}` : ''
    // The film as it was understood, so what was meant can be checked against it before a render
    const timeline = `\nTimeline:\n${sheet.timeline.map(line => '  ' + line).join('\n')}`
    let written = ''
    if (typeof args.out === 'string' && args.out.trim() !== '') {
      const out = path.resolve(process.cwd(), args.out)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, Buffer.from(sheet.image, 'base64'))
      written = ` Written to ${out}.`
    }
    return {
      content: [
        { type: 'image', data: sheet.image, mimeType: sheet.mimeType },
        {
          type: 'text',
          text: (options.still ? `A still of ${sheet.width}x${sheet.height} at ${sheet.times[0]} s.${written} ` : `Frames at ${sheet.times.join(', ')} s, left to right, top to bottom.${written} `) +
            `The film: ${sheet.film.duration} s, ${sheet.film.fps} fps, ${sheet.film.width}x${sheet.film.height}.${note}${timeline}`
        }
      ]
    }
  }

  if (name === 'space_fractal_guide') return text(await page.evaluate(inPage('fractal.guide')))

  if (name === 'space_fractal_check') {
    const film = fractalOf(args)
    const checked = await page.evaluate(inPage('fractal.check', film, args.input))
    const lines = [
      `The film: ${+checked.duration.toFixed(2)} s, ${checked.fps} fps, ${checked.width}x${checked.height}, ${checked.frames} frames.`,
      ...(checked.notes.length > 0 ? [`Adjusted: ${checked.notes.join('; ')}`] : []),
      ...checked.timeline
    ]
    if (typeof film === 'string') {
      const written = await page.evaluate(inPage('fractal.script', film, args.input))
      const marks = Object.entries(written.marks).map(([mark, second]) => `${mark} ${second} s`)
      if (marks.length > 0) lines.push(`Marks: ${marks.join(', ')}`)
      if (typeof args.out === 'string' && args.out.trim() !== '') {
        const out = path.resolve(process.cwd(), args.out)
        fs.mkdirSync(path.dirname(out), { recursive: true })
        fs.writeFileSync(out, JSON.stringify(written.film, null, 1) + '\n')
        lines.push(`Wrote ${out}`)
      }
    }
    return text(lines.join('\n'))
  }

  if (name === 'space_fractal_preview') {
    const options = {}
    if (Array.isArray(args.at)) options.at = args.at
    if (typeof args.frames === 'number') options.frames = args.frames
    if (args.input !== undefined) options.input = args.input
    const sheet = await withProgress(page, report, () => page.evaluate(inPage('fractal.preview', fractalOf(args), options)))
    const note = sheet.notes.length > 0 ? `\nAdjusted: ${sheet.notes.join('; ')}` : ''
    return {
      content: [
        { type: 'image', data: sheet.image, mimeType: sheet.mimeType },
        {
          type: 'text',
          text: `Frames at ${sheet.times.join(', ')} s, left to right, top to bottom, ${sheet.msPerTile} ms each at this size. ` +
            `The film: ${sheet.film.duration} s, ${sheet.film.fps} fps, ${sheet.film.width}x${sheet.film.height}.${note}\n${sheet.timeline.join('\n')}`
        }
      ]
    }
  }

  if (name === 'space_render' || name === 'space_fractal_render') {
    if (typeof args.out !== 'string' || args.out.trim() === '') throw new Error('out takes the path of the mp4 to write')
    const fractal = name === 'space_fractal_render'
    const film = fractal ? fractalOf(args) : reelOf(filmOf(args))
    let out = path.resolve(process.cwd(), args.out)
    if (path.extname(out).toLowerCase() !== '.mp4') out += '.mp4'
    fs.mkdirSync(path.dirname(out), { recursive: true })

    const options = { upload: '' }
    if (args.oneScene === true) options.oneScene = true
    if (args.quality !== undefined) options.quality = args.quality
    if (args.input !== undefined) options.input = args.input
    const tokens = []
    if (args.audio !== undefined) {
      const audio = path.resolve(process.cwd(), String(args.audio))
      if (!fs.existsSync(audio)) throw new Error(`No audio file at ${audio}`)
      const token = crypto.randomUUID()
      page.downloads.set(token, audio)
      tokens.push(() => page.downloads.delete(token))
      options.audio = `${page.origin}/__film/file/${token}`
    }
    const pictures = await filmPictures(page, film, args.input)
    tokens.push(pictures.release)
    if (pictures.missing.length > 0) {
      pictures.release()
      throw new Error(pictures.missing.join('\n'))
    }
    options.images = pictures.images
    // The file is written beside its place and moved there whole, so a failed render leaves nothing half done
    const token = crypto.randomUUID()
    const target = { path: `${out}.part`, file: undefined, written: false, error: null }
    const closeFile = () => {
      if (target.file === undefined) return
      fs.closeSync(target.file)
      target.file = undefined
    }
    page.uploads.set(token, target)
    tokens.push(() => page.uploads.delete(token))
    options.upload = `${page.origin}/__film/upload/${token}`
    // Where this machine encodes outside the browser, the page's encoder writes the file itself; a frame
    // that encoder cannot take is still sent the other way
    if (page.local) options.local = target.path

    try {
      const draw = () => withProgress(page, report, () => page.evaluate(inPage(fractal ? 'fractal.render' : 'film.render', film, options)))
      // An encoder outside the browser is another program, and it may be stopped under the film. The film
      // is then drawn again for the browser's own encoder, and the answer says so
      let stopped = ''
      const summary = await draw().catch(error => {
        if (!options.local || !String(error.message).startsWith('ffmpeg stopped')) throw error
        stopped = `\nThe encoder outside the browser failed (${error.message}); the browser encoded this film.`
        delete options.local
        fs.rmSync(target.path, { force: true })
        return draw()
      })
      const arrived = target.written || (summary.encoder !== 'browser' && fs.existsSync(target.path))
      if (target.error || !arrived) throw target.error ?? new Error('The file did not arrive from the page')
      closeFile()
      fs.renameSync(target.path, out)
      const { notes, ...facts } = summary
      const note = (notes.length > 0 ? `\nAdjusted: ${notes.join('; ')}` : '') + stopped
      return text(`Wrote ${out}\n${Object.entries(facts).filter(([, value]) => value !== null).map(([key, value]) => `${key}: ${value}`).join(', ')}${note}`)
    } finally {
      for (const release of tokens) release()
      closeFile()
      fs.rmSync(target.path, { force: true })
    }
  }

  throw new Error(`Unknown tool "${name}". Tools: ${TOOLS.map(tool => tool.name).join(', ')}`)
}

// While the page draws, tells the client how far it is, when the client asked to be told
async function withProgress (page, report, work) {
  if (!report) return work()
  const timer = setInterval(async () => {
    try {
      const state = await page.evaluate('window.space.film.progress()')
      if (state.frames > 0) report(state.frame, state.frames, `${state.phase} ${state.frame}/${state.frames}`)
    } catch {}
  }, PROGRESS_EVERY_MS)
  try {
    return await work()
  } finally {
    clearInterval(timer)
  }
}

// ---- MCP over stdio: one JSON-RPC message per line ----

const write = message => process.stdout.write(JSON.stringify(message) + '\n')
// The page draws one film at a time, so calls wait their turn
let queue = Promise.resolve()
const DRAWS = /_(preview|render)$/

async function handle (message) {
  const { id, method, params } = message
  if (id === undefined) return
  const reply = result => write({ jsonrpc: '2.0', id, result })
  const refuse = (code, text) => write({ jsonrpc: '2.0', id, error: { code, message: text } })

  if (method === 'initialize') {
    const asked = params?.protocolVersion
    return reply({
      protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
      capabilities: { tools: {} },
      serverInfo: SERVER,
      instructions: INSTRUCTIONS
    })
  }
  if (method === 'ping') return reply({})
  if (method === 'tools/list') return reply({ tools: TOOLS })
  if (method === 'tools/call') {
    const progressToken = params?._meta?.progressToken
    const report = progressToken === undefined
      ? null
      : (progress, total, text) => write({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken, progress, total, message: text } })
    queue = queue.then(async () => {
      // The tools that draw take the machine's turn; the ones that only read the page answer at once
      const draws = DRAWS.test(params?.name ?? '')
      const release = draws ? await takeTurn(params.name, waiting => report?.(0, 1, waiting)) : null
      try {
        reply(await runTool(params?.name, params?.arguments ?? {}, report))
      } catch (error) {
        reply({ content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true })
      } finally {
        release?.()
      }
    })
    return
  }
  refuse(-32601, `Method not found: ${method}`)
}

const lines = readline.createInterface({ input: process.stdin })
lines.on('line', line => {
  if (line.trim() === '') return
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  }
  void handle(message)
})

const shutdown = () => {
  studio?.close()
  process.exit(0)
}
// The client closing its end is the signal to leave, once the calls already taken are answered
lines.on('close', () => { void queue.then(shutdown) })
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
