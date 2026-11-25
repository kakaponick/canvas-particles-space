// The camera from the keyboard: what a key pressed on the focused scene does to the camera's settings, and
// the words a screen reader hears for it. The ranges, the steps and the names are the sliders' own
// (simulation_specs.ts), so the keys and the Settings panel never disagree.
import { SIMULATION_SETTING_SPECS } from './simulation_specs'

const CAMERA_KEYS = ['cameraYaw', 'cameraPitch', 'cameraZoom', 'cameraX', 'cameraY'] as const
type CameraKey = typeof CAMERA_KEYS[number]
export type CameraSettings = Record<CameraKey, number> & { threeD: boolean }
export type CameraChange = Partial<Record<CameraKey, number>>

// An arrow turns the 3D camera by this many degrees and pans the flat one by this many black hole radii;
// with Shift, by the fine step
const TURN_DEGREES = 5
const FINE_TURN_DEGREES = 1
const PAN_RADII = 0.5
const FINE_PAN_RADII = 0.1
// Plus and minus zoom by this share; with Shift, by one step of the Zoom slider
const ZOOM_SHARE = 1.1

// The keys the scene takes, for aria-keyshortcuts
export const CAMERA_KEY_SHORTCUTS = 'ArrowLeft ArrowRight ArrowUp ArrowDown + - Home'
// What they do, for a screen reader (the scene's aria-describedby)
export const CAMERA_KEYS_HELP = 'With 3D View on, the arrow keys circle the camera around the black hole; otherwise they pan a zoomed-in camera. Plus and minus zoom. Shift makes each step finer. Home resets the camera.'

// A value moved onto its slider's step and held inside its range
function fit (key: CameraKey, value: number): number {
  const { min, max, step } = SIMULATION_SETTING_SPECS[key]
  const stepped = min + Math.round((value - min) / step) * step
  return Math.min(Math.max(Number(stepped.toFixed(6)), min), max)
}

// The flat camera has somewhere to look only while it is zoomed in (Pan X in simulation_specs.ts)
const canPan = (camera: CameraSettings) => camera.cameraZoom > 1

// The angle around the black hole goes round: past 180 it comes back at -180
const wrapYaw = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180

function zoomed (zoom: number, way: 1 | -1, fine: boolean): number {
  const { step } = SIMULATION_SETTING_SPECS.cameraZoom
  if (fine) return fit('cameraZoom', zoom + way * step)
  const next = fit('cameraZoom', way > 0 ? zoom * ZOOM_SHARE : zoom / ZOOM_SHARE)
  // Near the bottom of the range a share is less than a step: every press still moves the zoom
  return next === zoom ? fit('cameraZoom', zoom + way * step) : next
}

/**
 * The settings a key changes, or null when the key is not the camera's. `fine` is Shift; `home` is where
 * Home puts the camera, the defaults its sliders reset to.
 * An arrow that has nowhere left to go returns an empty change: the key is still the camera's.
 */
export function cameraKeyChange (key: string, fine: boolean, camera: CameraSettings, home: Partial<Record<CameraKey, number>>): CameraChange | null {
  let change: CameraChange
  switch (key) {
  case 'ArrowLeft':
  case 'ArrowRight': {
    const way = key === 'ArrowRight' ? 1 : -1
    if (camera.threeD) change = { cameraYaw: wrapYaw(camera.cameraYaw + way * (fine ? FINE_TURN_DEGREES : TURN_DEGREES)) }
    else if (canPan(camera)) change = { cameraX: fit('cameraX', camera.cameraX + way * (fine ? FINE_PAN_RADII : PAN_RADII)) }
    else change = {}
    break
  }
  case 'ArrowUp':
  case 'ArrowDown': {
    const way = key === 'ArrowUp' ? 1 : -1
    if (camera.threeD) change = { cameraPitch: fit('cameraPitch', camera.cameraPitch + way * (fine ? FINE_TURN_DEGREES : TURN_DEGREES)) }
    else if (canPan(camera)) change = { cameraY: fit('cameraY', camera.cameraY + way * (fine ? FINE_PAN_RADII : PAN_RADII)) }
    else change = {}
    break
  }
  case '+':
  case '=':
    change = { cameraZoom: zoomed(camera.cameraZoom, 1, fine) }
    break
  case '-':
  case '_':
    change = { cameraZoom: zoomed(camera.cameraZoom, -1, fine) }
    break
  case 'Home':
    change = {}
    for (const name of CAMERA_KEYS) {
      const value = home[name]
      if (value !== undefined) change[name] = value
    }
    break
  default:
    return null
  }
  for (const name of CAMERA_KEYS) {
    if (change[name] === camera[name]) delete change[name]
  }
  return change
}

const named = (key: CameraKey, value: number) => `${SIMULATION_SETTING_SPECS[key].label} ${SIMULATION_SETTING_SPECS[key].format(value)}`

/** Where the camera is after a key, in the sliders' words: the pair the key belongs to */
export function describeCamera (key: string, camera: CameraSettings): string {
  if (key === 'Home') return 'Camera reset'
  if (key.startsWith('Arrow')) {
    return camera.threeD
      ? `${named('cameraYaw', camera.cameraYaw)}, ${named('cameraPitch', camera.cameraPitch)}`
      : canPan(camera)
        ? `${named('cameraX', camera.cameraX)}, ${named('cameraY', camera.cameraY)}`
        : 'Zoom in to pan the camera'
  }
  return named('cameraZoom', camera.cameraZoom)
}
