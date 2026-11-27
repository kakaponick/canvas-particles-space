// Every meta.json of films/ as its text, in one chunk the film mode fetches when it opens (film_library.ts,
// loadLibraryDetails), so the card of a film opened from the library has its line and its makers at once.
// As text, so the page's own chunk keeps only the three keys the library's list reads from the same files
export const META_TEXTS = import.meta.glob<string>(['/films/*/meta.json', '/films/*/takes/*/meta.json'], { eager: true, query: '?raw', import: 'default' })
