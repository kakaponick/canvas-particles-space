// The intro title as a white alpha mask. The composite shader turns the mask into dust that the
// explosion's light front lights up, so the sprite carries only the shape of the words.

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
}

export interface TitleSprite {
  canvas: HTMLCanvasElement
  // Logical size in CSS pixels; the bitmap is this times the pixel ratio
  width: number
  height: number
}

const LINE_HEIGHT_EM = 1.3
const MAX_LINE_WIDTH = 1400

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
  if (!ctx || lines.length === 0) return { canvas, width: 0, height: 0 }

  const probeSize = 100
  setFont(ctx, style, probeSize)
  const widest = Math.max(...lines.map(line => ctx.measureText(line).width))
  const targetWidth = Math.min(viewportWidth * style.size, MAX_LINE_WIDTH)
  const fontSize = probeSize * targetWidth / Math.max(widest, 1)

  const lineHeight = fontSize * LINE_HEIGHT_EM
  const width = Math.ceil(targetWidth + fontSize)
  const height = Math.ceil(lineHeight * lines.length + fontSize * 0.4)
  canvas.width = Math.ceil(width * pixelRatio)
  canvas.height = Math.ceil(height * pixelRatio)

  ctx.scale(pixelRatio, pixelRatio)
  setFont(ctx, style, fontSize)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  // Trailing tracking after the last glyph would push each line left of centre
  const x = width / 2 + fontSize * style.tracking / 2
  const top = height / 2 - lineHeight * (lines.length - 1) / 2
  lines.forEach((line, index) => ctx.fillText(line, x, top + index * lineHeight))

  return { canvas, width, height }
}
