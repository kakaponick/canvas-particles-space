// Shapes of a film, drawn over a finished frame on the 2D canvas the captions are drawn on, under them: lines
// and arrows, circles, boxes, small charts and pictures. A shape stands on the frame or rides with a black
// hole, and any of its numbers can be read from the film as it plays, so a ring follows the setting it marks
// and a dot walks along a curve with the number a caption counts. A film without shapes never comes here.
import type { CompositeSettings } from './particle_renderer'
import { captionAlpha, captionValue, type FilmGraphic, type FilmNumber, type FilmPlace, type FilmPlan } from './film'
import { drawMarked, placeOnFrame, plainFont } from './film_captions'
import { clamp, fail } from './agent_values'

type Point = readonly [number, number]

// Shares of the frame's short side: the least an arrow's head is long, and a plot's dot against its stroke
const ARROW_LEAST = 0.012
const ARROW_WIDTHS = 4.5
const MARKER_WIDTHS = 2.4
// Pieces a curve between two places is cut into, and the pixels one piece of a circle spans
const SMOOTH_PIECES = 16
const ARC_PIXELS = 2
const PLOT_INK = 0.7

export type FilmImages = Map<string, ImageBitmap>

/**
 * Reads every picture a film shows, before its first frame. `urls` gives the address a written `src` is
 * read at, for a film server that hands out files of its own machine; without one a `src` is its address.
 */
export async function loadGraphicImages (plan: FilmPlan, urls: Record<string, string> = {}): Promise<FilmImages> {
  const images: FilmImages = new Map()
  const sources = [...new Set(plan.graphics.filter(graphic => graphic.kind === 'image').map(graphic => graphic.src))]
  await Promise.all(sources.map(async src => {
    const name = src.startsWith('data:') ? 'a picture given as data' : `the picture "${src}"`
    let blob: Blob
    try {
      const response = await fetch(urls[src] ?? src)
      if (!response.ok) throw new Error(`the answer was ${response.status}`)
      blob = await response.blob()
    } catch (error) {
      fail(`graphics: ${name} cannot be read (${error instanceof Error ? error.message : String(error)}). ` +
        'A picture is a data URL, a URL that allows other pages to read it, or through the film server a path on its machine')
    }
    try {
      images.set(src, await createImageBitmap(blob))
    } catch {
      fail(`graphics: ${name} is not a picture the browser can draw (png, jpeg, webp, gif, avif)`)
    }
  }))
  return images
}

// A curve through the points, as the short straight pieces it is drawn from (Catmull-Rom)
function smoothed (points: Point[], closed: boolean): Point[] {
  if (points.length < 3) return points
  const count = points.length
  const at = (index: number) => closed ? points[(index + count) % count] : points[clamp(index, 0, count - 1)]
  const out: Point[] = []
  const last = closed ? count : count - 1
  for (let index = 0; index < last; index++) {
    const [a, b, c, d] = [at(index - 1), at(index), at(index + 1), at(index + 2)]
    for (let piece = 0; piece < SMOOTH_PIECES; piece++) {
      const t = piece / SMOOTH_PIECES
      const along = (axis: 0 | 1) => 0.5 * (2 * b[axis] + (c[axis] - a[axis]) * t +
        (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t * t + (3 * b[axis] - a[axis] - 3 * c[axis] + d[axis]) * t * t * t)
      out.push([along(0), along(1)])
    }
  }
  if (!closed) out.push(points[count - 1])
  return out
}

// The first `share` of a path by its length
function partOf (points: Point[], share: number): Point[] {
  if (share >= 1 || points.length < 2) return points
  let whole = 0
  for (let index = 1; index < points.length; index++) whole += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1])
  let left = whole * share
  const out: Point[] = [points[0]]
  for (let index = 1; index < points.length && left > 0; index++) {
    const [fromX, fromY] = points[index - 1]
    const [toX, toY] = points[index]
    const length = Math.hypot(toX - fromX, toY - fromY)
    if (length <= left) out.push(points[index])
    else if (length > 0) out.push([fromX + (toX - fromX) * left / length, fromY + (toY - fromY) * left / length])
    left -= length
  }
  return out
}

function trace (ctx: CanvasRenderingContext2D, points: Point[], closed: boolean) {
  ctx.beginPath()
  points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  if (closed) ctx.closePath()
}

// A filled head at `tip`, pointing the way the path arrives there from `before`
function arrowHead (ctx: CanvasRenderingContext2D, tip: Point, before: Point, length: number) {
  const reach = Math.hypot(tip[0] - before[0], tip[1] - before[1])
  if (reach === 0) return
  const dirX = (tip[0] - before[0]) / reach
  const dirY = (tip[1] - before[1]) / reach
  const half = length * 0.42
  ctx.beginPath()
  ctx.moveTo(tip[0], tip[1])
  ctx.lineTo(tip[0] - dirX * length - dirY * half, tip[1] - dirY * length + dirX * half)
  ctx.lineTo(tip[0] - dirX * length + dirY * half, tip[1] - dirY * length - dirX * half)
  ctx.closePath()
  ctx.fill()
}

// The point a path has reached `back` pixels before its end, so a line stops inside its arrow's head
function pulledBack (points: Point[], back: number): Point[] {
  const out = [...points]
  let left = back
  while (out.length > 1) {
    const [toX, toY] = out[out.length - 1]
    const [fromX, fromY] = out[out.length - 2]
    const length = Math.hypot(toX - fromX, toY - fromY)
    if (length > left) {
      out[out.length - 1] = [toX - (toX - fromX) * left / length, toY - (toY - fromY) * left / length]
      break
    }
    left -= length
    out.pop()
  }
  return out
}

// A plot's curve up to x `until`, in the plot's own numbers, and the point on it at an x
function upTo (points: FilmGraphic['series'][number]['points'], until: number): Point[] {
  const out: Point[] = []
  for (let index = 0; index < points.length; index++) {
    const [x, y] = points[index]
    if (x <= until) {
      out.push([x, y])
      continue
    }
    if (index > 0 && points[index - 1][0] < until) {
      const [beforeX, beforeY] = points[index - 1]
      out.push([until, beforeY + (y - beforeY) * (until - beforeX) / (x - beforeX)])
    }
    break
  }
  return out
}

function pointAt (points: FilmGraphic['series'][number]['points'], x: number): Point | null {
  for (let index = 1; index < points.length; index++) {
    const [fromX, fromY] = points[index - 1]
    const [toX, toY] = points[index]
    if ((x - fromX) * (x - toX) > 0) continue
    return [x, toX === fromX ? toY : fromY + (toY - fromY) * (x - fromX) / (toX - fromX)]
  }
  return null
}

// A number written as short as it reads: an axis's end
const short = (value: number) => String(+value.toPrecision(4))

/**
 * Draws the shapes shown at `time` over `ctx`, whose canvas holds the frame at `pixel` video pixels per scene
 * pixel. `composite` is the frame as the scene drew it: where the holes are and how the camera stands.
 */
export function drawGraphics (ctx: CanvasRenderingContext2D, plan: FilmPlan, time: number, composite: CompositeSettings, pixel: number, images: FilmImages) {
  const width = plan.width * pixel
  const height = plan.height * pixel
  const shortSide = Math.min(width, height)

  for (const graphic of plan.graphics) {
    const read = (value: FilmNumber) => typeof value === 'number' ? value : captionValue(plan, graphic, value, time)
    const alpha = captionAlpha(graphic, time) * clamp(read(graphic.opacity), 0, 1)
    if (alpha <= 0) continue
    const at = (place: FilmPlace) => placeOnFrame(place, read, composite, pixel, width, height)
    // How much of its stroke is there by now
    const drawn = graphic.draw > 0 ? clamp((time - graphic.from) / graphic.draw, 0, 1) : 1
    const stroke = Math.max(graphic.width * shortSide, graphic.width > 0 ? 1 : 0)
    const fillAlpha = graphic.fill ? alpha * drawn * clamp(read(graphic.fillOpacity), 0, 1) : 0

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = graphic.color
    ctx.fillStyle = graphic.color
    ctx.lineWidth = stroke
    ctx.lineJoin = 'round'
    ctx.lineCap = graphic.dash ? 'butt' : 'round'
    if (graphic.dash) ctx.setLineDash([graphic.dash[0] * shortSide, graphic.dash[1] * shortSide])

    // A closed outline is filled whole and stroked as far as it is drawn
    const outline = (points: Point[], closed: boolean) => {
      if (fillAlpha > 0 && points.length > 2) {
        ctx.globalAlpha = fillAlpha
        ctx.fillStyle = graphic.fill as string
        trace(ctx, points, true)
        ctx.fill()
        ctx.globalAlpha = alpha
        ctx.fillStyle = graphic.color
      }
      if (stroke <= 0 || drawn <= 0) return
      trace(ctx, partOf(closed ? [...points, points[0]] : points, drawn), closed && drawn >= 1)
      ctx.stroke()
    }

    if (graphic.kind === 'line') {
      const places = graphic.points.map(at)
      if (places.every(place => place !== null)) {
        const corners = places.map(place => [place.x, place.y] as const)
        const path = graphic.smooth ? smoothed(corners, graphic.close) : corners
        if (!graphic.arrow || graphic.close) {
          outline(path, graphic.close)
        } else if (drawn > 0) {
          const head = Math.max(stroke * ARROW_WIDTHS, ARROW_LEAST * shortSide)
          let shown = partOf(path, drawn)
          if (shown.length > 1) {
            const end = shown[shown.length - 1]
            const start = shown[0]
            const tips: [Point, Point][] = []
            if (graphic.arrow !== 'start') {
              tips.push([end, shown[shown.length - 2]])
              shown = pulledBack(shown, head * 0.7)
            }
            if (graphic.arrow !== 'end' && shown.length > 1) {
              tips.push([start, shown[1]])
              shown = pulledBack([...shown].reverse(), head * 0.7).reverse()
            }
            trace(ctx, shown, false)
            ctx.stroke()
            ctx.setLineDash([])
            for (const [tip, before] of tips) arrowHead(ctx, tip, before, head)
          }
        }
      }
    } else if (graphic.kind === 'circle' && graphic.center) {
      const center = at(graphic.center)
      if (center) {
        const radiusX = Math.max(read(graphic.radius), 0) * center.unit
        const radiusY = graphic.radiusY === null ? radiusX : Math.max(read(graphic.radiusY), 0) * center.unit
        const from = graphic.arc ? read(graphic.arc[0]) : 0
        const to = graphic.arc ? read(graphic.arc[1]) : 360
        const whole = Math.abs(to - from) >= 360
        const sweep = whole ? 360 : to - from
        const pieces = clamp(Math.ceil(Math.max(radiusX, radiusY) * Math.abs(sweep) * Math.PI / 180 / ARC_PIXELS), 16, 2048)
        const path: Point[] = []
        for (let piece = 0; piece < pieces + (whole ? 0 : 1); piece++) {
          const angle = (from + sweep * piece / pieces) * Math.PI / 180
          path.push([center.x + Math.cos(angle) * radiusX, center.y - Math.sin(angle) * radiusY])
        }
        if (radiusX > 0 && radiusY > 0) outline(path, whole)
      }
    } else if (graphic.kind === 'rect' && graphic.center) {
      const center = at(graphic.center)
      if (center) {
        const halfX = Math.max(read(graphic.size[0]), 0) * center.unit / 2
        const halfY = Math.max(read(graphic.size[1]), 0) * center.unit / 2
        const round = Math.min(Math.max(read(graphic.round), 0) * center.unit, halfX, halfY)
        const path: Point[] = []
        // From the top's left end, the way the clock goes; a round corner is a quarter turn of short pieces
        const corners: [number, number, number][] = [[1, -1, -90], [1, 1, 0], [-1, 1, 90], [-1, -1, 180]]
        for (const [sideX, sideY, start] of corners) {
          const middleX = center.x + sideX * (halfX - round)
          const middleY = center.y + sideY * (halfY - round)
          const pieces = round > 0 ? 8 : 0
          for (let piece = 0; piece <= pieces; piece++) {
            const angle = (start + (pieces > 0 ? 90 * piece / pieces : 0)) * Math.PI / 180
            path.push([middleX + Math.cos(angle) * round, middleY + Math.sin(angle) * round])
          }
        }
        if (halfX > 0 && halfY > 0) outline(path, true)
      }
    } else if (graphic.kind === 'image' && graphic.center) {
      const center = at(graphic.center)
      const picture = images.get(graphic.src)
      if (center && picture) {
        const wide = Math.max(read(graphic.imageWidth), 0) * center.unit
        const tall = wide * picture.height / picture.width
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(picture, center.x - wide / 2, center.y - tall / 2, wide, tall)
      }
    } else if (graphic.kind === 'plot') {
      const [left, top, wide, tall] = [graphic.box[0] * width, graphic.box[1] * height, graphic.box[2] * width, graphic.box[3] * height]
      const letters = graphic.labelSize * shortSide
      const [xMin, xMax] = graphic.xRange
      const [yMin, yMax] = graphic.yRange
      const onPlot = ([x, y]: Point): Point => [left + (x - xMin) / (xMax - xMin) * wide, top + tall - (y - yMin) / (yMax - yMin) * tall]

      ctx.setLineDash([])
      if (graphic.plate > 0) {
        const pad = letters * 2.6
        ctx.globalAlpha = alpha * graphic.plate
        ctx.fillStyle = '#000000'
        ctx.beginPath()
        ctx.roundRect(left - pad, top - pad * 0.9, wide + pad * 1.6, tall + pad * 1.7, letters * 0.6)
        ctx.fill()
      }
      // The two axes, the numbers their ends stand for, and what they measure
      ctx.globalAlpha = alpha * PLOT_INK
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1, stroke * 0.5)
      trace(ctx, [[left, top], [left, top + tall], [left + wide, top + tall]], false)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = plainFont(letters * 0.85)
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(short(xMin), left, top + tall + letters * 0.95)
      ctx.fillText(short(xMax), left + wide, top + tall + letters * 0.95)
      ctx.textAlign = 'right'
      ctx.fillText(short(yMin), left - letters * 0.45, top + tall)
      ctx.fillText(short(yMax), left - letters * 0.45, top)
      ctx.globalAlpha = alpha
      if (graphic.xLabel) drawMarked(ctx, graphic.xLabel, left + wide / 2, top + tall + letters * 0.95, letters, '#ffffff', graphic.color, 'center')
      if (graphic.yLabel) drawMarked(ctx, graphic.yLabel, left - letters * 0.2, top - letters * 1.1, letters, '#ffffff', graphic.color, 'left')

      const until = graphic.upTo === null ? Infinity : read(graphic.upTo)
      const mark = graphic.marker === null ? null : read(graphic.marker)
      ctx.save()
      ctx.beginPath()
      ctx.rect(left, top - stroke, wide + stroke, tall + stroke)
      ctx.clip()
      ctx.lineWidth = stroke
      if (graphic.dash) ctx.setLineDash([graphic.dash[0] * shortSide, graphic.dash[1] * shortSide])
      for (const series of graphic.series) {
        const curve = partOf(upTo(series.points, until).map(onPlot), drawn)
        if (curve.length < 2) continue
        ctx.strokeStyle = series.color
        trace(ctx, curve, false)
        ctx.stroke()
      }
      ctx.restore()
      if (mark !== null) {
        for (const series of graphic.series) {
          const point = pointAt(series.points, mark)
          if (!point || (point[1] - yMin) * (point[1] - yMax) > 0) continue
          const [x, y] = onPlot(point)
          // A thin line down to the axis says which x the dot stands at
          ctx.globalAlpha = alpha * 0.45
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = Math.max(1, stroke * 0.4)
          trace(ctx, [[x, y], [x, top + tall]], false)
          ctx.stroke()
          ctx.globalAlpha = alpha
          ctx.fillStyle = series.color
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = Math.max(1, stroke * 0.5)
          ctx.beginPath()
          ctx.arc(x, y, Math.max(stroke * MARKER_WIDTHS, 3), 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  }
}
