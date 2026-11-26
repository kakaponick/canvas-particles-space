// Holds the rule "Earlier films" of CLAUDE.md: the scene is built for the film made next, and no change
// keeps, guards or prices the picture a film had before. Claude Code runs this as a hook
// (.claude/settings.json) and it reads the event on stdin:
// - Stop, SubagentStop: the answer an agent is about to end on. One that counts earlier films as a cost, or
//   offers to hold the old look behind a flag or a preset, is sent back once to be said again.
// - PreToolUse of Write and Edit: the text going into a file, so a rule, a comment or a check that keeps
//   earlier films' bytes does not come back. Files of this folder are let through: they hold the patterns.
// - PreToolUse of Bash: the message of a git commit.
// Words inside backticks, a code block or a quote line are not read in an answer, which is how such words
// are quoted. Any failure of the hook itself lets the event through.
//
// `node .claude/hooks/earlier_films.mjs --check <file>...` prints what it finds in files, one line each,
// and exits 1 when it found something: the check for a change to the patterns.
import { readFileSync } from 'node:fs'

const RU = '[а-яёa-z-]*'
// Anything up to the end of the sentence; the dot of a file name is not one
const GAP = '(?:[^.\\n]|\\.(?=\\S))'

// Each pattern is one way of keeping or pricing an earlier look. Russian is what the answers are written in,
// English what the rules, the comments and the commits are
const PATTERNS = [
  // «меняет вид существующих 3D-фильмов»
  new RegExp(`(меня|измен|сдвин|сдвиг|перерис|слома|затрон|поплыв)${RU}\\s+(вид|облик|картинк${RU}|байт${RU}|кадр${RU})\\s+(всех\\s+)?(существующ|прежн|стар|готов|снят|опубликованн)${RU}\\s+(3d-)?(фильм|ролик)`, 'iu'),
  // «старые фильмы дают те же байты»
  new RegExp(`(существующ|прежн|стар|готов)${RU}\\s+(3d-)?(фильм|ролик)${RU}${GAP}{0,80}(те\\s+же\\s+байт|побайтно|не\\s+измен|не\\s+сдвин|сохран${RU}\\s+(вид|байт|картинк))`, 'iu'),
  // «нынешний закон стоит оставить как пресет», and the same said the other way round
  new RegExp(`(прежн|стар|нынешн|текущ)${RU}\\s+(вид|облик|закон|поведени${RU}|картинк${RU})${GAP}{0,60}(остав|сохран)${RU}${GAP}{0,30}(пресет|флаг|режим|опци|переключател)`, 'iu'),
  new RegExp(`(остав|сохран)${RU}${GAP}{0,40}(пресет|флаг|режим|опци)${RU}${GAP}{0,40}(прежн|стар)${RU}\\s+(вид|облик|закон|поведени|картинк)`, 'iu'),
  new RegExp(`обратн${RU}\\s+совместимост${RU}${GAP}{0,60}(фильм|ролик)`, 'iu'),
  // "earlier films keep theirs", "existing films are unchanged"
  /\b(existing|earlier|older|old|previous|prior)\s+(3d\s+)?(fractal\s+|particle\s+)?films?\b[^.\n]{0,80}\b(keep|keeps|kept|preserv\w*|unchanged|same\s+bytes|same\s+picture|stay\w*\s+the\s+same)\b/i,
  // "the films made before it was a setting keep their bytes"
  /\bfilms?\s+((made|rendered|from)\s+)*before\b[^.\n]{0,80}\b(keep|keeps|kept|preserv\w*|unchanged|change)\b/i,
  // "so films that leave it alone keep their bytes"
  /\bfilms?\b[^.\n]{0,60}\bkeep\s+(its|their)\s+(bytes|look|picture)\b/i,
  // "which changes the bytes of 3D films with orbits"
  /\b(chang\w+|mov\w+|break\w*|alter\w*)\s+the\s+(bytes|look|picture)s?\s+of\s+((the|every|all|existing|earlier|old|3d)\s+)*films?\b/i,
  // "keep the old law as a preset"
  /\b(keep|keeps|kept|preserv\w*)\s+(the\s+)?(old|earlier|previous|former|classic)\s+(look|law|behaviou?r|picture)\b[^.\n]{0,60}\b(preset|flag|mode|option|switch|default)\b/i,
  /\bbackwards?[- ]compat\w*[^.\n]{0,60}\bfilms?\b/i
]

// A sentence wrapped over lines is one line again; an empty line still parts two paragraphs
const unwrap = text => text.replace(/\r/g, '').split(/\n\s*\n/).map(part => part.replace(/\s*\n\s*/g, ' ')).join('\n')

// An answer without what it quotes: code blocks, words in backticks, quote lines
const unquoted = text => text.replace(/\r/g, '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/^\s*>.*$/gm, ' ')

export function findEarlierLook (text) {
  const plain = unwrap(text)
  const found = []
  for (const pattern of PATTERNS) {
    const match = pattern.exec(plain)
    if (match) found.push(match[0].trim())
  }
  return found
}

const RULE = 'CLAUDE.md, "Earlier films": the scene is built for the film made next and no earlier look is kept.'
const DO = 'Say what the change does and leave out what it does to films already made; offer no flag, preset, mode or default that holds the old look, and write no rule or check that keeps earlier films as they were.'

function lastAnswer (input) {
  if (typeof input.last_assistant_message === 'string') return input.last_assistant_message
  if (input.hook_event_name !== 'Stop' || !input.transcript_path) return ''
  const lines = readFileSync(input.transcript_path, 'utf8').trim().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry
    try { entry = JSON.parse(lines[i]) } catch { continue }
    if (entry.type !== 'assistant') continue
    const content = entry.message?.content
    const text = Array.isArray(content) ? content.filter(piece => piece.type === 'text').map(piece => piece.text).join('\n') : ''
    if (text) return text
  }
  return ''
}

function judge (input) {
  const event = input.hook_event_name
  if (event === 'Stop' || event === 'SubagentStop') {
    // Sent back once already: the second answer stands, so a false alarm costs one turn and no more
    if (input.stop_hook_active) return null
    const found = findEarlierLook(unquoted(lastAnswer(input)))
    if (found.length === 0) return null
    return {
      decision: 'block',
      reason: `${RULE} This answer keeps or prices an earlier look: «${found.join('» «')}». ${DO} Words quoted in backticks are not read. If the user asked which films a change moved, give the answer again as it is.`
    }
  }
  if (event !== 'PreToolUse') return null
  const tool = input.tool_name
  const args = input.tool_input ?? {}
  let text = ''
  let where = ''
  if (tool === 'Write' || tool === 'Edit') {
    const path = String(args.file_path ?? '').replace(/\\/g, '/')
    if (path.includes('/.claude/hooks/')) return null
    text = String(tool === 'Write' ? args.content ?? '' : args.new_string ?? '')
    where = 'the text for this file'
  } else if (tool === 'Bash') {
    const command = String(args.command ?? '')
    if (!/\bgit\b[^\n]*\bcommit\b/.test(command)) return null
    text = command
    where = 'this commit message'
  }
  const found = findEarlierLook(text)
  if (found.length === 0) return null
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `${RULE} In ${where}: «${found.join('» «')}». ${DO}`
    }
  }
}

if (process.argv[2] === '--check') {
  let hits = 0
  for (const file of process.argv.slice(3)) {
    for (const found of findEarlierLook(readFileSync(file, 'utf8'))) {
      hits++
      console.log(`${file}: ${found}`)
    }
  }
  process.exit(hits > 0 ? 1 : 0)
} else {
  try {
    const verdict = judge(JSON.parse(readFileSync(0, 'utf8')))
    if (verdict) process.stdout.write(JSON.stringify(verdict))
  } catch {
    // A hook that cannot read its event holds nothing up
  }
}
