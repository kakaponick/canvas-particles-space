// A rented machine that speaks a film's lines in Fish Audio Drama 3, from start to deletion, in one command:
// a Runpod pod of scripts/drama3_server.sh with its servers, then the film's voice script speaking the lines not
// yet spoken on them (DRAMA3_SERVERS), then the pod deleted whatever happened, and what it cost. The skill
// film-voice says when to use it; the global runpod-rent skill says how the account and its money are handled.
//   RUNPOD_KEY_FILE=<file holding a Runpod API key> node scripts/drama3_pod.mjs <film> [voice,voice,...] [--set <DRAMA3_SET>] [--dry]
// <film> names films/<film>/voice.mjs; [voice] one or more of its VOICES, comma-separated, spoken one after another
// on the same pod (its first by default). --dry lists what would be spoken and rents nothing. The key is read inside this process and never printed.
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// The cards a pod may take, in order, the next tried when one is out of stock: the prebuilt server runs on
// compute capability 7.5 to 9.0 (no Blackwell), and 80 GB holds three Q4_K_S servers
export const GPUS = ['NVIDIA A100-SXM4-80GB', 'NVIDIA A100 80GB PCIe', 'NVIDIA H100 PCIe', 'NVIDIA H100 NVL']
// The servers' ports: 8080 up, skipping 8082, where the machine serves its stages, card and logs
export const PORTS = [8080, 8081, 8083, 8084]
const BOOT_LIMIT = 20 * 60e3

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export const keyOf = () => fs.readFileSync(process.env.RUNPOD_KEY_FILE ?? '', 'utf8').trim()

// Runpod's REST API v2 (the global runpod-rent skill's api.md), as the key in RUNPOD_KEY_FILE
export async function api (method, route, body) {
  const response = await fetch('https://api.runpod.io' + route, { method, headers: { Authorization: `Bearer ${keyOf()}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

export async function get (url, ms = 8000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(ms) })
    return response.ok ? await response.text() : null
  } catch { return null }
}

/**
 * Rents a pod of scripts/drama3_server.sh holding the servers of `set` (DRAMA3_SET, `<package>:<perf mode>` each),
 * on the first of GPUS in stock. Returns the pod with the card it took, its servers' addresses and the address
 * of its status files.
 */
export async function startDrama3Pod (name, set) {
  const script = fs.readFileSync(path.join(root, 'scripts', 'drama3_server.sh'), 'utf8').replace(/\r\n/g, '\n')
  const count = set.split(',').length
  if (count > PORTS.length) throw new Error(`at most ${PORTS.length} servers on a pod`)
  for (const gpu of GPUS) {
    try {
      const pod = await api('POST', '/v2/pods', {
        name,
        image: 'nvidia/cuda:12.8.1-runtime-ubuntu22.04',
        cloud: 'SECURE',
        gpu: { id: gpu, count: 1, minCudaVersion: '12.8' },
        disk: 80,
        ports: [...PORTS.slice(0, count), 8082].map(port => `${port}/http`),
        env: { SETUP_B64: Buffer.from(script).toString('base64'), DRAMA3_SET: set },
        cmd: ['bash', '-c', 'echo "$SETUP_B64" | base64 -d > /setup.sh && bash /setup.sh']
      })
      const at = port => `https://${pod.id}-${port}.proxy.runpod.net`
      return { ...pod, card: gpu, servers: PORTS.slice(0, count).map(at), status: at(8082) }
    } catch (error) {
      if (!/no longer any instances/.test(error.message)) throw error
      console.log(`no ${gpu} free`)
    }
  }
  throw new Error('none of the cards is free')
}

// Deletes a pod, trying again while the network fails: a pod left running bills by the second
export async function deletePod (id) {
  for (let attempt = 1; ; attempt++) {
    try {
      await api('DELETE', `/v2/pods/${id}`)
      return
    } catch (error) {
      if (attempt >= 5) throw new Error(`pod ${id} was NOT deleted, delete it by hand: ${error.message}`)
      await sleep(3000 * attempt)
    }
  }
}

// Waits until every server answers its health check
export async function waitForServers (pod, created = Date.now()) {
  for (;;) {
    if (Date.now() - created > BOOT_LIMIT) throw new Error('the servers did not answer in 20 minutes')
    if ((await Promise.all(pod.servers.map(server => get(server + '/health')))).every(Boolean)) return
    await sleep(5000)
  }
}

async function main () {
  const args = process.argv.slice(2)
  const flag = name => { const at = args.indexOf(name); return at < 0 ? null : args.splice(at, 2)[1] }
  const dry = args.includes('--dry')
  const set = flag('--set') ?? 'Q4_K_S:cuda_perf,Q4_K_S:cuda_perf'
  const [film, voice] = args.filter(arg => arg !== '--dry')
  if (!film) throw new Error('node scripts/drama3_pod.mjs <film> [voice,voice,...] [--set <DRAMA3_SET>] [--dry]')
  const voices = voice ? voice.split(',') : [null]
  const script = path.join(root, 'films', film, 'voice.mjs')
  if (!fs.existsSync(script)) throw new Error(`no ${path.relative(root, script)}`)
  // A job of the voice script (speak on the servers named, or plan: the lines it would speak, asking no server)
  const runOne = (job, servers, one) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, job, ...(one ? [one] : [])], { cwd: root, stdio: 'inherit', env: { ...process.env, DRAMA3_SERVERS: servers.join(',') } })
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`the voice script${one ? ` (${one})` : ''} stopped with ${code}`)))
  })
  const speak = async servers => { for (const one of voices) await runOne('speak', servers, one) }
  if (dry) {
    for (const one of voices) await runOne('plan', [], one).catch(error => console.log(error.message))
    return
  }
  keyOf()
  const created = Date.now()
  const pod = await startDrama3Pod(`drama3-${film}`, set)
  console.log(`pod ${pod.id} on ${pod.card} in ${pod.dataCenterId}, $${pod.cost}/h`)
  let failure = null
  const stop = async () => { await deletePod(pod.id).catch(error => console.error(error.message)); process.exit(1) }
  process.once('SIGINT', stop)
  try {
    await waitForServers(pod, created)
    console.log(`servers up in ${Math.round((Date.now() - created) / 1000)} s`)
    await speak(pod.servers)
  } catch (error) {
    failure = error
  } finally {
    await deletePod(pod.id)
    const hours = (Date.now() - created) / 3600e3
    const rate = Number(pod.cost) || 0
    console.log(`pod deleted after ${(hours * 60).toFixed(1)} min${rate ? `, about $${(hours * rate).toFixed(2)}` : ''}`)
  }
  if (failure) throw failure
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exit(1) })
}
