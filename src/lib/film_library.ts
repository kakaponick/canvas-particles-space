// The films of this repository (films/), bundled with the page so the film mode can play them: each file is
// a chunk of its own, fetched only when it is opened, so a visitor who never opens one downloads none. Their
// pictures come along by address. A file a film or a reel names is found here by its name, as the film
// server finds it in its folder.

const TEXTS = import.meta.glob<string>('/films/*.{json,js}', { query: '?raw', import: 'default' })
const PICTURES = import.meta.glob<string>('/films/*.{png,jpg,jpeg,webp,gif,avif}', { query: '?url', import: 'default' })

// The name a path ends in, which is how a film's own references are matched: "films/horizon.js" is horizon.js
export const baseName = (path: string) => path.trim().replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''

const byName = <T>(files: Record<string, T>) => new Map(Object.entries(files).map(([path, value]) => [baseName(path), value]))
const texts = byName(TEXTS)
const pictures = byName(PICTURES)

// What the library offers to play: every film, fractal film and reel in films/, by file name
export const LIBRARY_FILMS: readonly string[] = [...texts.keys()].sort((a, b) => a.localeCompare(b))

export const isLibraryFilm = (name: string) => texts.has(baseName(name))

// The text of a film in the library, or null when it has none of that name
export async function libraryText (name: string): Promise<string | null> {
  const load = texts.get(baseName(name))
  return load ? await load() : null
}

// The address of a picture in the library, or null
export async function libraryPicture (name: string): Promise<string | null> {
  const load = pictures.get(baseName(name))
  return load ? await load() : null
}
