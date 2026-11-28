// Captions of a film, drawn over a finished frame on a 2D canvas: lines of text at a place on the frame,
// or a label with a line pointing at the black hole's shadow or its Einstein ring, wherever the camera
// has put them. The text is what popular science is written in: raised and lowered parts, stressed terms,
// numbers read from the film as it plays, Greek and mathematics, words that arrive one at a time.
import { TITLE_FONTS } from './title_sprite'
import type { CompositeSettings } from './particle_renderer'
import { createShadowShape, shadowScaleAt } from './kerr_shadow'
import { captionAlpha, captionValue, type CaptionNumbers, type FilmCaption, type FilmNumber, type FilmPlace, type FilmPlan, type FilmPoint } from './film'

// What captions need of a film: its frame, length, captions and tracks, and where its numbers come from.
// A particle film's plan is one; a fractal film builds one of its own
export type CaptionPlan = Pick<FilmPlan, 'width' | 'height' | 'duration' | 'captions' | 'tracks'> & CaptionNumbers

// What captions need of the frame: where the black hole and the camera stand, for a caption that points
export type CaptionFrame = Pick<CompositeSettings, 'letterbox' | 'cameraZoom' | 'holeX' | 'holeY' | 'horizon' | 'einstein' |
  'companionRadius' | 'companionX' | 'companionY' | 'shakeX' | 'shakeY' | 'zoomX' | 'zoomY' | 'shadowShape' | 'spinAxis'>
import { captionLetters, writeNumber, type CaptionRun } from './caption_text'
import { sheetPoint, type GridSettings } from './space_grid'

// The frame of a picture with no black hole: a caption that points aims at a round spot of `radius` pixels
// at x, y, as a fractal film's captions aim at its target
export function spotFrame (x: number, y: number, radius: number): CaptionFrame {
  return {
    letterbox: 0, cameraZoom: 1, holeX: x, holeY: y, horizon: radius,
    einstein: 0, companionRadius: 0, companionX: 0, companionY: 0, shakeX: 0, shakeY: 0, zoomX: 0, zoomY: 0,
    shadowShape: createShadowShape(), spinAxis: 0
  }
}

const LINE_HEIGHT = 1.3
// Shares of the frame's short side: room kept from the frame's edges, and how far a label stands from
// what it points at
const SAFE_MARGIN = 0.06
const LABEL_REACH = 0.09
// Gap between a pointer line and the letters it leads to, in letter heights
const LABEL_GAP = 0.5
// A raised or lowered part: its letters as a share of the line's, and how far it leaves the line, in the
// line's letter heights
const SCRIPT_SIZE = 0.62
const RAISED = -0.34
const LOWERED = 0.2
// The faces behind the one a caption asks for: text with Greek, mathematics, the signs of the sky. They are
// bundled, so a letter the caption's own face lacks is the same letter on every machine
const BEHIND = '"Noto Sans", "Noto Sans Math", "Noto Sans Symbols", system-ui, sans-serif'

// What crowds the words of a film, found as its frames are drawn: two captions on one another, or a stroke
// of a shape through a caption. The film's shapes hand over the strokes of each frame (drawGraphics), the
// captions check their blocks against them and against each other, and each meeting is kept once with the
// first and last second it was seen at, for the preview, the render and the review to print
export interface FrameCrowd {
  strokes: { graphic: number, what: string, points: (readonly [number, number])[] }[]
  found: Map<string, { what: string, from: number, to: number }>
}

export const createCrowd = (): FrameCrowd => ({ strokes: [], found: new Map() })

export function crowdNotes (crowd: FrameCrowd): string[] {
  return [...crowd.found.values()].map(({ what, from, to }) => `${what}, ${from === to ? `at ${from}` : `${from}-${to}`} s`)
}

// A share of a letter's height the blocks may touch by before they count as on one another: the room a
// descender or an accent takes outside its line
const CROWD_SLACK = 0.15

function noteCrowd (crowd: FrameCrowd, key: string, what: string, time: number) {
  const second = Number(time.toFixed(2))
  const seen = crowd.found.get(key)
  if (seen) seen.to = second
  else crowd.found.set(key, { what, from: second, to: second })
}

interface Block { left: number, top: number, right: number, bottom: number }

// Whether a segment passes through a block: an end inside it, or a crossing of one of its sides
function crosses (block: Block, [ax, ay]: readonly [number, number], [bx, by]: readonly [number, number]) {
  const inside = (x: number, y: number) => x > block.left && x < block.right && y > block.top && y < block.bottom
  if (inside(ax, ay) || inside(bx, by)) return true
  // Clipped against the block's four sides, the segment keeps a stretch inside it (Liang-Barsky)
  let enter = 0
  let leave = 1
  const dx = bx - ax
  const dy = by - ay
  for (const [p, q] of [[-dx, ax - block.left], [dx, block.right - ax], [-dy, ay - block.top], [dy, block.bottom - ay]]) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) enter = Math.max(enter, t)
    else leave = Math.min(leave, t)
    if (enter > leave) return false
  }
  return true
}

const captionName = (index: number, caption: FilmCaption) => `captions[${index}] "${caption.text.split('\n')[0].slice(0, 32)}"`

function captionFont (caption: FilmCaption, size: number) {
  // The bundled faces have no italic of their own, so the browser leans the upright one
  const style = `${caption.italic ? 'italic ' : ''}${caption.weight} ${size}px`
  if (caption.font === 'system') return `${style} system-ui, sans-serif`
  return caption.font === 'noto' ? `${style} ${BEHIND}` : `${style} "${TITLE_FONTS[caption.font].family}", ${BEHIND}`
}

// Where the composite pass put a black hole on the frame, and how long one of its radii is there
export function holeOnFrame (composite: CaptionFrame, pixel: number, second: boolean) {
  const zoom = composite.cameraZoom
  const sceneX = second ? composite.companionX : composite.holeX
  const sceneY = second ? composite.companionY : composite.holeY
  return {
    x: (composite.zoomX + (sceneX - composite.shakeX - composite.zoomX) * zoom) * pixel,
    y: (composite.zoomY + (sceneY - composite.shakeY - composite.zoomY) * zoom) * pixel,
    radius: (second ? composite.companionRadius : composite.horizon) * zoom * pixel
  }
}

/**
 * A place of a caption or a shape on a frame `width` by `height` video pixels: where it is, and how long
 * its unit is there (the hole's radius, or the frame's short side). Null for a place at a second black hole
 * while there is none, unless `orMain` puts it at the main one instead, and for a place on the space sheet
 * (`sheet`, as the scene last laid it) while there is no sheet or the point is behind its camera.
 */
export function placeOnFrame (
  place: FilmPlace, read: (value: FilmNumber) => number, composite: CaptionFrame, pixel: number, width: number, height: number, orMain = false,
  sheet: GridSettings | null = null
): { x: number, y: number, unit: number } | null {
  if (place.anchor === 'between') {
    const share = Math.min(Math.max(read(place.share), 0), 1)
    const from = share < 1 ? placeOnFrame(place.from, read, composite, pixel, width, height, orMain, sheet) : null
    const to = share > 0 ? placeOnFrame(place.to, read, composite, pixel, width, height, orMain, sheet) : null
    // An end that is not there (a sheet not laid) leaves the place at the other
    if (!from || !to) return from ?? to
    return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, unit: from.unit + (to.unit - from.unit) * share }
  }
  const point = pointOnFrame(place, read, composite, pixel, width, height, orMain, sheet)
  if (!point || !place.shift) return point
  // A drawing standing at the point: moved on the frame in the point's own unit, y up
  return { x: point.x + read(place.shift[0]) * point.unit, y: point.y - read(place.shift[1]) * point.unit, unit: point.unit }
}

function pointOnFrame (
  place: FilmPoint, read: (value: FilmNumber) => number, composite: CaptionFrame, pixel: number, width: number, height: number, orMain: boolean,
  sheet: GridSettings | null
): { x: number, y: number, unit: number } | null {
  if (place.anchor === 'frame') return { x: read(place.x) * width, y: read(place.y) * height, unit: Math.min(width, height) }
  if (place.anchor === 'sheet') {
    const point = sheet ? sheetPoint(sheet, read(place.x), read(place.y)) : null
    if (!point) return null
    // Seen through the scene camera's zoom and shake, as the sheet's lines are
    const zoom = composite.cameraZoom
    return {
      x: (composite.zoomX + (point.x - composite.shakeX - composite.zoomX) * zoom) * pixel,
      y: (composite.zoomY + (point.y - composite.shakeY - composite.zoomY) * zoom) * pixel,
      unit: composite.horizon * zoom * pixel
    }
  }
  const second = place.anchor === 'companion' && composite.companionRadius > 0
  if (place.anchor === 'companion' && !second && !orMain) return null
  const hole = holeOnFrame(composite, pixel, second)
  return { x: hole.x + read(place.x) * hole.radius, y: hole.y - read(place.y) * hole.radius, unit: hole.radius }
}

// The plain text face at a size: a plot's labels and numbers
export const plainFont = (size: number) => `500 ${size}px ${BEHIND}`

/**
 * One line of words with raised and lowered parts, in the plain text face, its middle at `y`. `align` says
 * which of its ends, or its middle, stands at `x`.
 */
export function drawMarked (
  ctx: CanvasRenderingContext2D, line: CaptionRun[], x: number, y: number, size: number, color: string, accent: string, align: 'left' | 'center' | 'right'
) {
  const whole = plainFont(size)
  const small = plainFont(size * SCRIPT_SIZE)
  const widths = line.map(run => {
    ctx.font = run.shift === 0 ? whole : small
    return ctx.measureText(run.text).width
  })
  let left = x - widths.reduce((sum, one) => sum + one, 0) * (align === 'center' ? 0.5 : align === 'right' ? 1 : 0)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  line.forEach((run, index) => {
    ctx.font = run.shift === 0 ? whole : small
    ctx.fillStyle = run.accent ? accent : color
    ctx.fillText(run.text, left, y + (run.shift > 0 ? RAISED : run.shift < 0 ? LOWERED : 0) * size)
    left += widths[index]
  })
}

// A stretch of a line drawn in one go: a word, or the part of a word that is raised, lowered or stressed
interface Piece {
  text: string
  shift: CaptionRun['shift']
  accent: boolean
  // From the line's left edge
  x: number
  // Its place in the caption's order of words and letters, for words that arrive one at a time
  word: number
  letter: number
  letters: number
}

interface Line {
  pieces: Piece[]
  width: number
  // The whole line as one string when nothing in it is raised, lowered or stressed
  plain: string | null
}

// A caption as it fits the frame, kept from one frame to the next while its words and its room stay the same
interface Fit {
  key: string
  size: number
  lines: Line[]
  // The widest line
  width: number
  words: number
  letters: number
}

type Fragment = Pick<Piece, 'text' | 'shift' | 'accent'>

const fitted = new WeakMap<FilmCaption, Fit>()
const isPlain = (word: Fragment[]) => word.every(part => part.shift === 0 && !part.accent)
const wordText = (word: Fragment[]) => word.map(part => part.text).join('')

// Breaks a line that is wider than the room at its spaces. Letters shrink only when a single word is
// still too wide, so the words never leave the frame whatever was written. `read` gives a run's words
function layOut (ctx: CanvasRenderingContext2D, caption: FilmCaption, size: number, room: number, read: (run: CaptionRun) => string) {
  // Each line as words, a word as the parts it is drawn from
  const source = caption.lines.map(line => {
    const words: Fragment[][] = [[]]
    for (const run of line) {
      read(run).split(' ').forEach((part, index) => {
        if (index > 0) words.push([])
        if (part !== '') words[words.length - 1].push({ text: part, shift: run.shift, accent: run.accent })
      })
    }
    return words
  })

  let fit = size
  let lines: Line[] = []
  let widest = 0
  let words = 0
  let letters = 0
  for (let tries = 0; ; tries++) {
    const whole = captionFont(caption, fit)
    const small = captionFont(caption, fit * SCRIPT_SIZE)
    const measure = (text: string, shift: number) => {
      ctx.font = shift === 0 ? whole : small
      return ctx.measureText(text).width
    }
    const space = measure(' ', 0)
    const widthOf = (parts: Fragment[]) => parts.reduce((sum, part) => sum + measure(part.text, part.shift), 0)
    // Plain words are measured as the one string they are drawn as; a line with marks is the sum of its parts
    const lineWidth = (line: Fragment[][]) => line.every(isPlain)
      ? measure(line.map(wordText).join(' '), 0)
      : line.reduce((sum, parts) => sum + widthOf(parts), 0) + space * (line.length - 1)

    const broken: Fragment[][][] = []
    for (const line of source) {
      let current: Fragment[][] = []
      for (const parts of line) {
        const longer = [...current, parts]
        if (current.length > 0 && lineWidth(longer) > room) {
          broken.push(current)
          current = [parts]
        } else {
          current = longer
        }
      }
      broken.push(current)
    }

    words = 0
    letters = 0
    lines = broken.map(line => {
      const pieces: Piece[] = []
      let x = 0
      for (const parts of line) {
        for (const part of parts) {
          const count = Array.from(part.text).length
          pieces.push({ ...part, x, word: words, letter: letters, letters: count })
          x += measure(part.text, part.shift)
          letters += count
        }
        x += space
        words++
      }
      const plain = line.every(isPlain) ? line.map(wordText).join(' ') : null
      return { pieces, width: plain === null ? Math.max(x - space, 0) : measure(plain, 0), plain }
    })
    widest = Math.max(...lines.map(line => line.width))
    if (widest <= room || tries === 5) break
    fit *= Math.max(room / widest, 0.5)
  }
  return { size: fit, lines, width: widest, words, letters }
}

// The widest a caption with live numbers comes to be, so its block keeps one place while the digits change
const steady = new WeakMap<FilmCaption, { room: number, width: number }>()

function fitCaption (ctx: CanvasRenderingContext2D, plan: CaptionPlan, caption: FilmCaption, time: number, size: number, room: number): Fit {
  // The words as they read at this second: a live number is written out
  const live = caption.lines.some(line => line.some(run => run.value))
  const write = (run: CaptionRun, value: number) => run.value ? writeNumber(value, run.value.digits, run.value.comma) : run.text
  const read = (run: CaptionRun) => run.value ? write(run, captionValue(plan, caption, run.value.key, time)) : run.text
  const key = live ? `${room}|${caption.lines.map(line => line.map(read).join('')).join('\n')}` : String(room)
  const kept = fitted.get(caption)
  if (kept && kept.key === key) return kept

  const result: Fit = { key, ...layOut(ctx, caption, size, room, read) }
  if (live) {
    let widest = steady.get(caption)
    if (!widest || widest.room !== room) {
      // Each number written the longest way it will be: at the keys of its own track, or of the scene's
      const longest = (run: CaptionRun) => {
        if (!run.value) return run.text
        const name = run.value.key
        const track = caption.values[name] ?? plan.tracks.find(entry => entry.key === name && entry.target !== 'layers')
        const seen = name === 'seconds' ? [plan.duration] : [captionValue(plan, caption, name, time), ...(track ? track.values : [])]
        return seen.map(value => write(run, value)).reduce((long, written) => written.length > long.length ? written : long)
      }
      widest = { room, width: layOut(ctx, caption, size, room, longest).width }
      steady.set(caption, widest)
    }
    result.width = Math.max(result.width, widest.width)
  }
  fitted.set(caption, result)
  return result
}

// Faces a film's captions need, loaded before the first frame so no frame is drawn in a fallback face
export function loadCaptionFonts (plan: Pick<FilmPlan, 'captions'> & Partial<Pick<FilmPlan, 'graphics'>>): Promise<unknown> {
  const loads = plan.captions
    .filter(caption => caption.font !== 'system')
    .map(caption => {
      // A live number may come to show any digit
      const live = caption.lines.some(line => line.some(run => run.value))
      return document.fonts.load(captionFont(caption, 32), captionLetters(caption.lines) + (live ? '0123456789.,-' : '')).catch(() => undefined)
    })
  // A plot's labels and the numbers at the ends of its axes are in the plain text face
  for (const graphic of plan.graphics ?? []) {
    if (graphic.kind !== 'plot') continue
    const letters = [graphic.xLabel, graphic.yLabel].map(line => line ? captionLetters([line]) : '').join('') + '0123456789.,-'
    loads.push(document.fonts.load(plainFont(32), letters).catch(() => undefined))
  }
  return Promise.all(loads)
}

/**
 * Draws the captions shown at `time` over `ctx`, whose canvas holds the frame at `pixel` video pixels per
 * scene pixel. `composite` is the frame as the scene drew it: where the hole is and how the camera stands;
 * `sheet` the space sheet as it laid it, for words on it.
 */
export function drawCaptions (
  ctx: CanvasRenderingContext2D, plan: CaptionPlan, time: number, composite: CaptionFrame, pixel: number, sheet: GridSettings | null = null,
  crowd: FrameCrowd | null = null
) {
  const width = plan.width * pixel
  const height = plan.height * pixel
  const shortSide = Math.min(width, height)
  const margin = Math.max(SAFE_MARGIN * shortSide, composite.letterbox * pixel + 0.02 * shortSide)

  // The blocks of the words already drawn on this frame, for the ones after to be checked against
  const blocks: { index: number, caption: FilmCaption, block: Block }[] = []
  for (const [index, caption] of plan.captions.entries()) {
    const alpha = captionAlpha(caption, time) * Math.min(Math.max(typeof caption.opacity === 'number' ? caption.opacity : captionValue(plan, caption, caption.opacity, time), 0), 1)
    if (alpha <= 0) continue

    const { size, lines, width: widest, words, letters } = fitCaption(ctx, plan, caption, time, caption.size * shortSide, (width - 2 * margin) * caption.width)
    const lineHeight = size * LINE_HEIGHT
    const blockHeight = lineHeight * lines.length
    const whole = captionFont(caption, size)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = whole
    ctx.textBaseline = 'middle'
    ctx.fillStyle = caption.color
    ctx.strokeStyle = caption.color
    // A soft dark edge keeps the letters readable over bright stars
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
    ctx.shadowBlur = size * 0.35

    let x = width / 2
    let y = height / 2
    ctx.textAlign = 'center'

    if (typeof caption.at === 'object' && 'anchor' in caption.at) {
      // The words are centred on a point of the scene and ride with it
      const read = (value: FilmNumber) => typeof value === 'number' ? value : captionValue(plan, caption, value, time)
      const point = placeOnFrame(caption.at, read, composite, pixel, width, height, true, sheet)
      // A place on the sheet while none is laid, or behind its camera, shows nothing
      if (!point) {
        ctx.restore()
        continue
      }
      x = point.x
      y = point.y
    } else if (caption.at === 'hole' || caption.at === 'einstein' || caption.at === 'companion') {
      // Where the composite pass put the black hole on the frame
      const second = caption.at === 'companion' && composite.companionRadius > 0
      const hole = holeOnFrame(composite, pixel, second)
      const angle = caption.angle * Math.PI / 180
      // A spinning hole's shadow is not round: the label starts on its outline in that direction
      const shadow = composite.horizon * shadowScaleAt(composite.shadowShape, angle, composite.spinAxis)
      const edge = (second
        ? composite.companionRadius
        : caption.at === 'einstein' && composite.einstein > 0 ? composite.einstein : shadow) * composite.cameraZoom * pixel
      // A label can start anywhere around the hole it points at, in that hole's radii: an orbit, a distance
      const radius = caption.radius === null ? edge : hole.radius * caption.radius
      const dirX = Math.cos(angle)
      const dirY = -Math.sin(angle)
      const fromX = hole.x + dirX * radius
      const fromY = hole.y + dirY * radius
      const reach = LABEL_REACH * shortSide
      const toX = fromX + dirX * reach
      const toY = fromY + dirY * reach
      const leftward = dirX < -0.2
      const sideways = Math.abs(dirX) >= 0.2

      ctx.lineWidth = Math.max(1, size * 0.05)
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(toX, toY)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(fromX, fromY, Math.max(1.5, size * 0.11), 0, Math.PI * 2)
      ctx.fill()

      ctx.textAlign = sideways ? (leftward ? 'right' : 'left') : 'center'
      x = toX + (sideways ? (leftward ? -1 : 1) * size * LABEL_GAP : 0)
      y = sideways ? toY : toY + (dirY < 0 ? -1 : 1) * (blockHeight / 2 + size * LABEL_GAP)
    } else if (caption.at === 'bottom') {
      y = height - margin - blockHeight / 2
    } else if (caption.at === 'top') {
      y = margin + blockHeight / 2
    } else if (caption.at !== 'center') {
      x = caption.at[0] * width
      y = caption.at[1] * height
    }
    // A block given its edge stands there by that edge: a legend's rows, a column inside a plate
    const pointing = caption.at === 'hole' || caption.at === 'einstein' || caption.at === 'companion'
    if (caption.anchor && !pointing && caption.at !== 'bottom' && caption.at !== 'top' && caption.at !== 'center') ctx.textAlign = caption.anchor

    // The words stay inside the frame, whatever they point at and however far the camera has moved in
    const left = ctx.textAlign === 'center' ? x - widest / 2 : ctx.textAlign === 'right' ? x - widest : x
    x += Math.max(margin - left, 0) - Math.max(left + widest - (width - margin), 0)
    y = Math.min(Math.max(y, margin + blockHeight / 2), Math.max(height - margin - blockHeight / 2, margin + blockHeight / 2))
    const blockLeft = ctx.textAlign === 'center' ? x - widest / 2 : ctx.textAlign === 'right' ? x - widest : x
    // Words that are there to be read are checked for what crowds them: other words, and the shapes' strokes
    if (crowd && alpha >= 0.5) {
      const slack = size * CROWD_SLACK
      const block = { left: blockLeft + slack, top: y - blockHeight / 2 + slack, right: blockLeft + widest - slack, bottom: y + blockHeight / 2 - slack }
      for (const other of blocks) {
        const apart = other.block.right <= block.left || block.right <= other.block.left || other.block.bottom <= block.top || block.bottom <= other.block.top
        if (!apart) noteCrowd(crowd, `c${other.index}-${index}`, `${captionName(other.index, other.caption)} and ${captionName(index, caption)} lie on one another`, time)
      }
      for (const stroke of crowd.strokes) {
        if (stroke.points.some((point, at) => at > 0 && crosses(block, stroke.points[at - 1], point))) {
          noteCrowd(crowd, `g${stroke.graphic}-${index}`, `graphics[${stroke.graphic}] (${stroke.what}) runs through ${captionName(index, caption)}`, time)
        }
      }
      blocks.push({ index, caption, block })
    }

    if (caption.plate > 0) {
      const pad = size * 0.6
      ctx.save()
      ctx.shadowColor = 'transparent'
      ctx.globalAlpha = alpha * caption.plate
      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.roundRect(blockLeft - pad, y - blockHeight / 2 - pad * 0.6, widest + pad * 2, blockHeight + pad * 1.2, size * 0.4)
      ctx.fill()
      ctx.restore()
    }

    // Words that arrive one at a time: how many of them are there by now
    const arrived = caption.reveal ? Math.min(Math.max((time - caption.from) / caption.revealOver, 0), 1) : 1
    const shown = arrived * (caption.reveal === 'letters' ? letters : caption.reveal === 'words' ? words : lines.length)
    const align = caption.align ?? ctx.textAlign
    const placed = ctx.textAlign
    const small = captionFont(caption, size * SCRIPT_SIZE)

    lines.forEach((line, index) => {
      const lineY = y + (index - (lines.length - 1) / 2) * lineHeight
      if (line.plain !== null && arrived >= 1 && caption.align === null) {
        // A plain line that is all there is one string, drawn as it always was
        ctx.textAlign = placed
        ctx.globalAlpha = alpha
        ctx.font = whole
        ctx.fillStyle = caption.color
        ctx.fillText(line.plain, x, lineY)
        return
      }
      const lineLeft = align === 'center' ? blockLeft + (widest - line.width) / 2 : align === 'right' ? blockLeft + widest - line.width : blockLeft
      ctx.textAlign = 'left'
      for (const piece of line.pieces) {
        let text = piece.text
        let there = 1
        if (arrived < 1) {
          if (caption.reveal === 'letters') {
            const count = Math.floor(shown) - piece.letter
            if (count < piece.letters) text = count > 0 ? Array.from(piece.text).slice(0, count).join('') : ''
          } else {
            there = Math.min(Math.max(shown - (caption.reveal === 'words' ? piece.word : index), 0), 1)
          }
        }
        if (text === '' || there <= 0) continue
        ctx.globalAlpha = alpha * there
        ctx.font = piece.shift === 0 ? whole : small
        ctx.fillStyle = piece.accent ? caption.accent : caption.color
        ctx.fillText(text, lineLeft + piece.x, lineY + (piece.shift > 0 ? RAISED : piece.shift < 0 ? LOWERED : 0) * size)
      }
    })
    ctx.restore()
  }
}
