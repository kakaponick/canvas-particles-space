// The operator's screen: one page the operator keeps open (in T3 Code's own browser), which shows whatever
// simulation an agent or a subagent last put on it. Agents need only a shell: no browser tool of their own.
//
//   node scripts/screen.mjs live <film> ["who: what it shows"] from a worktree: its dev server (started once,
//                                                          then reused) plays films/<film> at ?live=, and
//                                                          the screen shows it
//   node scripts/screen.mjs show <address> ["what it shows"] the screen shows any address
//   node scripts/screen.mjs stop                            stops this worktree's dev server (before the
//                                                          worktree is removed)
//   node scripts/screen.mjs status                          what the screen shows and the servers it knows
//
// The screen itself is http://127.0.0.1:5199/, a small server this script starts the first time it is
// needed and leaves running. Its page asks every second what to show and puts it in a frame that fills it,
// with one line above, pressed to the left: who shows what, when, from which branch and film, and a button
// that lists the last few things shown to go back to. The
// state lives in the temporary folder, so a screen started again shows what it showed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import process from 'node:process'
import { createServer } from 'node:http'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCREEN_PORT = 5199
const SCREEN = `http://127.0.0.1:${SCREEN_PORT}`
const STATE = path.join(os.tmpdir(), 'space-screen.json')
// The dev servers of the worktrees take ports from here up
const FIRST_PORT = 5200
// How many shown things the bar offers to go back to
const HISTORY = 12

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function readState () {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'))
  } catch {
    return { shown: null, history: [], servers: {} }
  }
}

function writeState (state) {
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2))
}

function alive (pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Whether something answers on a port of this machine
function answers (port) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

async function freePort (taken) {
  for (let port = FIRST_PORT; port < FIRST_PORT + 100; port++) {
    if (!taken.has(port) && !(await answers(port))) return port
  }
  throw new Error(`No free port from ${FIRST_PORT} to ${FIRST_PORT + 99}`)
}

async function waitFor (port, seconds) {
  for (let tries = 0; tries < seconds * 4; tries++) {
    if (await answers(port)) return true
    await sleep(250)
  }
  return false
}

// The screen's server, started detached the first time it is needed
async function ensureScreen () {
  if (await answers(SCREEN_PORT)) return false
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve'], { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  if (!(await waitFor(SCREEN_PORT, 10))) throw new Error(`The screen did not come up on ${SCREEN}`)
  return true
}

// The branch the worktree is on, which the screen names as where the picture comes from
function branchOf () {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function show (address, label) {
  const started = await ensureScreen()
  const response = await fetch(`${SCREEN}/show`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: address, label: label ?? '', from: root, branch: branchOf() }) })
  if (!response.ok) throw new Error(`The screen refused: ${await response.text()}`)
  console.log(`The screen (${SCREEN}/) shows ${address}${started ? '; the screen was started now, so open it once in T3 Code\'s browser' : ''}`)
}

// This worktree's dev server: the one it started before if it still answers, else a new one
async function devServer () {
  const state = readState()
  const known = state.servers[root]
  if (known && alive(known.pid) && await answers(known.port)) return known.port
  const taken = new Set(Object.values(state.servers).map(server => server.port))
  const port = await freePort(taken)
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(vite)) throw new Error(`No ${vite}: link this worktree's node_modules to the main checkout's first (CLAUDE.md)`)
  const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  if (!(await waitFor(port, 30))) throw new Error(`The dev server of ${root} did not come up on port ${port}`)
  const next = readState()
  next.servers[root] = { port, pid: child.pid }
  writeState(next)
  return port
}

async function live (film, label) {
  if (!film) throw new Error('Name a film of films/: node scripts/screen.mjs live <film> ["what it shows"]')
  const name = path.basename(film)
  if (!fs.existsSync(path.join(root, 'films', name))) throw new Error(`No films/${name} in ${root}: a scratch film goes there as films/_lab_<name>.js`)
  // The operator sees this worktree's whole page, so a branch behind master shows a page master has changed
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'master', 'HEAD'], { cwd: root, stdio: 'ignore' })
  } catch {
    throw new Error(`${root} is behind master: rebase it first (git rebase master), or the operator sees a page master has already changed`)
  }
  const port = await devServer()
  await show(`http://127.0.0.1:${port}/?live=${encodeURIComponent(name)}`, label ?? name)
}

function stop () {
  const state = readState()
  const known = state.servers[root]
  if (!known) {
    console.log(`No dev server of ${root} is known`)
    return
  }
  if (alive(known.pid)) process.kill(known.pid)
  delete state.servers[root]
  writeState(state)
  console.log(`Stopped the dev server of ${root} (port ${known.port})`)
}

const PAGE = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Экран</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #cfd8dc; font: 12px/24px system-ui, 'Segoe UI', sans-serif }
  body { display: flex; flex-direction: column }
  /* One line pressed to the left edge: each fact with its name; only what is shown gives way, with an ellipsis */
  header { position: relative; flex: none; display: flex; align-items: center; gap: 14px; height: 24px; padding-right: 8px; background: #0b0f12; border-bottom: 1px solid #1d2a30; white-space: nowrap; overflow: hidden }
  .fact { flex: none; display: flex; gap: 4px; min-width: 0 }
  .fact b { font-weight: 400; color: #7f9aa3 }
  .fact span { color: #fff; overflow: hidden; text-overflow: ellipsis }
  #what { flex: 0 1 auto }
  #open { flex: none; height: 24px; padding: 0 10px; border: 0; border-right: 1px solid #1d2a30; background: none; color: #cfd8dc; font: inherit; cursor: pointer }
  #open:hover, #open[aria-expanded="true"] { background: #142026; color: #fff }
  /* What was shown before, opened from the button at the left, under it */
  #history { position: absolute; top: 25px; left: 0; z-index: 2; min-width: 420px; max-width: 100%; margin: 0; padding: 4px 0; list-style: none; background: #0b0f12; border: 1px solid #1d2a30; border-top: 0 }
  #history[hidden] { display: none }
  #history button { display: block; width: 100%; padding: 2px 10px; border: 0; background: none; color: #cfd8dc; font: inherit; line-height: 18px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer }
  #history button:hover, #history button:focus-visible { background: #142026; outline: none }
  #history button[aria-current="true"] { color: #fff }
  #history .when { color: #7f9aa3; margin-right: 8px }
  iframe { flex: 1; width: 100%; border: 0; background: #000 }
  #empty { flex: 1; display: grid; place-items: center; color: #7f9aa3 }
</style></head>
<body>
<header>
  <button id="open" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="history" title="Что показывали раньше">История ▾</button>
  <span class="fact" id="who-fact"><b>Кто:</b><span id="who">—</span></span>
  <span class="fact" id="what"><b>Показывает:</b><span id="what-text">пока ничего</span></span>
  <span class="fact"><b>Когда:</b><span id="when">—</span></span>
  <span class="fact" id="where-fact"><b>Откуда:</b><span id="where">—</span></span>
  <ul id="history" hidden></ul>
</header>
<div id="empty">Ждёт агента: node scripts/screen.mjs live &lt;фильм&gt; "кто: что показывает"</div>
<script>
  let current = null
  let shownEntry = null
  let pinned = null
  let history = []
  const clock = at => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  // How long ago, in words: "только что", "5 мин назад", "2 ч назад"
  const ago = at => {
    const minutes = Math.floor((Date.now() - at) / 60000)
    if (minutes < 1) return 'только что'
    if (minutes < 60) return minutes + ' мин назад'
    return Math.floor(minutes / 60) + ' ч назад'
  }
  // "who: what" as the agent wrote it; with no "who" the whole label is what is shown
  const split = entry => {
    const text = entry.label || entry.url
    const at = text.indexOf(': ')
    return at > 0 ? { who: text.slice(0, at), what: text.slice(at + 2) } : { who: '', what: text }
  }
  // Where it comes from: the branch, or the main checkout, and the film's file
  const where = entry => {
    const film = new URL(entry.url).searchParams.get('live') || new URL(entry.url).searchParams.get('film') || ''
    const branch = entry.branch ? (entry.branch === 'master' ? 'master' : 'ветка ' + entry.branch) : ''
    return [branch, film].filter(Boolean).join(', ')
  }
  const open = document.getElementById('open')
  const list = document.getElementById('history')
  function facts (entry) {
    const { who, what } = split(entry)
    document.getElementById('who').textContent = who || '—'
    const whatText = document.getElementById('what-text')
    whatText.textContent = what
    whatText.title = what
    document.getElementById('when').textContent = clock(entry.at) + ', ' + ago(entry.at)
    document.getElementById('where').textContent = where(entry) || '—'
    document.getElementById('where').title = entry.url
  }
  function put (entry) {
    if (!entry) return
    shownEntry = entry
    facts(entry)
    if (entry.url === current) return
    current = entry.url
    let frame = document.querySelector('iframe')
    if (!frame) {
      document.getElementById('empty').remove()
      frame = document.createElement('iframe')
      frame.allow = 'fullscreen; autoplay'
      document.body.append(frame)
    }
    frame.src = entry.url
  }
  function fill () {
    list.replaceChildren(...history.map(entry => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      const { who, what } = split(entry)
      button.type = 'button'
      button.setAttribute('aria-current', String(entry.url === current))
      const when = document.createElement('span')
      when.className = 'when'
      when.textContent = clock(entry.at)
      button.append(when, (who ? who + ' — ' : '') + what)
      button.title = (who ? who + ' — ' : '') + what + ' (' + where(entry) + ')'
      button.addEventListener('click', () => { pinned = entry; put(entry); close() })
      item.append(button)
      return item
    }))
  }
  function show () { fill(); list.hidden = false; open.setAttribute('aria-expanded', 'true'); list.querySelector('button')?.focus() }
  function close () { list.hidden = true; open.setAttribute('aria-expanded', 'false') }
  open.addEventListener('click', () => { if (list.hidden) show(); else close() })
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !list.hidden) { close(); open.focus() } })
  document.addEventListener('pointerdown', event => { if (!list.hidden && !event.target.closest('header')) close() })
  async function poll () {
    try {
      const state = await (await fetch('/state')).json()
      // Something new shown lets go of an older one picked from the list
      if (state.shown && (!history[0] || state.shown.at !== history[0].at)) pinned = null
      history = state.history
      put(pinned ?? state.shown)
    } catch {}
    setTimeout(poll, 1000)
  }
  poll()
</script>
</body></html>`

function serve () {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && (request.url === '/' || request.url.startsWith('/?'))) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      response.end(PAGE)
    } else if (request.method === 'GET' && request.url === '/state') {
      const state = readState()
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ shown: state.shown, history: state.history }))
    } else if (request.method === 'POST' && request.url === '/show') {
      let body = ''
      request.on('data', chunk => { body += chunk })
      request.on('end', () => {
        try {
          const { url, label, from, branch } = JSON.parse(body)
          if (!/^https?:\/\//.test(url)) throw new Error('an http address')
          const state = readState()
          const entry = { url, label, from, branch, at: Date.now() }
          state.shown = entry
          state.history = [entry, ...state.history.filter(old => old.url !== url)].slice(0, HISTORY)
          writeState(state)
          response.writeHead(200).end('shown')
        } catch (error) {
          response.writeHead(400).end(String(error.message ?? error))
        }
      })
    } else {
      response.writeHead(404).end()
    }
  })
  server.listen(SCREEN_PORT, '127.0.0.1')
}

const [command, ...rest] = process.argv.slice(2)
try {
  if (command === 'serve') serve()
  else if (command === 'live') await live(rest[0], rest[1])
  else if (command === 'show') await show(rest[0], rest[1])
  else if (command === 'stop') stop()
  else if (command === 'status') {
    await ensureScreen()
    console.log(JSON.stringify({ screen: `${SCREEN}/`, ...readState() }, null, 2))
  } else {
    console.log('node scripts/screen.mjs live <film> ["what it shows"] | show <address> ["what it shows"] | stop | status')
    process.exitCode = 1
  }
} catch (error) {
  console.error(error.message ?? error)
  process.exitCode = 1
}
