// The operator's screen: one page the operator keeps open (in T3 Code's own browser), which shows whatever
// simulation an agent or a subagent last put on it. Agents need only a shell: no browser tool of their own.
//
//   node scripts/screen.mjs live <film> "<what>" --by "<who>"   from a worktree: its dev server (started once,
//                                                          then reused) plays films/<film> at ?live=, and
//                                                          the screen shows it
//   node scripts/screen.mjs show <address> "<what>" --by "<who>" the screen shows any address
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
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    // A branch standing where master stands shows what master shows
    return git('rev-parse', 'HEAD') === git('rev-parse', 'master') ? 'master' : git('rev-parse', '--abbrev-ref', 'HEAD')
  } catch {
    return ''
  }
}

async function show (address, label, by) {
  const started = await ensureScreen()
  const response = await fetch(`${SCREEN}/show`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: address, label: label ?? '', by: by ?? '', from: root, branch: branchOf() }) })
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

async function live (film, label, by) {
  if (!film) throw new Error('Name a film of films/: node scripts/screen.mjs live <film> "<what>" --by "<who>"')
  const name = path.basename(film)
  if (!fs.existsSync(path.join(root, 'films', name))) throw new Error(`No films/${name} in ${root}: a scratch film goes there as films/_lab_<name>.js`)
  // The operator sees this worktree's whole page, so a branch behind master shows a page master has changed
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'master', 'HEAD'], { cwd: root, stdio: 'ignore' })
  } catch {
    throw new Error(`${root} is behind master: rebase it first (git rebase master), or the operator sees a page master has already changed`)
  }
  const port = await devServer()
  await show(`http://127.0.0.1:${port}/?live=${encodeURIComponent(name)}`, label ?? name, by)
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
  :root { --ground: #000; --bar: #0a0e11; --line: #1a252b; --hover: #13202a; --text: #e8eef1; --muted: #8aa1a9; --focus: #4de3ff }
  html, body { margin: 0; height: 100%; background: var(--ground); color: var(--text); font: 12px/1 system-ui, 'Segoe UI', sans-serif }
  body { display: flex; flex-direction: column }
  ::selection { background: #1f4652; color: #fff }
  :focus-visible { outline: 1px solid var(--focus); outline-offset: -1px }
  /* One line from the left edge, read as a sentence: what is shown, who showed it, how long ago, from where.
     Only the title gives way, with an ellipsis; the rest keeps its width */
  header { position: relative; flex: none; display: flex; align-items: center; height: 26px; background: var(--bar); border-bottom: 1px solid var(--line); white-space: nowrap }
  #open { flex: none; display: grid; place-items: center; width: 30px; height: 26px; padding: 0; border: 0; border-right: 1px solid var(--line); background: none; color: var(--muted); cursor: pointer }
  #open:hover, #open[aria-expanded="true"] { background: var(--hover); color: var(--text) }
  #open svg { width: 14px; height: 14px }
  #line { flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: 6px; padding: 0 10px; overflow: hidden }
  #what { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 500 }
  .meta { flex: none; color: var(--muted) }
  .meta::before { content: '·'; margin-right: 6px }
  #by:empty { display: none }
  #by::before { content: '—'; margin-right: 6px }
  #source { font: 11px/1 ui-monospace, Consolas, monospace }
  /* What was shown before: opened from the button at the left edge, under it */
  #history { position: absolute; top: 27px; left: 0; z-index: 2; width: min(560px, 100vw); max-height: 60vh; margin: 0; padding: 4px 0; overflow-y: auto; list-style: none; background: var(--bar); border: 1px solid var(--line); border-top: 0; box-shadow: 0 8px 24px rgb(0 0 0 / 0.5) }
  #history[hidden] { display: none }
  #history button { display: flex; align-items: baseline; gap: 8px; width: 100%; padding: 6px 10px; border: 0; background: none; color: var(--text); font: inherit; text-align: left; white-space: nowrap; cursor: pointer }
  #history button:hover, #history button:focus-visible { background: var(--hover); outline: none }
  #history button[aria-current="true"] { background: #0f1a20 }
  .item-now { flex: none; margin-left: auto; padding-left: 12px; color: var(--muted) }
  #history time { flex: none; color: var(--muted); font-variant-numeric: tabular-nums }
  .item-what { min-width: 0; overflow: hidden; text-overflow: ellipsis }
  .item-by { flex: none; color: var(--muted) }
  iframe { flex: 1; width: 100%; border: 0; background: var(--ground) }
  #empty { flex: 1; display: grid; place-items: center; color: var(--muted); font-size: 13px; line-height: 1.6; text-align: center }
  #empty code { color: var(--text); font: 12px ui-monospace, Consolas, monospace }
</style></head>
<body>
<header>
  <button id="open" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="history" aria-label="Что показывали раньше" title="Что показывали раньше">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
  </button>
  <div id="line">
    <span id="what">Здесь появится то, что покажет агент</span>
    <span class="meta" id="by"></span>
    <time class="meta" id="ago" hidden></time>
    <span class="meta" id="source" hidden></span>
  </div>
  <ul id="history" hidden aria-label="Что показывали раньше"></ul>
</header>
<div id="empty">Пока ничего не показано.<br>Агент выводит сюда симуляцию командой <code>node scripts/screen.mjs live &lt;фильм&gt; "&lt;что&gt;" --by "&lt;кто&gt;"</code></div>
<script>
  let current = null
  let pinned = null
  let history = []
  const clock = at => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  const ago = at => {
    const minutes = Math.floor((Date.now() - at) / 60000)
    if (minutes < 1) return 'только что'
    if (minutes < 60) return minutes + ' мин назад'
    return Math.floor(minutes / 60) + ' ч назад'
  }
  const filmOf = entry => { const address = new URL(entry.url); return address.searchParams.get('live') || address.searchParams.get('film') || '' }
  // Where it comes from, in the operator's words: master, or a branch still at work
  const sourceOf = entry => entry.branch && entry.branch !== 'master' ? 'ветка ' + entry.branch : 'master'
  const capital = text => text ? text[0].toUpperCase() + text.slice(1) : text
  const open = document.getElementById('open')
  const list = document.getElementById('history')
  function facts (entry) {
    const what = document.getElementById('what')
    what.textContent = capital(entry.label || filmOf(entry) || entry.url)
    what.title = what.textContent
    document.getElementById('by').textContent = entry.by || ''
    const time = document.getElementById('ago')
    time.hidden = false
    time.dateTime = new Date(entry.at).toISOString()
    time.textContent = ago(entry.at)
    time.title = 'Показано в ' + clock(entry.at)
    const source = document.getElementById('source')
    source.hidden = false
    source.textContent = sourceOf(entry)
    source.title = 'Фильм ' + (filmOf(entry) || '—') + (entry.from ? ', рабочая копия ' + entry.from : '')
  }
  function put (entry) {
    if (!entry) return
    facts(entry)
    if (entry.url === current) return
    current = entry.url
    let frame = document.querySelector('iframe')
    if (!frame) {
      document.getElementById('empty').remove()
      frame = document.createElement('iframe')
      frame.allow = 'fullscreen; autoplay'
      frame.title = 'Симуляция'
      document.body.append(frame)
    }
    frame.src = entry.url
  }
  function fill () {
    list.replaceChildren(...history.map(entry => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-current', String(entry.url === current))
      const time = document.createElement('time')
      time.textContent = clock(entry.at)
      const what = document.createElement('span')
      what.className = 'item-what'
      what.textContent = capital(entry.label || filmOf(entry) || entry.url)
      button.append(time, what)
      if (entry.by) {
        const by = document.createElement('span')
        by.className = 'item-by'
        by.textContent = entry.by
        button.append(by)
      }
      if (entry.url === current) {
        const now = document.createElement('span')
        now.className = 'item-now'
        now.textContent = 'на экране'
        button.append(now)
      }
      button.title = what.textContent + ' (' + sourceOf(entry) + ', ' + (filmOf(entry) || entry.url) + ')'
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
          const { url, label, by, from, branch } = JSON.parse(body)
          if (!/^https?:\/\//.test(url)) throw new Error('an http address')
          const state = readState()
          const entry = { url, label, by, from, branch, at: Date.now() }
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

const [command, ...words] = process.argv.slice(2)
// --by "<who>" may stand anywhere after the command; the rest are the command's own words in order
const byAt = words.indexOf('--by')
const by = byAt >= 0 ? words[byAt + 1] : undefined
const rest = byAt >= 0 ? words.filter((_, index) => index !== byAt && index !== byAt + 1) : words
try {
  if (command === 'serve') serve()
  else if (command === 'live') await live(rest[0], rest[1], by)
  else if (command === 'show') await show(rest[0], rest[1], by)
  else if (command === 'stop') stop()
  else if (command === 'status') {
    await ensureScreen()
    console.log(JSON.stringify({ screen: `${SCREEN}/`, ...readState() }, null, 2))
  } else {
    console.log('node scripts/screen.mjs live <film> "<what>" --by "<who>" | show <address> "<what>" --by "<who>" | stop | status')
    process.exitCode = 1
  }
} catch (error) {
  console.error(error.message ?? error)
  process.exitCode = 1
}
