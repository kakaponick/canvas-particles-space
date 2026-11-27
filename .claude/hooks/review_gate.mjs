// Holds the review gate of a film (.claude/skills/space-scene/SKILL.md, "A film", step 6): an agent does not end
// its work on a film it rendered that the reviewers have not passed as it is. Claude Code runs this as a Stop and
// SubagentStop hook (.claude/settings.json) and it reads the event on stdin. It looks at the films rendered into
// films/ in the last RECENT hours: each mp4 whose film (films/<name>.json or .js) has no passing verdict, or a
// verdict older than the mp4, or scripts changed since the verdict, sends the answer back once with what to run.
// A second stop in a row (stop_hook_active) goes through, so the agent can say why it stopped short. Any failure
// of the hook itself lets the event through.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const RECENT = 6 * 3600e3

async function main () {
  let event = {}
  try { event = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') } catch {}
  if (event.stop_hook_active) return
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const films = path.join(root, 'films')
  if (!fs.existsSync(films)) return
  const { holdsBack, REVIEW_ROOT } = await import(new URL('../skills/space-scene/scripts/review.mjs', import.meta.url))
  const held = []
  for (const file of fs.readdirSync(films)) {
    if (!file.endsWith('.mp4')) continue
    const made = fs.statSync(path.join(films, file)).mtimeMs
    if (Date.now() - made > RECENT) continue
    const name = file.replace(/\.mp4$/, '')
    const film = ['json', 'js'].map(kind => `films/${name}.${kind}`).find(each => fs.existsSync(path.join(root, each)))
    if (!film) continue
    let reason = holdsBack(film)
    const verdictFile = path.join(REVIEW_ROOT, name, 'verdict.json')
    if (!reason && fs.statSync(verdictFile).mtimeMs < made - 60e3) reason = 'it was rendered again after the review passed: review what was rendered'
    if (reason) held.push(`${film} (${reason})`)
  }
  if (held.length === 0) return
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `The review gate: ${held.join('; ')}. Before the film is reported, run the gate of .claude/skills/space-scene/SKILL.md, "A film", step 6: ` +
      'review.mjs sheets <film>, the film-review agent on its sheets, fix every blocker and major and draw the sheets again, then review.mjs verdict <film> pass "<what was found and fixed>". ' +
      'If the film is not to be reported as finished, say so plainly instead.'
  }))
}

main().catch(() => {})
