// One job that draws in Chrome at a time on this machine. Several agents work here at once, and a film
// drawn or a build measured beside another measurement moves its numbers by more than the change under
// test does. So the measurements of bench.mjs and the drawing tools of the film server take turns: each
// holds a file in the temporary folder while it works, and the next waits for it.
//
//   const release = await takeTurn('bench page')
//   try { ... } finally { release() }
//
// A turn is held for the drawing alone. What comes before it, a browser started and a page loaded, a job
// does while others draw (getReady), but never beside a measurement: a measurement takes its turn alone
// ({ alone: true }), which also waits for the jobs that are getting ready.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HELD = path.join(os.tmpdir(), 'space-chrome-turn')
// A file for each job that is getting ready, named by its process
const READY = path.join(os.tmpdir(), 'space-chrome-ready')
// How often a job that waits looks again. A drawing holds the turn for a second or two, so a longer sleep
// would leave the turn free for a good part of that between two drawings
const POLL_MS = 250
// A holder that has not yet written its name is given this long before its file counts as left behind
const NAMELESS_MS = 5000
// What a measurement's turn is named with, after its process: a job that is getting ready reads it there
const ALONE = 'alone: '

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function alive (pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // No right to signal it still means it is there
    return error.code === 'EPERM'
  }
}

// Who holds the turn: its process, what it does and whether it wants the machine alone, or null when the
// file was left by a process that is gone. bench.mjs of a checkout from before `alone` is known by its name
function holder () {
  try {
    const [pid, ...words] = fs.readFileSync(HELD, 'utf8').split(' ')
    const named = words.join(' ')
    const alone = named.startsWith(ALONE)
    const what = alone ? named.slice(ALONE.length) : named
    if (Number(pid) > 0) return alive(Number(pid)) ? { pid: Number(pid), what, alone: alone || what.startsWith('bench.mjs') } : null
    return Date.now() - fs.statSync(HELD).mtimeMs < NAMELESS_MS ? { pid: 0, what: 'a job that is starting', alone: false } : null
  } catch {
    return null
  }
}

// The processes that are getting ready now, this one left out; a file left by one that is gone is taken away
function gettingReady () {
  let names
  try {
    names = fs.readdirSync(READY)
  } catch {
    return []
  }
  const others = []
  for (const name of names) {
    const pid = Number(name)
    if (pid === process.pid) continue
    if (alive(pid)) others.push(pid)
    else fs.rmSync(path.join(READY, name), { force: true })
  }
  return others
}

const seconds = since => ((Date.now() - since) / 1000).toFixed(1)

// Waits until no other job holds the turn, takes it and returns what gives it back. `say` is told once,
// when there is a wait, who is being waited for, and once more when the turn has come. `alone` is a
// measurement's turn: it also waits until no job is getting ready
export async function takeTurn (what, say = text => console.error(text), { alone = false } = {}) {
  const asked = Date.now()
  let told = false
  for (;;) {
    try {
      fs.writeFileSync(HELD, `${process.pid} ${alone ? ALONE : ''}${what}`, { flag: 'wx' })
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
    const other = holder()
    if (!other) {
      // Left behind by a process that ended without giving it back
      fs.rmSync(HELD, { force: true })
      continue
    }
    if (!told) say(`waiting for ${other.what} (process ${other.pid}) to finish: one check or film at a time on this machine`)
    told = true
    await sleep(POLL_MS)
  }
  let held = true
  const release = () => {
    if (!held) return
    held = false
    process.off('exit', release)
    fs.rmSync(HELD, { force: true })
  }
  process.on('exit', release)
  if (alone) {
    // The turn is held, so no job starts getting ready from here on; the ones that had started finish
    for (let others = gettingReady(); others.length > 0; others = gettingReady()) {
      if (!told) say(`waiting for ${others.length === 1 ? `a job that is starting its browser (process ${others[0]})` : `${others.length} jobs that are starting their browsers`}: nothing starts beside a measurement`)
      told = true
      await sleep(POLL_MS)
    }
  }
  if (told) say(`the turn came after ${seconds(asked)} s`)
  return release
}

// Does what a job needs before its turn (`work`: a browser started, a page loaded) while others draw, but
// not while a measurement holds the turn. The job says it is getting ready before it looks who holds the
// turn, and a measurement looks for such jobs after it has taken the turn, so one of the two sees the other
export async function getReady (work, say = text => console.error(text)) {
  const mine = path.join(READY, String(process.pid))
  const asked = Date.now()
  let told = false
  for (;;) {
    fs.mkdirSync(READY, { recursive: true })
    fs.writeFileSync(mine, '')
    const other = holder()
    if (!other?.alone) break
    fs.rmSync(mine, { force: true })
    if (!told) say(`waiting for ${other.what} (process ${other.pid}) to finish: nothing starts beside a measurement`)
    told = true
    await sleep(POLL_MS)
  }
  const leave = () => fs.rmSync(mine, { force: true })
  process.on('exit', leave)
  try {
    if (told) say(`the measurement ended after ${seconds(asked)} s`)
    return await work()
  } finally {
    process.off('exit', leave)
    leave()
  }
}
