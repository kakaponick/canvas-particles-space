#!/usr/bin/env node
// Drives the scene in the browser tab open on `pnpm dev`, through the dev server's /__space bridge.
//
//   node scripts/space.mjs help                       what window.space can do
//   node scripts/space.mjs tabs                       open tabs; the first one gets the commands
//   node scripts/space.mjs describe black             settings whose key, name or description has "black"
//   node scripts/space.mjs set '{"baseSpeed":3,"blackHoleSize":12}'
//   node scripts/space.mjs intro.set '{"ringdownPitch":0.5}'
//   node scripts/space.mjs intro.seek 2.1
//   node scripts/space.mjs capture                    saves the frame, prints its file
//
// Each argument after the command is read as JSON when it parses and as text otherwise. SPACE_TAB picks a
// tab by id; SPACE_URL overrides the dev server address the server wrote to .space/server.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function serverUrl () {
  if (process.env.SPACE_URL) return process.env.SPACE_URL
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.space', 'server.json'), 'utf8')).url
  } catch {
    return 'http://localhost:5173'
  }
}

const [command = 'help', ...raw] = process.argv.slice(2)
const args = raw.map(value => {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
})

const url = `${serverUrl()}/__space`
let response
try {
  response = command === 'tabs'
    ? await fetch(url)
    : await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args, tab: process.env.SPACE_TAB })
    })
} catch (error) {
  console.error(`No dev server at ${url} (${error.cause?.code ?? error.message}). Start it with \`pnpm dev\` and open the page.`)
  process.exit(2)
}

let body
try {
  body = await response.json()
} catch {
  console.error(`${url} answered ${response.status} without JSON: is another server on that port? Set SPACE_URL.`)
  process.exit(2)
}
if (!body.ok) {
  console.error(body.error)
  process.exit(1)
}
const result = command === 'tabs' ? body.tabs : body.result
console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
