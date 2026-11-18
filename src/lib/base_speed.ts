// Base Speed: its range, and how scrolling or swiping over the scene turns it like a dial

export const BASE_SPEED_MIN = 0
export const BASE_SPEED_MAX = 100
export const BASE_SPEED_STEP = 0.1

// One notch of a mouse wheel is about 100 pixels
const WHEEL_NOTCH_PIXELS = 100
// A finger travels less than a wheel, so a swipe counts double
export const SWIPE_GAIN = 2
const WHEEL_LINE_PIXELS = 33

const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2

export function wheelPixels (deltaY: number, deltaMode: number, pageHeight: number) {
  if (deltaMode === DOM_DELTA_LINE) return deltaY * WHEEL_LINE_PIXELS
  if (deltaMode === DOM_DELTA_PAGE) return deltaY * pageHeight
  return deltaY
}

export interface SpeedDial {
  // Exact position, so the small deltas of a trackpad add up between steps of the setting
  position: number
  // The value last handed out; any other current value means the setting was changed elsewhere
  value: number
}

export function createSpeedDial (): SpeedDial {
  return { position: NaN, value: NaN }
}

// Returns the Base Speed after turning the dial; scrolling down or swiping up goes faster.
// `notchStep` is the speed one wheel notch adds
export function turnSpeedDial (dial: SpeedDial, current: number, pixels: number, notchStep: number) {
  if (current !== dial.value) dial.position = current
  const position = dial.position + pixels * notchStep / WHEEL_NOTCH_PIXELS
  dial.position = Math.min(Math.max(position, BASE_SPEED_MIN), BASE_SPEED_MAX)
  dial.value = Math.round(dial.position / BASE_SPEED_STEP) / Math.round(1 / BASE_SPEED_STEP)
  return dial.value
}
