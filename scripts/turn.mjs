// One job that drives Chrome at a time on this machine. Several agents work here at once, and a film
// drawn or a build measured beside another measurement moves its numbers by more than the change under
// test does. So the measurements of bench.mjs and the drawing tools of the film server take turns: each
// holds a file in the temporary folder while it works, and the next waits for it.
//
//   const release = await takeTurn('bench page')
//   try { ... } finally { release() }
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HELD = path.join(os.tmpdir(), 'space-chrome-turn')
const POLL_MS = 1500
// A holder that has not yet written its name is given this long before its file counts as left behind
const NAMELESS_MS = 5000

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

// Who holds the turn: its process and what it does, or null when the file was left by a process that is gone
function holder () {
  try {
    const [pid, ...what] = fs.readFileSync(HELD, 'utf8').split(' ')
    if (Number(pid) > 0) return alive(Number(pid)) ? { pid: Number(pid), what: what.join(' ') } : null
    return Date.now() - fs.statSync(HELD).mtimeMs < NAMELESS_MS ? { pid: 0, what: 'a job that is starting' } : null
  } catch {
    return null
  }
}

// Waits until no other job holds the turn, takes it and returns what gives it back. `say` is told once,
// when there is a wait, who is being waited for
export async function takeTurn (what, say = text => console.error(text)) {
  let told = false
  for (;;) {
    try {
      fs.writeFileSync(HELD, `${process.pid} ${what}`, { flag: 'wx' })
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
  return release
}
