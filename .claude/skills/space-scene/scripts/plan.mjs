#!/usr/bin/env node
// A film checked with no browser: writes a script (or reads a film's JSON) and plans it in Node, through
// Vite's loader for the page's own TypeScript, so it answers as space.mjs check does, without the frames:
// every problem in one error, the values moved onto a slider, a track that leaps between two keys, and the
// film's length and parts. For a machine with no Chrome, or an operator who forbids the browser; a preview
// is still what shows the picture.
//
//   node .claude/skills/space-scene/scripts/plan.mjs <film> [--input <file.json>]
//
// A film is a .json file, a script (.js), or a film's folder (films/waltz), as space.mjs takes it.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const words = process.argv.slice(2)
const inputAt = words.indexOf('--input')
const input = inputAt >= 0 ? JSON.parse(fs.readFileSync(words.splice(inputAt, 2)[1], 'utf8')) : {}
if (words.length !== 1) {
  console.error('node plan.mjs <film.json|film.js|films/<film>> [--input <file.json>]')
  process.exit(2)
}

// A film's folder names its file in meta.json
let file = path.resolve(words[0])
if (fs.statSync(file).isDirectory()) file = path.join(file, JSON.parse(fs.readFileSync(path.join(file, 'meta.json'), 'utf8')).film)
const source = fs.readFileSync(file, 'utf8')

// Vite as the repository has it, whatever folder this runs from
const viteHome = path.dirname(createRequire(path.join(root, 'package.json')).resolve('vite/package.json'))
const vite = await import(pathToFileURL(path.join(viteHome, 'dist/node/index.js')).href)
const server = await vite.createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }
})
let failed = false
try {
  const { writeFilm } = await server.ssrLoadModule('/src/lib/film_script.ts')
  const { planFilm } = await server.ssrLoadModule('/src/lib/film.ts')
  const film = file.endsWith('.js') ? writeFilm(source, input).film : JSON.parse(source)
  const plan = planFilm(film)
  const notes = [...(plan.notes ?? []), ...(plan.clamped ?? [])]
  console.log(`${path.relative(root, file)}: ${plan.duration} s, ${plan.width}x${plan.height}, ${plan.fps} fps; ` +
    `${plan.tracks.length} tracks, ${plan.captions.length} captions, ${plan.graphics.length} shapes`)
  if (notes.length > 0) console.log(`Adjusted: ${notes.join('; ')}`)
} catch (error) {
  failed = true
  console.error(error instanceof Error ? error.message : String(error))
} finally {
  await server.close()
}
process.exit(failed ? 1 : 0)
