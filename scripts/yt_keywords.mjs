#!/usr/bin/env node
// The raw keyword core of a YouTube film: what people type into YouTube's search about its subject, and how
// crowded each phrase is. No key and no dependencies; it reads two public pages of YouTube's.
//
//   node scripts/yt_keywords.mjs "fourth dimension,black hole,tesseract" [--serp 40] [--lang en] [--out dir]
//
// 1. Suggest: each seed is typed into YouTube's search box as it is and followed by every letter and digit
//    (37 asks a seed), and what the box offers is kept. A phrase offered for more seeds, more letters and
//    higher up in the list is one more people type: `hits` and `best` (its best place, 0 the top).
// 2. Search: the `--serp` phrases most offered (40 by default) are searched, and the first 20 videos of each
//    are kept: views, age, length, channel. `views_med` is their median views, `per_day_med` their median
//    views a day, `exact` how many of them carry the whole phrase in their title (the competition for it).
//
// The most offered phrases are often noise (a song, a game, a typo), so the usual second pass searches the
// phrases a reader picked from suggest.csv, one a line:
//
//   node scripts/yt_keywords.mjs --search picked.txt [--out dir]
//
// Writes suggest.csv, serp.csv (a row a phrase) and videos.csv (a row a video) into --out (yt-keywords/ by
// default, kept out of git). The choice of the main and the second phrases is left to whoever reads them:
// the youtube-seo skill. The address of the suggestions is not an official API, so asks are spaced out.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args.splice(at, 2)[1] : fallback
}
const lang = option('lang', 'en')
const out = path.resolve(option('out', 'yt-keywords'))
const serpCount = Number(option('serp', 40))
// The phrases to search, one a line, picked by hand from suggest.csv: no suggesting then
const searchFile = option('search', null)
const picked = searchFile
  ? fs.readFileSync(searchFile, 'utf8').split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean)
  : null
const seeds = (args[0] ?? '').split(',').map(seed => seed.trim().toLowerCase()).filter(Boolean)
if (seeds.length === 0 && !picked) {
  console.error('node scripts/yt_keywords.mjs "seed,seed,..." [--serp 40] [--lang en] [--out dir] | --search phrases.txt [--out dir]')
  process.exit(2)
}

const PAUSE_MS = 250
const SEARCH_PAUSE_MS = 2000
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': `${lang},en;q=0.8` }
const pause = () => new Promise(resolve => setTimeout(resolve, PAUSE_MS))

async function fetchText (url) {
  // YouTube drops the connection, or answers 429, when asked too often: wait longer each time
  for (let attempt = 0; ; attempt++) {
    let failure
    try {
      const response = await fetch(url, { headers: HEADERS })
      if (response.ok) return await response.text()
      failure = `${response.status}`
    } catch (error) {
      failure = error.cause?.code ?? error.message
    }
    if (attempt === 5) throw new Error(`${failure} from ${url}`)
    await new Promise(resolve => setTimeout(resolve, 3000 * 2 ** attempt))
  }
}

async function suggest (query) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=${lang}&q=${encodeURIComponent(query)}`
  const [, offered] = JSON.parse(await fetchText(url))
  return offered.map(phrase => phrase.toLowerCase().trim())
}

// The videos of the first page of results, read from the data the page is drawn from
async function search (phrase) {
  const html = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(phrase)}&hl=${lang}`)
  const start = html.indexOf('var ytInitialData = ')
  if (start < 0) return []
  const from = start + 'var ytInitialData = '.length
  const data = JSON.parse(html.slice(from, html.indexOf(';</script>', from)))
  const videos = []
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.videoRenderer) {
      const video = node.videoRenderer
      videos.push({
        id: video.videoId,
        title: video.title?.runs?.map(run => run.text).join('') ?? '',
        channel: video.ownerText?.runs?.[0]?.text ?? '',
        views: Number((video.viewCountText?.simpleText ?? '').replace(/\D/g, '')) || 0,
        days: ageInDays(video.publishedTimeText?.simpleText ?? ''),
        length: video.lengthText?.simpleText ?? ''
      })
      return
    }
    Object.values(node).forEach(walk)
  }
  walk(data)
  return videos.slice(0, 20)
}

// "3 years ago" or "3y ago" in days; a stream's "Streamed 2 weeks ago" too
function ageInDays (text) {
  const match = /(\d+)\s*(mo|y|w|d|h|min|m|s)/.exec(text)
  if (!match) return null
  const unit = { s: 1 / 86400, m: 1 / 1440, min: 1 / 1440, h: 1 / 24, d: 1, w: 7, mo: 30, y: 365 }[match[2]]
  return Math.max(1, Math.round(Number(match[1]) * unit))
}

const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}
const cell = value => /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value)
const writeCsv = (file, rows) => {
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, file), rows.map(row => row.map(cell).join(',')).join('\n') + '\n')
}

// 1. Suggest, unless the phrases to search were picked already
const found = new Map()
const tails = ['', ...'abcdefghijklmnopqrstuvwxyz0123456789']
let asked = 0
for (const seed of picked ? [] : seeds) {
  for (const tail of tails) {
    const offered = await suggest(tail ? `${seed} ${tail}` : seed)
    offered.forEach((phrase, place) => {
      const entry = found.get(phrase) ?? { hits: 0, best: place, seeds: new Set() }
      entry.hits++
      entry.best = Math.min(entry.best, place)
      entry.seeds.add(seed)
      found.set(phrase, entry)
    })
    asked++
    process.stdout.write(`\rsuggest ${asked}/${seeds.length * tails.length}, ${found.size} phrases`)
    await pause()
  }
}
process.stdout.write('\n')
const ranked = [...found].sort(([, a], [, b]) => b.seeds.size - a.seeds.size || b.hits - a.hits || a.best - b.best)
if (!picked) writeCsv('suggest.csv', [['phrase', 'seeds', 'hits', 'best'], ...ranked.map(([phrase, entry]) => [phrase, entry.seeds.size, entry.hits, entry.best])])

// 2. Search
const serp = [['phrase', 'hits', 'views_med', 'per_day_med', 'exact', 'top_views', 'top_title']]
const videoRows = [['phrase', 'place', 'id', 'title', 'channel', 'views', 'days', 'per_day', 'length']]
const chosen = picked ? picked.map(phrase => [phrase, found.get(phrase) ?? { hits: '' }]) : ranked.slice(0, serpCount)
for (const [index, [phrase, entry]] of chosen.entries()) {
  let videos
  try {
    videos = await search(phrase)
  } catch (error) {
    console.error(`\n${phrase}: ${error.message}`)
    continue
  }
  const perDay = videos.map(video => video.days ? video.views / video.days : NaN)
  const exact = videos.filter(video => video.title.toLowerCase().includes(phrase)).length
  const top = [...videos].sort((a, b) => b.views - a.views)[0]
  serp.push([phrase, entry.hits, median(videos.map(video => video.views)), Math.round(median(perDay)), exact, top?.views ?? 0, top?.title ?? ''])
  videos.forEach((video, place) => videoRows.push([phrase, place, video.id, video.title, video.channel, video.views, video.days ?? '', Math.round(perDay[place]) || '', video.length]))
  process.stdout.write(`\rsearch ${index + 1}/${chosen.length}`)
  // A results page is heavier than a suggestion, and YouTube cuts off a fast run of them after about ten
  await new Promise(resolve => setTimeout(resolve, SEARCH_PAUSE_MS))
}
process.stdout.write('\n')
writeCsv('serp.csv', serp)
writeCsv('videos.csv', videoRows)
console.log(`${picked ? '' : `Wrote ${found.size} phrases, `}${serp.length - 1} of ${chosen.length} searched, into ${out}`)
