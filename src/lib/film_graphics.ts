// Shapes of a film, drawn over a finished frame on the 2D canvas the captions are drawn on, under them: lines
// and arrows, circles, boxes, small charts and pictures. A shape stands on the frame or rides with a black
// hole, and any of its numbers can be read from the film as it plays, so a ring follows the setting it marks
// and a dot walks along a curve with the number a caption counts. A film without shapes never comes here.
import type { CompositeSettings } from './particle_renderer'
import { captionAlpha, captionValue, type FilmGraphic, type FilmNumber, type FilmPlace, type FilmPlan, type FilmPoint } from './film'
import { drawMarked, placeOnFrame, plainFont, type FrameCrowd } from './film_captions'
import type { GridSettings } from './space_grid'
import { clamp, fail } from './agent_values'

type Point = readonly [number, number]

// Shares of the frame's short side: the least an arrow's head is long, and a plot's dot against its stroke
const ARROW_LEAST = 0.012
const ARROW_WIDTHS = 4.5
const MARKER_WIDTHS = 2.4
// Pieces a curve between two places is cut into, and the pixels one piece of a circle spans
const SMOOTH_PIECES = 16
const ARC_PIXELS = 2
// The longest piece of a line laid on the space sheet, in the well's radii: short enough that the line bends
// with the dent between its places, long enough that a line across the whole sheet stays a few hundred points
const SHEET_STEP = 0.25
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

// A line through places on the frame: straight between them, or a curve through them. Null while a place
// is not there to be seen
function onFrame (places: ({ x: number, y: number } | null)[], smooth: boolean, close: boolean): Point[] | null {
  if (!places.every(place => place !== null)) return null
  const corners = (places as { x: number, y: number }[]).map(place => [place.x, place.y] as const)
  return smooth ? smoothed(corners, close) : corners
}

// A line through places on the space sheet lies on the sheet along its whole length: its curve is worked out
// on the sheet, its pieces are cut no longer than SHEET_STEP of the well's radii, and each point is sunk
// into the well and seen as the sheet is, so it dips with the dent between its places as at them
function onSheet (
  points: FilmPoint[], smooth: boolean, close: boolean, read: (value: FilmNumber) => number,
  at: (place: FilmPlace) => { x: number, y: number } | null
): Point[] | null {
  const corners: Point[] = points.map(point => [read(point.x), read(point.y)] as const)
  const curve = smooth ? smoothed(corners, close) : close ? [...corners, corners[0]] : corners
  const path: Point[] = []
  for (let index = 0; index < curve.length; index++) {
    const [toX, toY] = curve[index]
    const pieces = index === 0 ? 1 : Math.max(1, Math.ceil(Math.hypot(toX - curve[index - 1][0], toY - curve[index - 1][1]) / SHEET_STEP))
    for (let piece = index === 0 ? pieces : 1; piece <= pieces; piece++) {
      const share = piece / pieces
      const [fromX, fromY] = index === 0 ? curve[0] : curve[index - 1]
      const seen = at({ anchor: 'sheet', x: fromX + (toX - fromX) * share, y: fromY + (toY - fromY) * share })
      if (!seen) return null
      path.push([seen.x, seen.y])
    }
  }
  return path
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
 * pixel. `composite` is the frame as the scene drew it: where the holes are and how the camera stands; `sheet`
 * the space sheet as it laid it, for shapes that lie on it.
 */
export function drawGraphics (
  ctx: CanvasRenderingContext2D, plan: FilmPlan, time: number, composite: CompositeSettings, pixel: number, images: FilmImages, sheet: GridSettings | null = null,
  crowd: FrameCrowd | null = null
) {
  const width = plan.width * pixel
  const height = plan.height * pixel
  const shortSide = Math.min(width, height)

  for (const [index, graphic] of plan.graphics.entries()) {
    const read = (value: FilmNumber) => typeof value === 'number' ? value : captionValue(plan, graphic, value, time)
    const alpha = captionAlpha(graphic, time) * clamp(read(graphic.opacity), 0, 1)
    if (alpha <= 0) continue
    const at = (place: FilmPlace) => placeOnFrame(place, read, composite, pixel, width, height, false, sheet)
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
    // A glow is the canvas's shadow, unmoved and blurred, in the shape's own colour: it lies round the stroke,
    // the fill and an arrow's head alike
    const glow = clamp(read(graphic.glow), 0, 0.2)
    if (glow > 0) {
      ctx.shadowColor = graphic.color
      ctx.shadowBlur = glow * shortSide
    }

    // The fill's paint: one colour, or a sphere lit at a point (`light`, with the radius it spreads over), or
    // a fall from the outline's top to its bottom
    const paint = (points: Point[], light: { x: number, y: number, radius: number, centerX: number, centerY: number } | null) => {
      if (!graphic.fillTo) return graphic.fill as string
      if (light) {
        const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.centerX, light.centerY, light.radius)
        gradient.addColorStop(0, graphic.fill as string)
        gradient.addColorStop(1, graphic.fillTo)
        return gradient
      }
      let top = Infinity
      let bottom = -Infinity
      for (const [, y] of points) {
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
      const gradient = ctx.createLinearGradient(0, top, 0, bottom > top ? bottom : top + 1)
      gradient.addColorStop(0, graphic.fill as string)
      gradient.addColorStop(1, graphic.fillTo)
      return gradient
    }

    // A closed outline is filled whole and stroked as far as it is drawn
    const outline = (points: Point[], closed: boolean, light: Parameters<typeof paint>[1] = null, stroked = true) => {
      if (fillAlpha > 0 && points.length > 2) {
        ctx.globalAlpha = fillAlpha
        ctx.fillStyle = paint(points, light)
        trace(ctx, points, true)
        ctx.fill()
        ctx.globalAlpha = alpha
        ctx.fillStyle = graphic.color
      }
      if (!stroked || stroke <= 0 || drawn <= 0) return
      const shown = partOf(closed ? [...points, points[0]] : points, drawn)
      trace(ctx, shown, closed && drawn >= 1)
      ctx.stroke()
      // The stroke as it stands on this frame, for the words to be checked against (film_captions.ts)
      if (crowd && alpha >= 0.5) crowd.strokes.push({ graphic: index, what: graphic.kind, points: shown })
    }

    // An open stroke with its heads: at an end it stops inside the head, halfway it runs on under it
    const withArrows = (path: Point[]) => {
      const head = Math.max(stroke * ARROW_WIDTHS, ARROW_LEAST * shortSide)
      if (graphic.arrow === 'middle') {
        // The whole stroke, and one head halfway along its length once the stroke has drawn that far
        outline(path, false)
        const half = partOf(path, 0.5)
        if (drawn >= 0.5 && half.length > 1) {
          ctx.setLineDash([])
          arrowHead(ctx, half[half.length - 1], half[half.length - 2], head)
        }
        return
      }
      if (drawn <= 0) return
      let shown = partOf(path, drawn)
      if (shown.length < 2) return
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
      if (crowd && alpha >= 0.5) crowd.strokes.push({ graphic: index, what: graphic.kind, points: shown })
      ctx.setLineDash([])
      for (const [tip, before] of tips) arrowHead(ctx, tip, before, head)
    }

    if (graphic.kind === 'line') {
      const path = sheet && graphic.points.every(point => point.anchor === 'sheet')
        ? onSheet(graphic.points as FilmPoint[], graphic.smooth, graphic.close, read, at)
        : onFrame(graphic.points.map(at), graphic.smooth, graphic.close)
      if (path) {
        if (!graphic.arrow || graphic.close) outline(path, graphic.close)
        else withArrows(path)
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
        const turn = read(graphic.turn) * Math.PI / 180
        const cosTurn = Math.cos(turn)
        const sinTurn = Math.sin(turn)
        const pieces = clamp(Math.ceil(Math.max(radiusX, radiusY) * Math.abs(sweep) * Math.PI / 180 / ARC_PIXELS), 16, 2048)
        // A head halfway along a whole ring needs the ring's end joined to its start
        const ends = whole && graphic.arrow === 'middle' ? 1 : whole ? 0 : 1
        const path: Point[] = []
        for (let piece = 0; piece < pieces + ends; piece++) {
          const angle = (from + sweep * piece / pieces) * Math.PI / 180
          const alongX = Math.cos(angle) * radiusX
          const alongY = Math.sin(angle) * radiusY
          path.push([center.x + alongX * cosTurn - alongY * sinTurn, center.y - (alongX * sinTurn + alongY * cosTurn)])
        }
        const radius = Math.max(radiusX, radiusY)
        const light = {
          x: center.x + read(graphic.fillAt[0]) * radius,
          y: center.y - read(graphic.fillAt[1]) * radius,
          radius: radius * (1 + Math.hypot(read(graphic.fillAt[0]), read(graphic.fillAt[1]))),
          centerX: center.x,
          centerY: center.y
        }
        if (radiusX > 0 && radiusY > 0) {
          if (graphic.arrow && (!whole || graphic.arrow === 'middle')) {
            // The ring's fill under its stroke, then the stroke with its heads
            if (fillAlpha > 0) outline(whole ? path.slice(0, -1) : path, true, light, false)
            withArrows(path)
          } else {
            outline(path, whole, light)
          }
        }
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
