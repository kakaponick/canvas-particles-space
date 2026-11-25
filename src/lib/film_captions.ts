// Captions of a film, drawn over a finished frame on a 2D canvas: lines of text at a place on the frame,
// or a label with a line pointing at the black hole's shadow or its Einstein ring, wherever the camera
// has put them.
import { TITLE_FONTS } from './title_sprite'
import type { CompositeSettings } from './particle_renderer'
import { captionAlpha, type FilmCaption, type FilmPlan } from './film'

const LINE_HEIGHT = 1.3
// Shares of the frame's short side: room kept from the frame's edges, and how far a label stands from
// what it points at
const SAFE_MARGIN = 0.06
const LABEL_REACH = 0.09
// Gap between a pointer line and the letters it leads to, in letter heights
const LABEL_GAP = 0.5

function captionFont (caption: FilmCaption, size: number) {
  const family = caption.font === 'system' ? 'system-ui' : `"${TITLE_FONTS[caption.font].family}"`
  return `500 ${size}px ${family}, system-ui, sans-serif`
}

// Faces a film's captions need, loaded before the first frame so no frame is drawn in a fallback face
export function loadCaptionFonts (plan: FilmPlan): Promise<unknown> {
  const loads = plan.captions
    .filter(caption => caption.font !== 'system')
    .map(caption => document.fonts.load(captionFont(caption, 32), caption.text).catch(() => undefined))
  return Promise.all(loads)
}

/**
 * Draws the captions shown at `time` over `ctx`, whose canvas holds the frame at `pixel` video pixels per
 * scene pixel. `composite` is the frame as the scene drew it: where the hole is and how the camera stands.
 */
export function drawCaptions (ctx: CanvasRenderingContext2D, plan: FilmPlan, time: number, composite: CompositeSettings, pixel: number) {
  const width = plan.width * pixel
  const height = plan.height * pixel
  const shortSide = Math.min(width, height)
  const margin = Math.max(SAFE_MARGIN * shortSide, composite.letterbox * pixel + 0.02 * shortSide)

  for (const caption of plan.captions) {
    const alpha = captionAlpha(caption, time)
    if (alpha <= 0) continue

    const size = caption.size * shortSide
    const lines = caption.text.split('\n')
    const lineHeight = size * LINE_HEIGHT
    const blockHeight = lineHeight * lines.length
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = captionFont(caption, size)
    ctx.textBaseline = 'middle'
    ctx.fillStyle = caption.color
    ctx.strokeStyle = caption.color
    // A soft dark edge keeps the letters readable over bright stars
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
    ctx.shadowBlur = size * 0.35

    let x = width / 2
    let y = height / 2
    ctx.textAlign = 'center'

    if (caption.at === 'hole' || caption.at === 'einstein' || caption.at === 'companion') {
      // Where the composite pass put the black hole on the frame
      const zoom = composite.cameraZoom
      const second = caption.at === 'companion' && composite.companionRadius > 0
      const sceneX = second ? composite.companionX : composite.holeX
      const sceneY = second ? composite.companionY : composite.holeY
      const holeX = (composite.zoomX + (sceneX - composite.shakeX - composite.zoomX) * zoom) * pixel
      const holeY = (composite.zoomY + (sceneY - composite.shakeY - composite.zoomY) * zoom) * pixel
      const radius = (second
        ? composite.companionRadius
        : caption.at === 'einstein' && composite.einstein > 0 ? composite.einstein : composite.horizon) * zoom * pixel
      const angle = caption.angle * Math.PI / 180
      const dirX = Math.cos(angle)
      const dirY = -Math.sin(angle)
      const fromX = holeX + dirX * radius
      const fromY = holeY + dirY * radius
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

    // The words stay inside the frame, whatever they point at and however far the camera has moved in
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width))
    const left = ctx.textAlign === 'center' ? x - widest / 2 : ctx.textAlign === 'right' ? x - widest : x
    x += Math.max(margin - left, 0) - Math.max(left + widest - (width - margin), 0)
    y = Math.min(Math.max(y, margin + blockHeight / 2), Math.max(height - margin - blockHeight / 2, margin + blockHeight / 2))

    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + (index - (lines.length - 1) / 2) * lineHeight)
    })
    ctx.restore()
  }
}
