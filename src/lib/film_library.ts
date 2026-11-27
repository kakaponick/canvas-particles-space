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
// The three keys of each film's meta.json the list needs, as named imports, so the rest of the file stays out
// of the page; the whole of it, as text, for the film that is opened
const TITLES = import.meta.glob<string>('/films/*/meta.json', { eager: true, import: 'title' })
const KINDS = import.meta.glob<LibraryKind>('/films/*/meta.json', { eager: true, import: 'kind' })
const FILES = import.meta.glob<string>('/films/*/meta.json', { eager: true, import: 'film' })
const METAS = import.meta.glob<string>(['/films/*/meta.json', '/films/*/takes/*/meta.json'], { query: '?raw', import: 'default' })

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
const metas = byFolder(METAS)
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

// The line and the makers of the film a path in films/ is of (the take's own makers for a take's file), or
// null for a file of no folder
export async function libraryDetails (path: string): Promise<FilmDetails | null> {
  const key = keyOf(path)
  if (!key.includes('/')) return null
  const folder = key.split('/')[0]
  const take = /^[^/]+\/takes\/([^/]+)\//.exec(key)?.[1]
  const read = async (at: string) => {
    const load = metas.get(at)
    if (!load) return null
    try {
      return JSON.parse(await load()) as { about?: unknown, made?: unknown }
    } catch {
      return null
    }
  }
  const own = await read(folder)
  const taken = take ? await read(`${folder}/takes/${take}`) : null
  if (!own) return null
  const made = (taken ?? own).made
  return {
    about: typeof own.about === 'string' ? own.about : '',
    made: Array.isArray(made) ? made.filter((line): line is MadeLine => typeof line?.model === 'string') : []
  }
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
