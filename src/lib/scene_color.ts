// A colour setting as the scene draws it. The store keeps a colour as '#rrggbb'; the scene and the
// renderer want its three channels from 0 to 1. A SceneColor is made once with the scene and read from its
// setting every frame, which costs one string comparison while the setting stands still.
export interface SceneColor {
  // The setting's text these channels were read from
  source: string
  r: number
  g: number
  b: number
}

export const createSceneColor = (): SceneColor => ({ source: '', r: 1, g: 1, b: 1 })

// Reads the colour setting `hex` into `color`
export function readSceneColor (color: SceneColor, hex: string) {
  if (color.source === hex) return
  color.source = hex
  const value = Number.parseInt(hex.slice(1), 16) || 0
  color.r = (value >> 16 & 255) / 255
  color.g = (value >> 8 & 255) / 255
  color.b = (value & 255) / 255
}
