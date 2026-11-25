#!/usr/bin/env node
// Frame time, measured the way CLAUDE.md's Measuring asks. Needs Node 22+ and Chrome, Chromium or Edge.
//
//   node scripts/bench.mjs page <dist> [<dist> ...] [--runs 2] [--debug]
//   node scripts/bench.mjs step [--runs 2] [--spin 0.99]
//
// page serves each built page (pnpm build, then dist/; build the commit before a change into another
// folder for the "before") in headless Chrome at 1920x1080, clicks CLICK TO START, waits 7 s for the
// opening to end and counts rAF ticks over 4 s; main thread a frame is CDP's TaskDuration over that time
// divided by the ticks. The builds take turns run by run, so a busy machine weighs on both alike.
// --debug loads the page with ?debug, which opens the intro debugger.
//
// step bundles the hot loop from src/ and times stepParticles alone: 300 warm-up steps, then 1500 timed
// steps at 1920x1080, for 24 000 particles with the black hole and 24 000 and 10 000 without it;
// --spin turns the hole, its axis at 45° to the camera, so the particles are dragged round. Its
// settings are written out below; keep them in step with StepSettings in particle_simulation.ts.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = name => {
  const at = args.indexOf(name)
  if (at < 0) return undefined
  const [, value] = args.splice(at, 2)
  return value
}
const runs = Number(flag('--runs') ?? 2)
const spin = Number(flag('--spin') ?? 0)
const debug = args.includes('--debug') ? (args.splice(args.indexOf('--debug'), 1), true) : false
const [command, ...rest] = args
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function findBrowser () {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const home = os.homedir()
  const candidates = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      path.join(process.env.LOCALAPPDATA ?? path.join(home, 'AppData/Local'), 'Google/Chrome/Application/chrome.exe'),
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  const found = candidates.find(candidate => fs.existsSync(candidate))
  if (!found) throw new Error('No Chrome, Chromium or Edge found. Set CHROME_PATH to the browser to use.')
  return found
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.md': 'text/markdown', '.png': 'image/png' }

function serve (dist) {
  const server = createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url, 'http://x').pathname)
    let file = path.join(dist, name)
    if (name === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(response)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

async function openBrowser () {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'space-bench-'))
  const browser = spawn(findBrowser(), [
    '--headless=new', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--window-size=1920,1080', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'
  ], { stdio: 'ignore' })
  let port
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100)
    try {
      port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]
    } catch {
      // The browser has not written its port yet
    }
  }
  if (!port) throw new Error('the browser did not open its DevTools port')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve))
  let id = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  })
  const send = (method, params = {}) => new Promise(resolve => {
    pending.set(++id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
  const close = () => {
    socket.close()
    browser.kill()
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 1000)
  }
  return { send, close }
}

async function page (dists) {
  if (dists.length === 0) throw new Error('page takes one or more built dist folders')
  for (const dist of dists) {
    if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`${dist} has no index.html; run pnpm build`)
  }
  const servers = await Promise.all(dists.map(serve))
  const { send, close } = await openBrowser()
  await send('Page.enable')
  await send('Performance.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  const taskDuration = async () => (await send('Performance.getMetrics')).result.metrics.find(metric => metric.name === 'TaskDuration').value
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result.value
  try {
    for (let run = 1; run <= runs; run++) {
      for (const [index, dist] of dists.entries()) {
        await send('Page.navigate', { url: `http://127.0.0.1:${servers[index].address().port}/${debug ? '?debug' : ''}` })
        await sleep(2500)
        for (const type of ['mousePressed', 'mouseReleased']) {
          await send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button: 'left', clickCount: 1 })
        }
        await sleep(7000)
        const before = await taskDuration()
        const frames = await evaluate('new Promise(resolve => { let n = 0; const start = performance.now(); const tick = () => { n++; if (performance.now() - start < 4000) requestAnimationFrame(tick); else resolve(n) }; requestAnimationFrame(tick) })')
        const after = await taskDuration()
        console.log(`${dist}  run ${run}: ${(frames / 4).toFixed(0)} fps, ${((after - before) * 1000 / frames).toFixed(2)} ms/frame main thread`)
      }
    }
  } finally {
    close()
    for (const server of servers) server.close()
  }
}

const STEP_ENTRY = `
import { createParticleField, createInstanceData, createPaletteSampler, setParticleCount, stepParticles } from ${JSON.stringify(path.join(root, 'src/lib/particle_simulation.ts').replaceAll(path.sep, '/'))}
import { createRandom, seedRandom } from ${JSON.stringify(path.join(root, 'src/lib/random.ts').replaceAll(path.sep, '/'))}

export function run (count, hole, spin) {
  const random = createRandom()
  seedRandom(random, 7)
  const spawn = { random, palette: createPaletteSampler([{ r: 255, g: 255, b: 255, enabled: true, percent: 100 }]), farZ: 5000, speedVariance: 0.2, radius: 1.2 }
  const field = createParticleField()
  setParticleCount(field, count, spawn)
  const out = createInstanceData()
  const horizon = 86.4
  const settings = {
    frameScale: 1, time: 0, speed: 8, width: 1920, height: 1080, focal: 960, vanishX: 960, vanishY: 540,
    holeX: hole ? 960 : NaN, holeY: hole ? 540 : NaN, holeRadius: hole ? horizon : 0, captureRadius: horizon,
    captureX: 960, captureY: 540, spinRight: 0, spinUp: spin * Math.SQRT1_2, spinToward: spin * Math.SQRT1_2, companionX: 0, companionY: 0, companionRadius: 0, companionCapture: 0,
    ringEnergy: null, gravityReach: horizon * 5, holeDepth: 2500, gravityDepth: 900, lineWidth: 3, gravityStrength: 2.5,
    orbitalStrength: 0.5, farZ: 5000, depthFade: 0.5, pulseSpeedMultiplier: 1, pulseIntensity: 0.2, baseBrightness: 1,
    minOpacity: 0.1, maxOpacity: 1, revealRadius: Infinity, revealX: 960, revealY: 540, revealFeather: 80, opacityScale: 1
  }
  for (let i = 0; i < 300; i++) { settings.time += 1 / 60; stepParticles(field, settings, spawn, out) }
  const start = performance.now()
  for (let i = 0; i < 1500; i++) { settings.time += 1 / 60; stepParticles(field, settings, spawn, out) }
  return (performance.now() - start) / 1500
}
`

async function step () {
  const fromRoot = createRequire(path.join(root, 'package.json'))
  const esbuild = createRequire(fromRoot.resolve('vite'))('esbuild')
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'space-step-')), 'step.mjs')
  try {
    await esbuild.build({ stdin: { contents: STEP_ENTRY, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
    const { run } = await import(pathToFileURL(out).href)
    for (let round = 1; round <= runs; round++) {
      console.log(`run ${round}: 24000 with the hole ${run(24000, true, spin).toFixed(3)} ms/step · 24000 without ${run(24000, false, 0).toFixed(3)} ms · 10000 without ${run(10000, false, 0).toFixed(3)} ms`)
    }
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true })
  }
}

if (command === 'page') await page(rest)
else if (command === 'step') await step()
else {
  console.log('node scripts/bench.mjs page <dist> [<dist> ...] [--runs 2] [--debug]\nnode scripts/bench.mjs step [--runs 2] [--spin 0.99]')
  process.exitCode = command ? 1 : 0
}
