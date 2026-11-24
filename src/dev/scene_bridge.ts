// Development only: lets an agent outside the browser drive this tab. The dev server forwards commands
// from POST /__space (tools/scene_bridge_plugin.ts) over the HMR WebSocket the page already holds, this
// module runs them on window.space and sends the result back. Production builds never load it.
import { sceneApi } from '../lib/scene_api'

// How often a tab tells the dev server it is still open, visible and focused
const HEARTBEAT_MS = 5000

interface SceneCall {
  id: number
  tab: string
  command: string
  args?: unknown[]
}

const tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID().slice(0, 8)
  : Math.random().toString(36).slice(2, 10)

// The commands of window.space, by their dotted names: 'set', 'intro.seek', 'intro.preset.apply'
function listCommands (node: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (typeof value === 'function') return [prefix + key]
    if (typeof value === 'object' && value !== null) return listCommands(value as Record<string, unknown>, `${prefix}${key}.`)
    return []
  })
}

async function runCommand (command: string, args: unknown[]) {
  let target: unknown = sceneApi
  let owner: unknown = null
  for (const part of command.split('.')) {
    owner = target
    const own = typeof target === 'object' && target !== null && Object.prototype.hasOwnProperty.call(target, part)
    target = own ? (target as Record<string, unknown>)[part] : undefined
  }
  if (typeof target !== 'function') {
    throw new Error(`Unknown command "${command}". Commands: ${listCommands(sceneApi).join(', ')}`)
  }
  return await (target as (...values: unknown[]) => unknown).apply(owner, args)
}

export function startSceneBridge () {
  const hot = import.meta.hot
  if (!hot) return

  const announce = () => hot.send('space:tab', {
    tab: tabId,
    url: window.location.href,
    visible: !document.hidden,
    focused: document.hasFocus()
  })
  announce()
  setInterval(announce, HEARTBEAT_MS)
  document.addEventListener('visibilitychange', announce)
  window.addEventListener('focus', announce)
  window.addEventListener('blur', announce)

  hot.on('space:call', async (call: SceneCall) => {
    if (call.tab !== tabId) return
    try {
      const result = await runCommand(call.command, call.args ?? [])
      hot.send('space:result', { id: call.id, ok: true, result })
    } catch (error) {
      hot.send('space:result', { id: call.id, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
}
