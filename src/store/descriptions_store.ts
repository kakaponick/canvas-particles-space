import { create } from 'zustand'

const STORAGE_KEY = 'show-setting-descriptions'

// Whether every setting shows its description under it. The descriptions are always in the page (they
// describe their controls for screen readers); this switch only reveals them, through an attribute on the
// root and CSS, so turning it on or off re-renders nothing but its own buttons
function readStored () {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function apply (on: boolean) {
  if (on) document.documentElement.dataset.descriptions = 'on'
  else delete document.documentElement.dataset.descriptions
}

const initial = typeof window !== 'undefined' && readStored()
if (typeof document !== 'undefined') apply(initial)

interface DescriptionsState {
  shown: boolean
  toggle: () => void
}

export const useDescriptionsStore = create<DescriptionsState>((set, get) => ({
  shown: initial,
  toggle: () => {
    const shown = !get().shown
    apply(shown)
    try {
      window.localStorage.setItem(STORAGE_KEY, shown ? '1' : '0')
    } catch {
      // Storage blocked: the choice holds until the page reloads
    }
    set({ shown })
  }
}))
