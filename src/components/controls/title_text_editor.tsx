import { useId } from 'react'
import { useIntroDebugStore, TITLE_TEXT_MAX_LENGTH } from '../../store/intro_debug_store'
import { TITLE_FONTS, type TitleFontKey } from '../../lib/title_sprite'
import ToggleButton from './toggle_button'

const CYRILLIC = /[Ѐ-ӿ]/

// Words, face and case of the intro title; every keystroke redraws the title live
function TitleTextEditor () {
  const title = useIntroDebugStore(state => state.title)
  const setTitle = useIntroDebugStore(state => state.setTitle)
  const missingGlyphs = title.font !== 'unbounded' && CYRILLIC.test(title.text)
  const fieldId = useId()
  const countId = `${fieldId}-count`
  const warningId = `${fieldId}-warning`

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 pb-2">
      {/* The field is named by its label alone; the count and the font warning describe it */}
      <div className="flex min-w-[240px] max-w-[420px] flex-1 flex-col gap-1">
        <span className="flex justify-between text-text-light/60">
          <label htmlFor={fieldId}>Text · Enter starts a new line</label>
          {/* The field's description reads the count in words; the short form is for the eye */}
          <span className="tabular-nums">
            <span aria-hidden="true">{title.text.length}/{TITLE_TEXT_MAX_LENGTH}</span>
            <span id={countId} className="sr-only">{title.text.length} of {TITLE_TEXT_MAX_LENGTH} characters</span>
          </span>
        </span>
        <textarea
          id={fieldId}
          aria-describedby={missingGlyphs ? `${countId} ${warningId}` : countId}
          rows={2}
          value={title.text}
          maxLength={TITLE_TEXT_MAX_LENGTH}
          spellCheck={false}
          onChange={(event) => setTitle({ text: event.target.value })}
          className="resize-none border border-neon-cyan/40 bg-black/40 px-2 py-1.5 font-mono text-xs leading-relaxed text-text-light
            caret-neon-cyan outline-none transition-colors duration-150 selection:bg-neon-cyan/30 focus:border-neon-cyan"
        />
        {/* Always in the accessibility tree, out of the layout while empty, so a screen reader announces the
            warning when it appears */}
        <span id={warningId} role="status" className="text-neon-yellow/80 empty:sr-only">
          {missingGlyphs && `${TITLE_FONTS[title.font].label} lacks Cyrillic: use ${TITLE_FONTS.unbounded.label}`}
        </span>
      </div>

      {/* ALL CAPS names itself, so it sits on the font buttons' line without a caption of its own */}
      <div className="flex flex-col gap-1">
        <span className="text-text-light/60">Font</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
          <ToggleButton active={title.uppercase} onClick={() => setTitle({ uppercase: !title.uppercase })} className="h-7 px-2 text-xs">
            ALL CAPS
          </ToggleButton>
        </div>
      </div>
    </div>
  )
}

export default TitleTextEditor
