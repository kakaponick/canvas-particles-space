#!/usr/bin/env node
// Frame time, measured the way CLAUDE.md's Measuring asks, and the bytes of the films for a change that wants
// them compared. Needs Node 22+ and Chrome, Chromium or Edge.
//
//   node scripts/bench.mjs page [<dist> ...] [--against <commit>] [--runs 2] [--debug]
//   node scripts/bench.mjs step [--against <commit>] [--runs 2] [--spin 0.99] [--inertia 0.9] [--3d]
//   node scripts/bench.mjs films [<film> ...] [--against <commit>] [--at 1.5,4,8,12] [--crew]
//
// --against <commit> measures that commit beside this checkout: it is checked out into a temporary
// worktree (pnpm install --offline there, then pnpm build for page and films) and removed afterwards; for
// page and films this checkout is built too, so both builds are current. Without it page measures the dist
// folders it is given, or this checkout's dist/ as it was last built, and films prints this build's hashes.
//
// Each command ends in a line that begins VERDICT, and that line is the check's answer. One command runs
// at a time on this machine, in turn with the film server's previews and renders (turn.mjs): a
// measurement taken beside another one measures the other.
//
// page and step with --against compare the two builds by their ranges. Ranges that touch are "within
// noise". Ranges apart after the first runs get as many runs again, once, since two runs of each of two
// equal builds come out apart one time in three, and four of each one time in thirty-five; the verdict then
// says how far apart the means are.
//
// films draws a preview of each film on both builds and compares the pictures' hashes: the films named,
// or every film of the scene in films/ (not the fractal ones, not the reels), at the seconds of --at.
// --crew sends the isolation headers, so the particles are stepped by the crew and not the plain loop. A
// film whose hashes differ is drawn once more on both builds, which tells three things apart: a first
// draw that was off (the second pair agrees), a film that is not deterministic on the commit before the
// change, and a picture the change moved.
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
// particles keep the speed the hole gives them; --3d times the 3D loop, its camera 40° round and 20° up.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { execFileSync, execSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { takeTurn } from './turn.mjs'

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
// The seconds of a film whose frames are compared; a film that ends sooner gives its last frame
const at = (flag('--at') ?? '1.5,4,8,12').split(',').map(Number)
const taken = name => args.includes(name) ? (args.splice(args.indexOf(name), 1), true) : false
const threeD = taken('--3d')
const debug = taken('--debug')
const crew = taken('--crew')
const [command, ...rest] = args
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const USAGE = 'node scripts/bench.mjs page [<dist> ...] [--against <commit>] [--runs 2] [--debug]\n' +
  'node scripts/bench.mjs step [--against <commit>] [--runs 2] [--spin 0.99] [--inertia 0.9] [--3d]\n' +
  'node scripts/bench.mjs films [<film> ...] [--against <commit>] [--at 1.5,4,8,12] [--crew]'

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

// Serves a build. `pictures` is the folder a film's pictures are read from, as the film server reads them
// from its checkout; `isolated` sends the headers that let a film step its particles with the crew
function serve (dist, { pictures = null, isolated = false } = {}) {
  const missing = file => !fs.existsSync(file) || fs.statSync(file).isDirectory()
  const headers = isolated ? { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } : {}
  const server = createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url, 'http://x').pathname)
    let file = path.join(dist, name)
    if (name !== '/' && missing(file) && pictures && !missing(path.join(pictures, name))) file = path.join(pictures, name)
    if (name === '/' || missing(file)) file = path.join(dist, 'index.html')
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', ...headers })
    fs.createReadStream(file).pipe(response)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

const lowest = values => Math.min(...values)
const highest = values => Math.max(...values)
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length

// Measures each build in turn, `runs` times, with `once(index, run)` giving the number of one run, and says
// what two builds' numbers come to. The builds take turns run by run, so a busy machine weighs on both
// alike. Ranges apart after the first runs get as many runs again, once
async function compare (labels, unit, digits, once) {
  const values = labels.map(() => [])
  const round = async from => {
    for (let run = from; run < from + runs; run++) {
      for (const index of labels.keys()) values[index].push(await once(index, run))
    }
  }
  const apart = () => lowest(values[0]) > highest(values[1]) || lowest(values[1]) > highest(values[0])
  await round(1)
  if (labels.length !== 2) return
  if (apart()) {
    console.log(`the two ranges are apart after ${runs} runs of each: ${runs} more of each`)
    await round(runs + 1)
  }
  const told = labels.map((label, index) => `${label} ${lowest(values[index]).toFixed(digits)}-${highest(values[index]).toFixed(digits)}`).join(', ')
  if (!apart()) return console.log(`VERDICT within noise: ${told} ${unit}`)
  const change = (mean(values[1]) / mean(values[0]) - 1) * 100
  console.log(`VERDICT apart: ${labels[1]} is ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'slower' : 'faster'} over ${values[0].length} runs of each (${told} ${unit})`)
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
    await compare(builds.map(({ label }) => label), 'ms/frame main thread', 2, async (index, run) => {
      await send('Page.navigate', { url: `http://127.0.0.1:${servers[index].address().port}/${debug ? '?debug' : ''}` })
      await sleep(2500)
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button: 'left', clickCount: 1 })
      }
      await sleep(7000)
      const before = await taskDuration()
      const frames = await evaluate('new Promise(resolve => { let n = 0; const start = performance.now(); const tick = () => { n++; if (performance.now() - start < 4000) requestAnimationFrame(tick); else resolve(n) }; requestAnimationFrame(tick) })')
      const after = await taskDuration()
      const perFrame = (after - before) * 1000 / frames
      console.log(`${builds[index].label}  run ${run}: ${(frames / 4).toFixed(0)} fps, ${perFrame.toFixed(2)} ms/frame main thread`)
      return perFrame
    })
  } finally {
    await close()
    for (const server of servers) server.close()
  }
}

const stepEntry = tree => `
import * as simulation from ${JSON.stringify(path.join(tree, 'src/lib/particle_simulation.ts').replaceAll(path.sep, '/'))}
import { createRandom, seedRandom } from ${JSON.stringify(path.join(tree, 'src/lib/random.ts').replaceAll(path.sep, '/'))}
${threeD ? `import { stepParticles3d } from ${JSON.stringify(path.join(tree, 'src/lib/particle_simulation_3d.ts').replaceAll(path.sep, '/'))}` : 'const stepParticles3d = null'}

export function run (count, hole, spin, inertia) {
  const { createParticleField, createInstanceData, createPaletteSampler, setParticleCount } = simulation
  const stepParticles = stepParticles3d ?? simulation.stepParticles
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
  }, spin > 0 ? { spinRight: 0, spinUp: spin * Math.SQRT1_2, spinToward: spin * Math.SQRT1_2 } : {}, inertia > 0 ? { inertia } : {},
    stepParticles3d ? { threeD: 1, holeWorldX: 0, holeWorldY: 0, holeWorldZ: 2500, cameraYaw: 0.7, cameraPitch: 0.35, cameraYawFrom: 0.7, cameraPitchFrom: 0.35 } : {})
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
  // The verdict is on the first number, the full field with the hole, which every law of the loop takes part in
  await compare(trees.map(({ label }) => label), 'ms/step for 24000 with the hole', 3, async (index, round) => {
    const run = loops[index]
    const withHole = run(24000, true, spin, inertia)
    console.log(`${trees[index].label}  run ${round}: 24000 with the hole ${withHole.toFixed(3)} ms/step · 24000 without ${run(24000, false, 0, 0).toFixed(3)} ms · 10000 without ${run(10000, false, 0, 0).toFixed(3)} ms`)
    return withHole
  })
}

// The films compared when none is named: every film of the scene in films/, which leaves out the zooms
// into the Mandelbrot set, by their names, and the reels, by their clips: a reel is named as its maker
// likes, and its clips are compared as the films they are
const SCENE_FILM = /\.(json|js)$/
const OTHER_FILM = /mandelbrot|reel/
const isReel = film => typeof film === 'object' && Array.isArray(film.clips)

function readFilms (files) {
  const folder = path.join(root, 'films')
  const read = file => {
    const text = fs.readFileSync(file, 'utf8')
    return { name: path.relative(root, file).replaceAll(path.sep, '/'), film: file.endsWith('.json') ? JSON.parse(text) : text }
  }
  if (files.length > 0) return files.map(file => read(path.resolve(file)))
  return fs.readdirSync(folder)
    .filter(name => SCENE_FILM.test(name) && !OTHER_FILM.test(name))
    .map(name => read(path.join(folder, name)))
    .filter(({ film }) => !isReel(film))
}

// builds: [{ label, dist }], the commit before the change first when there are two
async function films (builds, files) {
  for (const { dist } of builds) {
    if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`${dist} has no index.html; run pnpm build`)
  }
  const list = readFilms(files)
  const servers = await Promise.all(builds.map(({ dist }) => serve(dist, { pictures: root, isolated: crew })))
  const { send, close } = await openBrowser()
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description ?? 'the page threw')
    return reply.result?.result?.value
  }
  // The hash of each film's preview on one build, or the first line of why it could not be drawn
  const draw = async (index, wanted) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${servers[index].address().port}/?agent` })
    for (let i = 0; i < 300 && !(await evaluate('typeof window.space === "object"').catch(() => false)); i++) await sleep(100)
    await evaluate('document.fonts.ready.then(() => true)')
    const drawn = new Map()
    for (const { name, film } of wanted) {
      try {
        const image = await evaluate(`window.space.film.preview(${JSON.stringify(film)}, ${JSON.stringify({ at })}).then(sheet => sheet.image)`)
        drawn.set(name, { hash: createHash('sha256').update(image).digest('hex').slice(0, 16) })
      } catch (error) {
        drawn.set(name, { error: String(error.message ?? error).split('\n')[0].slice(0, 160) })
      }
    }
    return drawn
  }
  try {
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    if (builds.length === 1) {
      const drawn = await draw(0, list)
      for (const [name, { hash, error }] of drawn) console.log(`${name}  ${hash ?? 'cannot be drawn: ' + error}`)
      const failed = [...drawn.values()].filter(entry => entry.error).length
      if (failed > 0) process.exitCode = 1
      return console.log(`VERDICT ${failed > 0 ? `${failed} of ${list.length} cannot be drawn` : `hashed: ${list.length} films, nothing to compare them with (--against <commit>)`}`)
    }
    const [base, here] = builds.map(({ label }) => label)
    const before = await draw(0, list)
    const after = await draw(1, list)
    const same = name => before.get(name).hash !== undefined && before.get(name).hash === after.get(name).hash
    // A film the commit before cannot play uses what the change brings: there is nothing to compare it with
    const fresh = list.filter(({ name }) => before.get(name).error && !after.get(name).error)
    const broken = list.filter(({ name }) => after.get(name).error)
    const doubted = list.filter(({ name }) => !same(name) && !before.get(name).error && !after.get(name).error)
    const again = doubted.length > 0 ? [await draw(0, doubted), await draw(1, doubted)] : null
    const moved = []
    const unstable = []
    for (const { name } of list) {
      const [first, second] = [before.get(name), after.get(name)]
      if (same(name)) {
        console.log(`${name}  same ${first.hash}`)
      } else if (second.error) {
        console.log(`${name}  cannot be drawn on ${here}: ${second.error}`)
      } else if (first.error) {
        console.log(`${name}  new: ${base} cannot play it (${first.error})`)
      } else {
        const [baseAgain, hereAgain] = again.map(drawn => drawn.get(name).hash)
        if (baseAgain === hereAgain) {
          console.log(`${name}  same ${baseAgain} (a first draw was off: ${first.hash} and ${second.hash})`)
        } else if (baseAgain !== first.hash) {
          unstable.push(name)
          console.log(`${name}  not deterministic on ${base}: it drew ${first.hash}, then ${baseAgain}`)
        } else if (hereAgain !== second.hash) {
          moved.push(name)
          console.log(`${name}  DIFFERS, and ${here} draws it two ways: ${second.hash}, then ${hereAgain} (${base} ${first.hash} both times)`)
        } else {
          moved.push(name)
          console.log(`${name}  DIFFERS: ${base} ${first.hash}, ${here} ${second.hash}, both twice`)
        }
      }
    }
    const kept = list.length - moved.length - unstable.length - fresh.length - broken.length
    const also = [
      unstable.length > 0 ? `${unstable.length} not deterministic before the change, so no finding of it (${unstable.join(', ')})` : '',
      fresh.length > 0 ? `${fresh.length} new` : '',
      broken.length > 0 ? `${broken.length} cannot be drawn (${broken.map(({ name }) => name).join(', ')})` : ''
    ].filter(Boolean).join('; ')
    if (moved.length > 0 || broken.length > 0) process.exitCode = 1
    console.log(`VERDICT ${moved.length > 0 ? `the change moved ${moved.length} of ${list.length}: ${moved.join(', ')}` : `same bytes: ${kept} of ${list.length}`}${also ? '; ' + also : ''}`)
  } finally {
    await close()
    for (const server of servers) server.close()
  }
}

const here = { label: 'this checkout', tree: root, dist: path.join(root, 'dist') }
if (command === 'page' || command === 'step' || command === 'films') {
  const release = await takeTurn(`bench.mjs ${command}`)
  let base = null
  try {
    base = against ? checkout(against) : null
    if (command === 'step') {
      await step(base ? [{ label: base.label, tree: base.tree }, here] : [here])
    } else {
      if (base) {
        build(base.tree)
        build(root)
      }
      const both = base ? [{ label: base.label, dist: path.join(base.tree, 'dist') }, here] : null
      if (command === 'films') await films(both ?? [here], rest)
      else await page(both ?? (rest.length > 0 ? rest.map(dist => ({ label: dist, dist })) : [here]))
    }
  } finally {
    base?.remove()
    release()
  }
} else {
  console.log(USAGE)
  process.exitCode = command ? 1 : 0
}
