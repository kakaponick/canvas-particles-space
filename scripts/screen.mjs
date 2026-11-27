// The operator's screen: one page the operator keeps open (in T3 Code's own browser), which shows whatever
// simulation an agent or a subagent last put on it. Agents need only a shell: no browser tool of their own.
//
//   node scripts/screen.mjs live <film> ["what it shows"]   from a worktree: its dev server (started once,
//                                                          then reused) plays films/<film> at ?live=, and
//                                                          the screen shows it
//   node scripts/screen.mjs show <address> ["what it shows"] the screen shows any address
//   node scripts/screen.mjs stop                            stops this worktree's dev server (before the
//                                                          worktree is removed)
//   node scripts/screen.mjs status                          what the screen shows and the servers it knows
//
// The screen itself is http://127.0.0.1:5199/, a small server this script starts the first time it is
// needed and leaves running. Its page asks every second what to show and puts it in a frame that fills it,
// with a bar above: what it shows, which worktree, when, and the last few things shown to go back to. The
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

async function show (address, label) {
  const started = await ensureScreen()
  const response = await fetch(`${SCREEN}/show`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: address, label: label ?? '', from: root }) })
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
<html lang="en"><head><meta charset="utf-8"><title>Operator's screen</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #cfd8dc; font: 13px/1.3 ui-monospace, Consolas, monospace }
  body { display: flex; flex-direction: column }
  header { display: flex; gap: 14px; align-items: center; padding: 6px 10px; background: #0b0f12; border-bottom: 1px solid #1d2a30 }
  #label { color: #fff; font-weight: 600 }
  #from, #at { color: #7f9aa3 }
  select { margin-left: auto; background: #0b0f12; color: #cfd8dc; border: 1px solid #1d2a30; font: inherit }
  iframe { flex: 1; width: 100%; border: 0; background: #000 }
  #empty { flex: 1; display: grid; place-items: center; color: #7f9aa3 }
</style></head>
<body>
<header><span id="label">Nothing shown yet</span><span id="from"></span><span id="at"></span><select id="history" title="Shown before"></select></header>
<div id="empty">Waiting for an agent: node scripts/screen.mjs live &lt;film&gt;</div>
<script>
  let current = null
  let pinned = null
  const frame = () => document.querySelector('iframe')
  function put (entry) {
    if (!entry || entry.url === current) return
    current = entry.url
    let element = frame()
    if (!element) {
      document.getElementById('empty').remove()
      element = document.createElement('iframe')
      element.allow = 'fullscreen; autoplay'
      document.body.append(element)
    }
    element.src = entry.url
    document.getElementById('label').textContent = entry.label || entry.url
    document.getElementById('from').textContent = entry.from ? entry.from.split(/[\\\\/]/).pop() : ''
    document.getElementById('at').textContent = new Date(entry.at).toLocaleTimeString()
  }
  async function poll () {
    try {
      const state = await (await fetch('/state')).json()
      const select = document.getElementById('history')
      const options = state.history.map((entry, index) => '<option value="' + index + '">' + new Date(entry.at).toLocaleTimeString() + ' · ' + (entry.label || entry.url).replace(/</g, '&lt;') + '</option>')
      if (select.dataset.count !== String(state.history.length) || select.dataset.top !== String(state.history[0] && state.history[0].at)) {
        select.innerHTML = options.join('')
        select.dataset.count = String(state.history.length)
        select.dataset.top = String(state.history[0] && state.history[0].at)
        pinned = null
        select.value = '0'
      }
      put(pinned ?? state.shown)
    } catch {}
    setTimeout(poll, 1000)
  }
  document.getElementById('history').addEventListener('change', async event => {
    const state = await (await fetch('/state')).json()
    pinned = state.history[Number(event.target.value)]
    put(pinned)
  })
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
          const { url, label, from } = JSON.parse(body)
          if (!/^https?:\/\//.test(url)) throw new Error('an http address')
          const state = readState()
          const entry = { url, label, from, at: Date.now() }
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
