#!/usr/bin/env node
// MCP server that turns the scene into short videos. It serves the built page (dist/) from this machine,
// keeps one headless Chrome on it and gives an agent four tools: space_guide (how to write a film),
// space_describe (what can be set), space_preview (a contact sheet of frames) and space_render (the mp4).
// The page does the work through window.space.film; this file only carries JSON in and files out.
// No dependencies: the protocol is JSON-RPC lines on stdio, the browser is driven over its DevTools socket.
//
//   node mcp/space_mcp.mjs          after `pnpm build`; .mcp.json starts it for Claude Code
//   SPACE_DIST=path                 another build of the page
//   CHROME_PATH=path                another Chrome, Chromium or Edge
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SERVER = { name: 'space-film', version: '1.0.0' }
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.resolve(process.env.SPACE_DIST ?? path.join(ROOT, 'dist'))
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac'
}
const PAGE_READY_MS = 30_000
const PROGRESS_EVERY_MS = 1000

const INSTRUCTIONS = 'Makes 1-180 s videos of a black-hole particle scene from a JSON "film". ' +
  'Call space_guide first for the format and recipes, space_describe to find setting names, ' +
  'space_preview to look at frames, then space_render to write the mp4.'

const FILM_SCHEMA = { type: 'object', description: 'The film, as space_guide describes it', additionalProperties: true }

const TOOLS = [
  {
    name: 'space_guide',
    description: 'How to write a film for the scene: the JSON format on one screen and ready recipes. Read it first.',
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
    name: 'space_preview',
    description: 'Draws frames of a film side by side in one picture, each with its second, exactly as the render will make them. ' +
      'Use it to check a film before rendering.',
    inputSchema: {
      type: 'object',
      properties: {
        film: FILM_SCHEMA,
        at: { type: 'array', items: { type: 'number' }, description: 'Seconds to show; evenly spread when left out' },
        frames: { type: 'number', description: 'How many frames to spread over the film when "at" is left out (default 9)' }
      },
      required: ['film']
    }
  },
  {
    name: 'space_render',
    description: 'Renders a film to an mp4 file (H.264) and reports its length, size and anything it adjusted.',
    inputSchema: {
      type: 'object',
      properties: {
        film: FILM_SCHEMA,
        out: { type: 'string', description: 'Path of the mp4 to write; relative paths start at the working directory' },
        quality: { type: 'string', enum: ['medium', 'high', 'max'], description: 'Bitrate; high by default' },
        audio: { type: 'string', description: 'Path of an audio file (mp3, wav, m4a, ogg) laid under the picture from its start' }
      },
      required: ['film', 'out']
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
      const target = uploads.get(token)
      const file = fs.createWriteStream(target.path)
      request.pipe(file)
      file.on('finish', () => {
        target.written = true
        response.writeHead(204).end()
      })
      file.on('error', error => {
        target.error = error
        response.writeHead(500).end(String(error))
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
    // The two isolation headers let the page share memory between threads, which is how a film's
    // particles are stepped on several cores (src/lib/particle_crew.ts)
    response.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp'
    })
    fs.createReadStream(file).pipe(response)
  })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'space-film-'))
  const chrome = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,720',
    // The film is drawn with the graphics card, and nothing may slow the page while no one looks at it
    '--ignore-gpu-blocklist', '--enable-gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank'
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
    const targets = await (await fetch(`http://127.0.0.1:${new URL(socketUrl).port}/json`)).json()
    const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
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
        throw new Error(text.split('\n')[0].replace(/^(Uncaught )?(\(in promise\) )?Error: /, ''))
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

    studio = { origin, uploads, downloads, evaluate, close }
    return studio
  } catch (error) {
    close()
    throw error
  }
}

const getStudio = async () => studio ?? openStudio()
const inPage = (call, ...args) => `window.space.${call}(${args.map(arg => JSON.stringify(arg ?? null)).join(', ')})`

// ---- Tools ----

const round = (value) => typeof value === 'number' ? Number(value.toFixed(4)) : value

function describeText (settings, intro, presets, introPresets, layers, filter) {
  const full = Boolean(filter)
  const lines = []
  const about = entry => full ? entry.description : entry.hint ?? entry.description
  // What a film cannot set: it has no cursor and no device of its own
  const filmless = ['blackHoleFollowing', 'adaptiveParticles', 'fpsCounter', 'frameRateCap', 'scrollSpeedStep']

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
  if (!full) {
    lines.push(`PRESETS  "preset": ${presets.map(preset => preset.name).join(' | ')}`)
    lines.push(`INTRO PRESETS  "intro.preset": ${introPresets.map(preset => preset.name).join(' | ')}`)
    lines.push(`INTRO LAYERS  "intro.hide": ${layers.join(', ')}`)
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
    const [settings, intro, presets, introPresets, layers] = await Promise.all([
      page.evaluate(filter ? inPage('describe', filter) : 'window.space.describe()'),
      page.evaluate(filter ? inPage('intro.describe', filter) : 'window.space.intro.describe()'),
      page.evaluate('window.space.preset.list().presets'),
      page.evaluate('window.space.intro.preset.list().presets'),
      page.evaluate('window.space.intro.layers().layers')
    ])
    return text(describeText(settings, intro, presets, introPresets, layers, filter))
  }

  if (name === 'space_preview') {
    const options = {}
    if (Array.isArray(args.at)) options.at = args.at
    if (typeof args.frames === 'number') options.frames = args.frames
    const sheet = await withProgress(page, report, () => page.evaluate(inPage('film.preview', args.film, options)))
    const note = sheet.notes.length > 0 ? `\nAdjusted: ${sheet.notes.join('; ')}` : ''
    return {
      content: [
        { type: 'image', data: sheet.image, mimeType: sheet.mimeType },
        {
          type: 'text',
          text: `Frames at ${sheet.times.join(', ')} s, left to right, top to bottom. ` +
            `The film: ${sheet.film.duration} s, ${sheet.film.fps} fps, ${sheet.film.width}x${sheet.film.height}.${note}`
        }
      ]
    }
  }

  if (name === 'space_render') {
    if (typeof args.out !== 'string' || args.out.trim() === '') throw new Error('out takes the path of the mp4 to write')
    let out = path.resolve(process.cwd(), args.out)
    if (path.extname(out).toLowerCase() !== '.mp4') out += '.mp4'
    fs.mkdirSync(path.dirname(out), { recursive: true })

    const options = { upload: '' }
    if (args.quality !== undefined) options.quality = args.quality
    const tokens = []
    if (args.audio !== undefined) {
      const audio = path.resolve(process.cwd(), String(args.audio))
      if (!fs.existsSync(audio)) throw new Error(`No audio file at ${audio}`)
      const token = crypto.randomUUID()
      page.downloads.set(token, audio)
      tokens.push(() => page.downloads.delete(token))
      options.audio = `${page.origin}/__film/file/${token}`
    }
    // The file is written beside its place and moved there whole, so a failed render leaves nothing half done
    const token = crypto.randomUUID()
    const target = { path: `${out}.part`, written: false, error: null }
    page.uploads.set(token, target)
    tokens.push(() => page.uploads.delete(token))
    options.upload = `${page.origin}/__film/upload/${token}`

    try {
      const summary = await withProgress(page, report, () => page.evaluate(inPage('film.render', args.film, options)))
      if (!target.written) throw target.error ?? new Error('The file did not arrive from the page')
      fs.renameSync(target.path, out)
      const { notes, ...facts } = summary
      const note = notes.length > 0 ? `\nAdjusted: ${notes.join('; ')}` : ''
      return text(`Wrote ${out}\n${Object.entries(facts).filter(([, value]) => value !== null).map(([key, value]) => `${key}: ${value}`).join(', ')}${note}`)
    } finally {
      for (const release of tokens) release()
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
      try {
        reply(await runTool(params?.name, params?.arguments ?? {}, report))
      } catch (error) {
        reply({ content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true })
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
