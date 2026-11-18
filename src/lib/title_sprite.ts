export interface TitleSprite {
  canvas: HTMLCanvasElement
  // Logical size in CSS pixels; the bitmap is this times the pixel ratio
  width: number
  height: number
}

const FONT_FAMILY = 'Orbitron'
const MAX_WIDTH = 1100
const WIDTH_SHARE = 0.72
const TRACKING_EM = 0.18

function setFont (ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `400 ${size}px ${FONT_FAMILY}, sans-serif`
  // letterSpacing is missing from older engines; without it the title is simply tighter
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  spaced.letterSpacing = `${size * TRACKING_EM}px`
}

// Resolves once the title face is ready, or after `timeoutMs` so the intro never waits on the network
export function waitForTitleFont (timeoutMs: number): Promise<void> {
  const loaded = document.fonts?.load(`400 64px ${FONT_FAMILY}`).then(() => undefined) ?? Promise.resolve()
  const timeout = new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
  return Promise.race([loaded.catch(() => undefined), timeout])
}

// Rasterises the intro title as a white alpha mask sized to the viewport
export function renderTitleSprite (text: string, viewportWidth: number, pixelRatio: number): TitleSprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, width: 0, height: 0 }

  const probeSize = 100
  setFont(ctx, probeSize)
  const targetWidth = Math.min(viewportWidth * WIDTH_SHARE, MAX_WIDTH)
  const fontSize = probeSize * targetWidth / ctx.measureText(text).width

  const width = Math.ceil(targetWidth + fontSize)
  const height = Math.ceil(fontSize * 1.6)
  canvas.width = Math.ceil(width * pixelRatio)
  canvas.height = Math.ceil(height * pixelRatio)

  ctx.scale(pixelRatio, pixelRatio)
  setFont(ctx, fontSize)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  // Trailing tracking after the last glyph would push the text left of center
  ctx.fillText(text, width / 2 + fontSize * TRACKING_EM / 2, height / 2)

  return { canvas, width, height }
}
