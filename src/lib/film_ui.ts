// What the film mode's panel (film_mode.tsx) and its player (film_player.tsx) share beside their components
import type { FilmEntry, FilmSaving } from '../store/film_store'
import { libraryFilmOf } from './film_library'
import { openFiles } from './film_session'

const ACCEPT = '.json,.js,.png,.jpg,.jpeg,.webp,.gif,.avif,.m4a,.mp3,.wav,.ogg,.opus,.aac,.flac,.webm'

// m:ss, the way a player shows time; with tenths, m:ss.t, where a seek or a frame step must read
export function clock (seconds: number, tenths = false) {
  if (tenths) {
    const at = Math.max(0, Math.floor(seconds * 10)) / 10
    return `${Math.floor(at / 60)}:${(at % 60).toFixed(1).padStart(4, '0')}`
  }
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// What a film is called: a library film by its meta.json's title, another by the name it came under
export function titleOf (entry: FilmEntry) {
  const film = entry.origin === 'library' ? libraryFilmOf(entry.name) : null
  return film?.title ?? entry.name
}

// One hidden picker for the page, so every Open button and the empty stage open the same dialog
let picker: HTMLInputElement | null = null
export function pickFiles () {
  if (!picker) {
    picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = ACCEPT
    picker.multiple = true
    picker.addEventListener('change', () => {
      const files = [...(picker?.files ?? [])]
      if (picker) picker.value = ''
      if (files.length > 0) void openFiles(files)
    })
  }
  picker.click()
}

// The speed menu is open: Escape closes it before the panel (film_mode.tsx asks)
let menuHoldsEscape = false
export const playerHoldsEscape = () => menuHoldsEscape
export const setMenuHoldsEscape = (holds: boolean) => { menuHoldsEscape = holds }


// The stage while the mode is open: the toolbar's full screen button (control_panel.tsx) takes it then, so
// full screen from anywhere shows the film
let filmStage: HTMLElement | null = null
export const setFilmStage = (stage: HTMLElement | null) => { filmStage = stage }
export const fullscreenTarget = () => filmStage ?? document.documentElement

// A save's guess at its time left needs this much behind it first: a share of the frames and some seconds
const GUESS_AFTER_SHARE = 0.03
const GUESS_AFTER_MS = 3000

// How long a save of the video has left, from its pace so far: "about 2 min left", or '' while too early
export function saveLeft (saving: FilmSaving) {
  const spent = performance.now() - saving.startedAt
  const share = saving.frames > 0 ? saving.frame / saving.frames : 0
  if (share < GUESS_AFTER_SHARE || spent < GUESS_AFTER_MS) return ''
  const left = spent / share * (1 - share) / 1000
  return left >= 90 ? `about ${Math.round(left / 60)} min left` : `about ${Math.max(5, Math.round(left / 5) * 5)} s left`
}
