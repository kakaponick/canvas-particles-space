#!/usr/bin/env node
// Frame time, measured the way CLAUDE.md's Measuring asks. Needs Node 22+ and Chrome, Chromium or Edge.
//
//   node scripts/bench.mjs page [<dist> ...] [--against <commit>] [--runs 2] [--debug]
//   node scripts/bench.mjs step [--against <commit>] [--runs 2] [--spin 0.99] [--inertia 0.9]
//
// --against <commit> measures that commit beside this checkout: it is checked out into a temporary
// worktree (pnpm install --offline there, then pnpm build for page) and removed afterwards; for page this
// checkout is built too, so both builds are current. Without it page measures the dist folders it is given,
// or this checkout's dist/ as it was last built.
//
// page serves each build in headless Chrome at 1920x1080, clicks CLICK TO START, waits 7 s for the opening
// to end and counts rAF ticks over 4 s; main thread a frame is CDP's TaskDuration over that time divided by
// the ticks. The builds take turns run by run, so a busy machine weighs on both alike. --debug loads the
// page with ?debug, which opens the intro debugger.
//
// step bundles the hot loop from src/ and times stepParticles alone: 300 warm-up steps, then 1500 timed
// steps at 1920x1080, for 24 000 particles with the black hole and 24 000 and 10 000 without it. It sets
// the frame, the hole and the look over createStepSettings, so a new step setting comes in with the value
// that changes nothing; --spin turns the hole, its axis at 45° to the camera, and --inertia lets the
// particles keep the speed the hole gives them.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'node:http'
import { execFileSync, execSync, spawn } from 'node:child_process'
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
const inertia = Number(flag('--inertia') ?? 0)
const against = flag('--against')
const debug = args.includes('--debug') ? (args.splice(args.indexOf('--debug'), 1), true) : false
const [command, ...rest] = args
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const USAGE = 'node scripts/bench.mjs page [<dist> ...] [--against <commit>] [--runs 2] [--debug]\n' +
  'node scripts/bench.mjs step [--against <commit>] [--runs 2] [--spin 0.99] [--inertia 0.9]'

// The temporary folder by its long name: git records a worktree's path as given, and Windows hands out
// the short form (KAKAPO~1) that git then cannot match
const temp = fs.realpathSync.native(os.tmpdir())

// Takes a folder away without following a link or a junction inside it: pnpm's node_modules is full of
// junctions, and a removal that walks one empties the folder it points at
function removeTree (target) {
  const stat = fs.lstatSync(target, { throwIfNoEntry: false })
  if (!stat) return
  if (stat.isSymbolicLink()) {
    try {
      fs.unlinkSync(target)
    } catch {
      fs.rmdirSync(target)
    }
    return
  }
  if (!stat.isDirectory()) return fs.unlinkSync(target)
  for (const name of fs.readdirSync(target)) removeTree(path.join(target, name))
  fs.rmdirSync(target)
}

// A commit checked out beside this one, with its own dependencies, for the "before" of a measurement
function checkout (commit) {
  const sha = execFileSync('git', ['rev-parse', '--short', commit], { cwd: root, encoding: 'utf8' }).trim()
  const parent = fs.mkdtempSync(path.join(temp, 'space-bench-'))
  const tree = path.join(parent, sha)
  execFileSync('git', ['worktree', 'add', '--detach', tree, sha], { cwd: root, stdio: 'ignore' })
  const remove = () => {
    removeTree(path.join(tree, 'node_modules'))
    execFileSync('git', ['worktree', 'remove', '--force', tree], { cwd: root, stdio: 'ignore' })
    removeTree(parent)
  }
  try {
    // An older commit may not settle which dependencies run build scripts; that must not stop the install
    const install = 'pnpm install --frozen-lockfile --config.strict-dep-builds=false'
    try {
      execSync(`${install} --offline`, { cwd: tree, stdio: 'ignore' })
    } catch {
      execSync(install, { cwd: tree, stdio: 'ignore' })
    }
  } catch (error) {
    remove()
    throw error
  }
  return { tree, label: sha, remove }
}

const build = dir => execSync('pnpm build', { cwd: dir, stdio: 'ignore' })

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
  const profile = fs.mkdtempSync(path.join(temp, 'space-browser-'))
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
  // The profile goes once the browser has let go of its files
  const close = async () => {
    socket.close()
    const exited = new Promise(resolve => browser.once('exit', resolve))
    browser.kill()
    await Promise.race([exited, sleep(5000)])
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
  return { send, close }
}

// builds: [{ label, dist }]
async function page (builds) {
  for (const { dist } of builds) {
    if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`${dist} has no index.html; run pnpm build`)
  }
  const servers = await Promise.all(builds.map(({ dist }) => serve(dist)))
  const { send, close } = await openBrowser()
  await send('Page.enable')
  await send('Performance.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  const taskDuration = async () => (await send('Performance.getMetrics')).result.metrics.find(metric => metric.name === 'TaskDuration').value
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result.value
  try {
    for (let run = 1; run <= runs; run++) {
      for (const [index, { label }] of builds.entries()) {
        await send('Page.navigate', { url: `http://127.0.0.1:${servers[index].address().port}/${debug ? '?debug' : ''}` })
        await sleep(2500)
        for (const type of ['mousePressed', 'mouseReleased']) {
          await send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button: 'left', clickCount: 1 })
        }
        await sleep(7000)
        const before = await taskDuration()
        const frames = await evaluate('new Promise(resolve => { let n = 0; const start = performance.now(); const tick = () => { n++; if (performance.now() - start < 4000) requestAnimationFrame(tick); else resolve(n) }; requestAnimationFrame(tick) })')
        const after = await taskDuration()
        console.log(`${label}  run ${run}: ${(frames / 4).toFixed(0)} fps, ${((after - before) * 1000 / frames).toFixed(2)} ms/frame main thread`)
      }
    }
  } finally {
    await close()
    for (const server of servers) server.close()
  }
}

const stepEntry = tree => `
import * as simulation from ${JSON.stringify(path.join(tree, 'src/lib/particle_simulation.ts').replaceAll(path.sep, '/'))}
import { createRandom, seedRandom } from ${JSON.stringify(path.join(tree, 'src/lib/random.ts').replaceAll(path.sep, '/'))}

export function run (count, hole, spin, inertia) {
  const { createParticleField, createInstanceData, createPaletteSampler, setParticleCount, stepParticles } = simulation
  const random = createRandom()
  seedRandom(random, 7)
  const spawn = { random, palette: createPaletteSampler([{ r: 255, g: 255, b: 255, enabled: true, percent: 100 }]), farZ: 5000, speedVariance: 0.2, radius: 1.2 }
  const field = createParticleField()
  setParticleCount(field, count, spawn)
  const out = createInstanceData()
  const horizon = 86.4
  // A tree older than createStepSettings gets the settings it knew, all of which are set here
  const settings = Object.assign(simulation.createStepSettings ? simulation.createStepSettings(null) : {}, {
    frameScale: 1, time: 0, speed: 8, width: 1920, height: 1080, focal: 960, vanishX: 960, vanishY: 540,
    holeX: hole ? 960 : NaN, holeY: hole ? 540 : NaN, holeRadius: hole ? horizon : 0, captureRadius: horizon,
    captureX: 960, captureY: 540, companionX: 0, companionY: 0, companionRadius: 0, companionCapture: 0,
    ringEnergy: null, gravityReach: horizon * 5, holeDepth: 2500, gravityDepth: 900, lineWidth: 3, gravityStrength: 2.5,
    orbitalStrength: 0.5, farZ: 5000, depthFade: 0.5, pulseSpeedMultiplier: 1, pulseIntensity: 0.2, baseBrightness: 1,
    minOpacity: 0.1, maxOpacity: 1, revealRadius: Infinity, revealX: 960, revealY: 540, revealFeather: 80, opacityScale: 1
  }, spin > 0 ? { spinRight: 0, spinUp: spin * Math.SQRT1_2, spinToward: spin * Math.SQRT1_2 } : {}, inertia > 0 ? { inertia } : {})
  for (let i = 0; i < 300; i++) { settings.time += 1 / 60; stepParticles(field, settings, spawn, out) }
  const start = performance.now()
  for (let i = 0; i < 1500; i++) { settings.time += 1 / 60; stepParticles(field, settings, spawn, out) }
  return (performance.now() - start) / 1500
}
`

async function bundleStep (tree) {
  const fromRoot = createRequire(path.join(root, 'package.json'))
  const esbuild = createRequire(fromRoot.resolve('vite'))('esbuild')
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'space-step-')), 'step.mjs')
  await esbuild.build({ stdin: { contents: stepEntry(tree), resolveDir: tree, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
  const { run } = await import(pathToFileURL(out).href)
  fs.rmSync(path.dirname(out), { recursive: true, force: true })
  return run
}

// trees: [{ label, tree }]
async function step (trees) {
  const loops = await Promise.all(trees.map(({ tree }) => bundleStep(tree)))
  for (let round = 1; round <= runs; round++) {
    for (const [index, { label }] of trees.entries()) {
      const run = loops[index]
      console.log(`${label}  run ${round}: 24000 with the hole ${run(24000, true, spin, inertia).toFixed(3)} ms/step · 24000 without ${run(24000, false, 0, 0).toFixed(3)} ms · 10000 without ${run(10000, false, 0, 0).toFixed(3)} ms`)
    }
  }
}

const here = { label: 'this checkout', tree: root, dist: path.join(root, 'dist') }
if (command === 'page' || command === 'step') {
  const base = against ? checkout(against) : null
  try {
    if (command === 'page') {
      if (base) {
        build(base.tree)
        build(root)
        await page([{ label: base.label, dist: path.join(base.tree, 'dist') }, here])
      } else {
        await page(rest.length > 0 ? rest.map(dist => ({ label: dist, dist })) : [here])
      }
    } else {
      await step(base ? [{ label: base.label, tree: base.tree }, here] : [here])
    }
  } finally {
    base?.remove()
  }
} else {
  console.log(USAGE)
  process.exitCode = command ? 1 : 0
}
