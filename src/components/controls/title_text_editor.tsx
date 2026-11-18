import { useIntroDebugStore, TITLE_TEXT_MAX_LENGTH } from '../../store/intro_debug_store'
import { TITLE_FONTS, type TitleFontKey } from '../../lib/title_sprite'
import ToggleButton from './toggle_button'

const CYRILLIC = /[Ѐ-ӿ]/

// Words, face and case of the intro title; every keystroke redraws the title live
function TitleTextEditor () {
  const title = useIntroDebugStore(state => state.title)
  const setTitle = useIntroDebugStore(state => state.setTitle)
  const missingGlyphs = title.font !== 'unbounded' && CYRILLIC.test(title.text)

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 pb-2">
      <label className="flex min-w-[240px] max-w-[420px] flex-1 flex-col gap-1">
        <span className="flex justify-between text-text-light/60">
          <span>Text · Enter starts a new line</span>
          <span className="tabular-nums">{title.text.length}/{TITLE_TEXT_MAX_LENGTH}</span>
        </span>
        <textarea
          rows={2}
          value={title.text}
          maxLength={TITLE_TEXT_MAX_LENGTH}
          spellCheck={false}
          onChange={(event) => setTitle({ text: event.target.value })}
          className="resize-none border border-neon-cyan/30 bg-black/40 px-2 py-1.5 font-mono text-xs leading-relaxed text-text-light
            caret-neon-cyan outline-none transition-colors duration-150 selection:bg-neon-cyan/30 focus:border-neon-cyan"
        />
        {missingGlyphs && (
          <span className="text-neon-yellow/80">
            {TITLE_FONTS[title.font].label} has no Cyrillic letters; they fall back to the system font. Unbounded has them.
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-text-light/60">Font</span>
        <div role="group" aria-label="Title font" className="flex gap-1">
          {(Object.keys(TITLE_FONTS) as TitleFontKey[]).map(key => (
            <ToggleButton
              key={key}
              active={title.font === key}
              onClick={() => setTitle({ font: key })}
              className="h-7 px-2 text-xs"
              style={{ fontFamily: `"${TITLE_FONTS[key].family}", sans-serif` }}
            >
              {TITLE_FONTS[key].label}
            </ToggleButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-text-light/60">Case</span>
        <ToggleButton active={title.uppercase} onClick={() => setTitle({ uppercase: !title.uppercase })} className="h-7 px-2 text-xs">
          ALL CAPS
        </ToggleButton>
      </div>
    </div>
  )
}

export default TitleTextEditor
