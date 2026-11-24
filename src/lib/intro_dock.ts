import { useIntroDebugStore } from '../store/intro_debug_store'

// The intro debugger opens and closes from one place: its button in the scene toolbar (control_panel.tsx),
// which never moves or hides. Alt+Shift+D does the same from the keyboard, and Escape closes the dock from
// inside it
export const INTRO_DOCK_ID = 'intro-debugger'

export function isInDock (target: EventTarget | null) {
  return target instanceof Element && target.closest('[data-intro-dock]') !== null
}

export function focusIntroToggle () {
  document.querySelector<HTMLElement>('[data-intro-toggle]')?.focus({ preventScroll: true })
}

// Opening hands the focus to the dock, so a screen reader announces it and Tab goes on into its controls;
// closing it with the focus inside hands the focus back to the toggle (IntroDebugger does that on unmount)
export function toggleIntroDebugger () {
  const debug = useIntroDebugStore.getState()
  if (debug.open) {
    debug.setOpen(false)
    return
  }
  debug.setOpen(true)
  requestAnimationFrame(() => document.getElementById(INTRO_DOCK_ID)?.focus({ preventScroll: true }))
}

export function closeIntroDebugger () {
  useIntroDebugStore.getState().setOpen(false)
}
