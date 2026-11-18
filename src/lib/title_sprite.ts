// The intro title as two masks in one opaque bitmap: the letters in the red channel and their glow,
// the same letters blurred, in the green one. The composite shader turns the letters into dust that
// the explosion's light front lights up, so the sprite carries only shapes.

export const TITLE_FONTS = {
  unbounded: { family: 'Unbounded', label: 'UNBOUNDED' },
  orbitron: { family: 'Orbitron', label: 'ORBITRON' },
  geistMono: { family: 'Geist Mono', label: 'GEIST MONO' }
} as const

export type TitleFontKey = keyof typeof TITLE_FONTS

export interface TitleStyle {
  // Lines are separated by \n
  text: string
  font: TitleFontKey
  uppercase: boolean
  // 100–900; only variable faces (Unbounded, Geist Mono) change with it
  weight: number
  // Letter spacing in em
  tracking: number
  // Width of the widest line as a share of the viewport width
  size: number
  // How far the glow reaches from the letters, CSS pixels; 0 draws none
  haloRadius: number
  // How much wider than tall the glow is
  haloStreak: number
}

export interface TitleSprite {
  canvas: HTMLCanvasElement
  // Logical size in CSS pixels; the bitmap is this times the pixel ratio
  width: number
  height: number
  // Size of the words themselves, without the room left around them for the glow
  textWidth: number
  textHeight: number
}

const LINE_HEIGHT_EM = 1.3
const MAX_LINE_WIDTH = 1400
// Every WebGL device takes a texture this large; a wide glow lowers the bitmap's resolution instead
// of growing past it
const MAX_BITMAP_SIZE = 4096

function fontString (style: TitleStyle, size: number) {
  return `${Math.round(style.weight)} ${size}px "${TITLE_FONTS[style.font].family}", sans-serif`
}

function setFont (ctx: CanvasRenderingContext2D, style: TitleStyle, size: number) {
  ctx.font = fontString(style, size)
  // letterSpacing is missing from older engines; without it the title is simply tighter
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  spaced.letterSpacing = `${size * style.tracking}px`
}

export function titleLines (style: TitleStyle): string[] {
  const text = style.uppercase ? style.text.toUpperCase() : style.text
  return text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
}

// Resolves once the face is ready for these glyphs (Cyrillic loads its own file), or after
// `timeoutMs` so the intro never waits on the network
export function waitForTitleFont (style: TitleStyle, timeoutMs: number): Promise<void> {
  const sample = titleLines(style).join(' ') || 'A'
  const loaded = document.fonts?.load(fontString(style, 64), sample).then(() => undefined) ?? Promise.resolve()
  const timeout = new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
  return Promise.race([loaded.catch(() => undefined), timeout])
}

// Rasterises the title as centred lines, its widest line fitted to a share of the viewport width
export function renderTitleSprite (style: TitleStyle, viewportWidth: number, pixelRatio: number): TitleSprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const lines = titleLines(style)
  if (!ctx || lines.length === 0) return { canvas, width: 0, height: 0, textWidth: 0, textHeight: 0 }

  const probeSize = 100
  setFont(ctx, style, probeSize)
  const widest = Math.max(...lines.map(line => ctx.measureText(line).width))
  const targetWidth = Math.min(viewportWidth * style.size, MAX_LINE_WIDTH)
  const fontSize = probeSize * targetWidth / Math.max(widest, 1)

  const lineHeight = fontSize * LINE_HEIGHT_EM
  const haloRadius = Math.max(style.haloRadius, 0)
  const haloStreak = Math.max(style.haloStreak, 1)
  // The box leaves room for the glow on every side
  const width = Math.ceil(targetWidth + fontSize + 2 * haloRadius * haloStreak)
  const height = Math.ceil(lineHeight * lines.length + fontSize * 0.4 + 2 * haloRadius)
  const scale = Math.min(pixelRatio, MAX_BITMAP_SIZE / width, MAX_BITMAP_SIZE / height)
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)

  // Trailing tracking after the last glyph would push each line left of centre
  const x = width / 2 + fontSize * style.tracking / 2
  const top = height / 2 - lineHeight * (lines.length - 1) / 2
  const drawLines = (target: CanvasRenderingContext2D, color: string) => {
    setFont(target, style, fontSize)
    target.textAlign = 'center'
    target.textBaseline = 'middle'
    target.fillStyle = color
    lines.forEach((line, index) => target.fillText(line, x, top + index * lineHeight))
  }

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  drawLines(ctx, '#f00')

  if (haloRadius > 0) {
    // The glow is the letters' shadow, the one blur every engine draws. The letters themselves are
    // drawn off the bitmap so only the shadow lands on it. Drawing them squeezed sideways and
    // stretching the result back makes the blur as many times wider than tall
    const blurred = document.createElement('canvas')
    blurred.width = Math.max(Math.ceil(canvas.width / haloStreak), 1)
    blurred.height = canvas.height
    const blurCtx = blurred.getContext('2d')
    if (blurCtx) {
      const away = blurred.width + Math.ceil(haloRadius * scale * 2) + 16
      blurCtx.setTransform(scale * blurred.width / canvas.width, 0, 0, scale, -away, 0)
      blurCtx.shadowColor = '#0f0'
      blurCtx.shadowOffsetX = away
      // A shadow's blur is twice its spread, and the glow fades out at about twice its spread
      blurCtx.shadowBlur = haloRadius * scale
      drawLines(blurCtx, '#0f0')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(blurred, 0, 0, canvas.width, canvas.height)
    }
  }

  return { canvas, width, height, textWidth: targetWidth, textHeight: lineHeight * lines.length }
}
