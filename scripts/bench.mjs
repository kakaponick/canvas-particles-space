#!/usr/bin/env node
// Frame time, measured the way CLAUDE.md's Measuring asks, and the bytes of the films for a change that wants
// them compared. Needs Node 22+ and Chrome, Chromium or Edge.
//
//   node scripts/bench.mjs page [<dist> ...] [--against <commit>] [--runs 2] [--debug] [--set '<json>']
//   node scripts/bench.mjs films [<film> ...] [--against <commit>] [--at 1.5,4,8,12]
//
// --against <commit> measures that commit beside this checkout: it is checked out into a temporary
// worktree (pnpm install --offline there, then pnpm build) and removed afterwards; this checkout is built
// too, so both builds are current. Without it page measures the dist
// folders it is given, or this checkout's dist/ as it was last built, and films prints this build's hashes.
//
// Each command ends in a line that begins VERDICT, and that line is the check's answer. One command runs
// at a time on this machine, in turn with the film server's previews and renders (turn.mjs): a
// measurement taken beside another one measures the other.
//
// page with --against compares the two builds by their ranges. Ranges that touch are "within
// noise". Ranges apart after the first runs get as many runs again, once, since two runs of each of two
// equal builds come out apart one time in three, and four of each one time in thirty-five; the verdict then
// says how far apart the means are.
//
// films draws a preview of each film on both builds and compares the pictures' hashes: the films named,
// or every film of the scene in films/ (not the fractal ones, not the reels), at the seconds of --at.
// A film whose hashes differ is drawn once more on both builds, which tells three things apart: a first
// draw that was off (the second pair agrees), a film that is not deterministic on the commit before the
// change, and a picture the change moved.
//
// page serves each build in headless Chrome at 1920x1080, clicks CLICK TO START, waits 7 s for the opening
// to end and counts rAF ticks over 4 s; main thread a frame is CDP's TaskDuration over that time divided by
// the ticks. The builds take turns run by run, so a busy machine weighs on both alike. --debug loads the
// page with ?debug, which opens the intro debugger. --set '{"threeD":true,"cameraYaw":40}' measures another
// scene than the default: the page is loaded with ?agent and the settings go through window.space.set once
// the opening has ended, a second before the count; against a commit, name only settings both builds have.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { execFileSync, execSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { takeTurn } from './turn.mjs'
import { removeTree } from './worktree.mjs'
import { filmFiles, filmsDir, readMeta } from './films.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = name => {
  const at = args.indexOf(name)
  if (at < 0) return undefined
  const [, value] = args.splice(at, 2)
  return value
}
const runs = Number(flag('--runs') ?? 2)
const against = flag('--against')
// The seconds of a film whose frames are compared; a film that ends sooner gives its last frame
const at = (flag('--at') ?? '1.5,4,8,12').split(',').map(Number)
const taken = name => args.includes(name) ? (args.splice(args.indexOf(name), 1), true) : false
const debug = taken('--debug')
// Settings of the scene to measure, as window.space.set takes them
const scene = flag('--set')
if (scene !== undefined) JSON.parse(scene)
const [command, ...rest] = args
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const USAGE = 'node scripts/bench.mjs page [<dist> ...] [--against <commit>] [--runs 2] [--debug] [--set \'<json>\']\n' +
  'node scripts/bench.mjs films [<film> ...] [--against <commit>] [--at 1.5,4,8,12]'

// The temporary folder by its long name: git records a worktree's path as given, and Windows hands out
// the short form (KAKAPO~1) that git then cannot match
const temp = fs.realpathSync.native(os.tmpdir())

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
// from its checkout
function serve (dist, { pictures = null } = {}) {
  const missing = file => !fs.existsSync(file) || fs.statSync(file).isDirectory()
  const server = createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url, 'http://x').pathname)
    let file = path.join(dist, name)
    if (name !== '/' && missing(file) && pictures && !missing(path.join(pictures, name))) file = path.join(pictures, name)
    if (name === '/' || missing(file)) file = path.join(dist, 'index.html')
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
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
      const query = [debug && 'debug', scene !== undefined && 'agent'].filter(Boolean).join('&')
      await send('Page.navigate', { url: `http://127.0.0.1:${servers[index].address().port}/${query && `?${query}`}` })
      await sleep(2500)
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button: 'left', clickCount: 1 })
      }
      await sleep(7000)
      if (scene !== undefined) {
        const told = await evaluate(`(() => { try { return JSON.stringify(window.space.set(${scene}).clamped) } catch (error) { return 'refused: ' + error.message } })()`)
        if (told !== '[]' && told !== '{}') console.log(`${builds[index].label}  set: ${told}`)
        await sleep(1000)
      }
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

// The films compared when none is named: every film of the scene in films/ and every part of one (a clip, a
// poster, a take: films.mjs, filmFiles), which leaves out the zooms into the Mandelbrot set, by their folder's
// kind, and the reels, by their clips: a reel's clips are compared as the films they are
const isReel = film => typeof film === 'object' && Array.isArray(film.clips)
const isFractal = file => {
  const folder = path.join(filmsDir, file.split('/')[0])
  return file.includes('/') && fs.existsSync(path.join(folder, 'meta.json')) && readMeta(folder).kind === 'fractal'
}

function readFilms (files) {
  const read = file => {
    const text = fs.readFileSync(file, 'utf8')
    return { name: path.relative(root, file).replaceAll(path.sep, '/'), film: file.endsWith('.json') ? JSON.parse(text) : text }
  }
  if (files.length > 0) return files.map(file => read(path.resolve(file)))
  return filmFiles()
    .filter(file => !isFractal(file) && !/mandelbrot/.test(file))
    .map(file => read(path.join(filmsDir, file)))
    .filter(({ film }) => !isReel(film))
}

// builds: [{ label, dist }], the commit before the change first when there are two
async function films (builds, files) {
  for (const { dist } of builds) {
    if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`${dist} has no index.html; run pnpm build`)
  }
  const list = readFilms(files)
  const servers = await Promise.all(builds.map(({ dist }) => serve(dist, { pictures: root })))
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

const here = { label: 'this checkout', dist: path.join(root, 'dist') }
if (command === 'page' || command === 'films') {
  // A measurement has the machine alone: no film is drawn beside it and no browser started
  const release = await takeTurn(`bench.mjs ${command}`, undefined, { alone: true })
  let base = null
  try {
    base = against ? checkout(against) : null
    if (base) {
      build(base.tree)
      build(root)
    }
    const both = base ? [{ label: base.label, dist: path.join(base.tree, 'dist') }, here] : null
    if (command === 'films') await films(both ?? [here], rest)
    else await page(both ?? (rest.length > 0 ? rest.map(dist => ({ label: dist, dist })) : [here]))
  } finally {
    base?.remove()
    release()
  }
} else {
  console.log(USAGE)
  process.exitCode = command ? 1 : 0
}
