// The films of this repository (films/, one folder each: films/README.md), bundled with the page so the film
// mode can play them: each file is a chunk of its own, fetched only when it is opened, so a visitor who never
// opens one downloads none. Of their meta.json files the page holds the title, the kind and the file, for the
// library's list; the rest (the line about the film, who made it) is fetched when a film is opened. Their
// pictures come along by address. A file a film or a reel names (films/<film>/clips/01_down.js) is found here
// by its path, as the film server finds it in the repository.

// What is played: a film folder's own files, its clips, voices and posters, its takes, and the scratch films
// loose at the top of films/; the same files scripts/films.mjs counts (filmFiles). The narration's takes and
// the renders are none
const TEXTS = import.meta.glob<string>([
  '/films/*.{json,js}',
  '/films/*/*.{json,js}',
  '/films/*/{clips,voices,posters}/*.{json,js}',
  '/films/*/takes/*/*.{json,js}',
  '!/films/**/meta.json',
  '!/films/voice/**',
  '!/films/out/**'
], { query: '?raw', import: 'default' })
const PICTURES = import.meta.glob<string>([
  '/films/**/*.{png,jpg,jpeg,webp,gif,avif}',
  '!/films/voice/**',
  '!/films/**/out/**'
], { query: '?url', import: 'default' })
// The films' sounds (meta.json's "audio", films/README.md) by address only: the page holds a few dozen bytes
// of each, and the browser fetches a sound when its film is played, a piece at a time
const SOUNDS = import.meta.glob<string>(['/films/*/audio/*.m4a', '/films/*/takes/*/audio/*.m4a'], { eager: true, query: '?url', import: 'default' })
// The three keys of each film's meta.json the list needs, as named imports, so the rest of the file stays out
// of the page; the whole of each comes in one chunk when the film mode opens (loadLibraryDetails)
const TITLES = import.meta.glob<string>('/films/*/meta.json', { eager: true, import: 'title' })
const KINDS = import.meta.glob<LibraryKind>('/films/*/meta.json', { eager: true, import: 'kind' })
const FILES = import.meta.glob<string>('/films/*/meta.json', { eager: true, import: 'film' })

export type LibraryKind = 'film' | 'reel' | 'fractal'

// Who made a film: one line per sitting of work (films/README.md)
export interface MadeLine {
  model: string
  agent?: string
  at: string
  did: string
  commits?: number
  last?: string
}

// What a film's meta.json tells beside its title: its line, and who made it (a take's own makers for a take)
export interface FilmDetails {
  about: string
  made: MadeLine[]
}

// A file of a film to play besides the film itself: a reel's clip, another voice's reel, a poster, a take
export interface LibraryPart {
  // Its path in films/, which opens it
  path: string
  // What the list shows: "clips/01_down"
  label: string
}

export interface LibraryFilm {
  // The folder's name, which the address names
  name: string
  title: string
  kind: LibraryKind | null
  // The path in films/ of the film's own file
  path: string
  parts: LibraryPart[]
}

// The name a path ends in, which is how files given beside a film are matched: "films/horizon/horizon.js" is
// horizon.js
export const baseName = (path: string) => path.trim().replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''

// A path as the library keys it: from films/ on, in lower case. "films/horizon/horizon.js", "/films/horizon/
// horizon.js" and "horizon/horizon.js" are one file
const keyOf = (path: string) => path.trim().replace(/\\/g, '/').replace(/^(?:.*\/)?films\//, '').replace(/^\/+/, '').toLowerCase()

const byKey = <T>(files: Record<string, T>) => new Map(Object.entries(files).map(([path, value]) => [keyOf(path), value]))
const texts = byKey(TEXTS)
const pictures = byKey(PICTURES)
const SOUNDS_BY_KEY = byKey(SOUNDS)

// A file found by its last name alone, when only one file has it: the way a film written before the folders
// named its parts
function byBaseName<T> (files: Map<string, T>, name: string) {
  const base = baseName(name)
  const found = [...files.keys()].filter(key => baseName(key) === base)
  return found.length === 1 ? found[0] : null
}

const withoutExtension = (path: string) => path.replace(/\.(json|js)$/i, '')

// The folder a meta.json path is of: "kerr_around", "fourth_dimension/takes/b"
const folderOf = (path: string) => keyOf(path).replace(/\/meta\.json$/, '')
const byFolder = <T>(files: Record<string, T>) => new Map(Object.entries(files).map(([path, value]) => [folderOf(path), value]))
const titles = byFolder(TITLES)
const kinds = byFolder(KINDS)
const folderNames = [...byFolder(FILES).keys()]
// A folder's own file, by the folder's name
const entries = new Map(Object.entries(FILES).map(([path, file]) => [folderOf(path), `${folderOf(path)}/${file}`.toLowerCase()]))

function libraryFilms (): LibraryFilm[] {
  const films: LibraryFilm[] = folderNames.map(folder => {
    const own = entries.get(folder) ?? ''
    const parts = [...texts.keys()]
      .filter(key => key.startsWith(`${folder}/`) && key !== own)
      .map(key => ({ path: key, label: withoutExtension(key.slice(folder.length + 1)) }))
    return { name: folder, title: titles.get(folder) ?? folder, kind: kinds.get(folder) ?? null, path: own, parts }
  })
  // Scratch films loose at the top of films/
  for (const key of texts.keys()) {
    if (key.includes('/')) continue
    films.push({ name: withoutExtension(key), title: key, kind: null, path: key, parts: [] })
  }
  return films.sort((a, b) => a.name.localeCompare(b.name))
}

// What the page reads of a meta.json beyond the three keys it holds
interface MetaRead {
  about?: unknown
  made?: unknown
  audio?: unknown
}

// Every meta.json read, by its folder, once their chunk has come; null before
let metas: Map<string, MetaRead> | null = null
let metasComing: Promise<void> | null = null

// Fetches every film's meta.json, in one chunk, once: the film mode asks as it opens, so a film's card has
// its line and its makers when the film is chosen
export function loadLibraryDetails () {
  metasComing ??= import('./film_library_details').then(({ META_TEXTS }) => {
    metas = new Map()
    for (const [path, text] of Object.entries(META_TEXTS)) {
      try {
        metas.set(folderOf(path), JSON.parse(text) as MetaRead)
      } catch {
        // A meta.json that is not JSON tells nothing; films.mjs check names it
      }
    }
  })
  return metasComing
}

// The line and the makers of the film a path in films/ is of (the take's own makers for a take's file): null
// for a file of no folder, or before loadLibraryDetails has brought them
export function libraryDetails (path: string): FilmDetails | null {
  const key = keyOf(path)
  if (!metas || !key.includes('/')) return null
  const folder = key.split('/')[0]
  const take = /^[^/]+\/takes\/([^/]+)\//.exec(key)?.[1]
  const own = metas.get(folder)
  if (!own) return null
  const made = ((take ? metas.get(`${folder}/takes/${take}`) : null) ?? own).made
  return {
    about: typeof own.about === 'string' ? own.about : '',
    made: Array.isArray(made) ? made.filter((line): line is MadeLine => typeof line?.model === 'string') : []
  }
}

// The address of the sound a film of the library plays under it (its folder's meta.json, "audio"), or null
// when it has none. Waits for the meta files, which the film mode has asked for as it opened
export async function libraryAudio (path: string): Promise<string | null> {
  const key = keyOf(path)
  if (!key.includes('/')) return null
  await loadLibraryDetails()
  // The folder that names the sound: a take's own, else the film's
  const take = /^([^/]+\/takes\/[^/]+)\//.exec(key)?.[1]
  const folder = take ?? key.split('/')[0]
  const audio = metas?.get(folder)?.audio
  if (typeof audio !== 'object' || audio === null) return null
  const file = key.slice(folder.length + 1)
  const sound = Object.entries(audio as Record<string, unknown>).find(([named]) => named.toLowerCase() === file)?.[1]
  return typeof sound === 'string' ? SOUNDS_BY_KEY.get(`${folder}/${sound}`.toLowerCase()) ?? null : null
}

// What the library offers to play: every film, fractal film and reel in films/, with its parts
export const LIBRARY: readonly LibraryFilm[] = libraryFilms()

// The path of a film in films/ that a name points to: a path ("films/horizon/horizon.js", "horizon/horizon"),
// a film's folder ("horizon"), or a file's last name when only one file has it; null when none
export function resolveLibraryFilm (name: string): string | null {
  const key = keyOf(name).replace(/\/+$/, '')
  if (key === '') return null
  for (const candidate of [key, `${key}.js`, `${key}.json`]) if (texts.has(candidate)) return candidate
  const own = entries.get(key)
  if (own && texts.has(own)) return own
  return byBaseName(texts, key)
}

export const isLibraryFilm = (name: string) => resolveLibraryFilm(name) !== null

// The film folder a path in films/ belongs to, or null for a loose one
export function libraryFilmOf (path: string): LibraryFilm | null {
  const key = keyOf(path)
  if (!key.includes('/')) return null
  const folder = key.split('/')[0]
  return LIBRARY.find(film => film.name === folder) ?? null
}

// What the address calls a film of the library: its folder's name for a folder's own file, else its path
// without the extension ("fourth_dimension_pop/clips/01_down")
export function addressName (path: string) {
  const key = keyOf(path)
  const folder = key.split('/')[0]
  return entries.get(folder) === key ? folder : withoutExtension(key)
}

// The text of a film in the library, or null when it has none of that name
export async function libraryText (name: string): Promise<string | null> {
  const key = resolveLibraryFilm(name)
  const load = key ? texts.get(key) : undefined
  return load ? await load() : null
}

// The address of a picture in the library, or null
export async function libraryPicture (name: string): Promise<string | null> {
  const key = keyOf(name)
  const load = pictures.get(key) ?? pictures.get(byBaseName(pictures, key) ?? '')
  return load ? await load() : null
}
