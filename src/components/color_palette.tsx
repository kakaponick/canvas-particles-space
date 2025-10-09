import { useState } from 'react'
import { useColorPaletteStore } from '../hooks/use_color_palette_store'

function hexToRgb (hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

function ColorPalette () {
  const [selectedColor, setSelectedColor] = useState('#00ffff')
  const { colorPalette, addColor, removeColor, updateColor } = useColorPaletteStore()

  const handleAddColor = () => {
    const rgb = hexToRgb(selectedColor)
    if (rgb) {
      addColor({
        ...rgb,
        enabled: true,
        percent: 10,
        name: 'custom'
      })
    }
  }

  return (
    <div className="mb-6 pb-5 border-b border-[rgba(0,255,255,0.3)]">
      <h4 className="font-orbitron text-neon-magenta text-base mb-4 text-center">
        COLOR PALETTE
      </h4>
      
      <div className="flex flex-col gap-2.5 mb-4 max-h-[200px] overflow-y-auto">
        {colorPalette.map((color, index) => (
          <div
            key={index}
            className={`flex items-center gap-2.5 p-2.5 bg-[rgba(255,255,255,0.05)] rounded-md border border-[rgba(255,255,255,0.1)] transition-all duration-300 flex-wrap ${!color.enabled ? 'opacity-40' : ''} hover:bg-[rgba(255,255,255,0.1)] hover:border-neon-cyan`}
          >
            <input
              type="checkbox"
              checked={color.enabled}
              onChange={(e) => updateColor(index, { enabled: e.target.checked })}
              className="w-[18px] h-[18px] cursor-pointer accent-neon-cyan"
            />
            
            <div
              className="w-[30px] h-[30px] rounded border-2 border-[rgba(255,255,255,0.3)] cursor-pointer"
              style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
            />
            
            <div className="flex-1 font-mono text-xs text-text-light">
              <div className="text-[0.7rem]">{color.name}</div>
              <div className="text-[0.65rem] opacity-70">{color.percent}%</div>
            </div>
            
            <button
              onClick={() => {
                if (colorPalette.length > 1) {
                  removeColor(index)
                } else {
                  alert('You must have at least one color!')
                }
              }}
              className="bg-transparent border border-neon-magenta text-neon-magenta font-orbitron text-[0.7rem] px-2 py-1 rounded transition-all duration-300 hover:bg-neon-magenta hover:text-bg-dark hover:shadow-[0_0_10px_#ff00ff]"
            >
              DEL
            </button>

            <div className="w-full mt-1 flex gap-1 items-center">
              <label className="text-[0.7rem] text-neon-cyan">%:</label>
              <input
                type="range"
                min="1"
                max="100"
                value={color.percent}
                onChange={(e) => updateColor(index, { percent: parseInt(e.target.value) })}
                className="flex-1 h-[3px] bg-[rgba(255,255,255,0.1)] outline-none rounded-sm appearance-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="flex-1 h-[35px] border border-neon-cyan bg-[rgba(0,0,0,0.5)] rounded cursor-pointer"
        />
        <button
          onClick={handleAddColor}
          className="bg-transparent border border-neon-cyan text-neon-cyan font-orbitron text-xs px-4 py-2 rounded transition-all duration-300 hover:bg-neon-cyan hover:text-bg-dark hover:shadow-[0_0_15px_#00ffff]"
        >
          + ADD
        </button>
      </div>

      <style>{`
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #00ffff;
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}

export default ColorPalette

