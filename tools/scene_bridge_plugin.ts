// Development only (apply: 'serve'): the dev server's end of the agent bridge. An agent posts a command to
// /__space; the server forwards it over the HMR WebSocket to the open tab the user looked at last, waits for
// the answer from window.space and returns it as JSON. A captured frame is saved under .space/shots and
// answered with its path. `vite build`, and so every deploy, never runs this.
//
//   GET  /__space                       open tabs and the command list
//   POST /__space { command, args?, tab? }
//
// scripts/space.mjs wraps it for the command line; the server writes its address to .space/server.json.
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const CALL_TIMEOUT_MS = 15000
// A tab that has not been heard from for this long is taken as closed
const TAB_STALE_MS = 15000
const MAX_BODY_BYTES = 1_000_000

interface TabState {
  tab: string
  url: string
  visible: boolean
  focused: boolean
}

interface Tab extends TabState {
  seen: number
  client: { send: (event: string, payload?: unknown) => void }
}

interface SceneResult {
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

function isLoopback (request: IncomingMessage) {
  const address = request.socket.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function reply (response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body, null, 2))
}

function readBody (request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
      if (body.length > MAX_BODY_BYTES) reject(new Error('Request body too large'))
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

export function sceneBridge (): Plugin {
  return {
    name: 'scene-bridge',
    apply: 'serve',
    configureServer (server) {
      const root = server.config.root
      const stateDir = path.join(root, '.space')
      const tabs = new Map<string, Tab>()
      const pending = new Map<number, (result: SceneResult) => void>()
      let nextId = 1

      server.ws.on('space:tab', (state: TabState, client) => {
        tabs.set(state.tab, { ...state, seen: Date.now(), client })
      })
      server.ws.on('space:result', (result: SceneResult) => {
        pending.get(result.id)?.(result)
        pending.delete(result.id)
      })

      // Live tabs, the one the user looked at last first: focused and visible, then visible, then any
      const liveTabs = () => {
        const now = Date.now()
        for (const [id, tab] of tabs) if (now - tab.seen > TAB_STALE_MS) tabs.delete(id)
        const rank = (tab: Tab) => (tab.focused && tab.visible ? 2 : tab.visible ? 1 : 0)
        return [...tabs.values()].sort((a, b) => rank(b) - rank(a) || b.seen - a.seen)
      }

      // Tells scripts/space.mjs where this server listens; Vite moves to the next port when one is taken
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address()
        if (!address || typeof address === 'string') return
        fs.mkdirSync(stateDir, { recursive: true })
        fs.writeFileSync(path.join(stateDir, 'server.json'), JSON.stringify({ url: `http://localhost:${address.port}` }))
      })

      const saveShot = (dataUrl: string) => {
        const shotsDir = path.join(stateDir, 'shots')
        fs.mkdirSync(shotsDir, { recursive: true })
        const file = path.join(shotsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.png`)
        fs.writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'))
        return file
      }

      server.middlewares.use('/__space', (request, response) => {
        // The dev server may listen on the network (--host); the bridge answers this machine only
        if (!isLoopback(request)) return reply(response, 403, { ok: false, error: 'The scene bridge answers localhost only' })

        if (request.method === 'GET') {
          return reply(response, 200, {
            ok: true,
            tabs: liveTabs().map(({ tab, url, visible, focused, seen }) => ({ tab, url, visible, focused, seenMsAgo: Date.now() - seen }))
          })
        }
        if (request.method !== 'POST') return reply(response, 405, { ok: false, error: 'Use GET or POST' })

        void (async () => {
          let call: { command?: unknown, args?: unknown, tab?: unknown }
          try {
            call = JSON.parse(await readBody(request) || '{}')
          } catch (error) {
            return reply(response, 400, { ok: false, error: `Body is not JSON: ${error instanceof Error ? error.message : String(error)}` })
          }
          if (typeof call.command !== 'string') return reply(response, 400, { ok: false, error: 'Send { "command": "describe", "args": [] }' })

          const live = liveTabs()
          const tab = typeof call.tab === 'string' ? live.find(entry => entry.tab === call.tab) : live[0]
          if (!tab) {
            return reply(response, 503, {
              ok: false,
              error: typeof call.tab === 'string' ? `No open tab "${call.tab}"` : 'No open tab: open the dev server page in a browser'
            })
          }

          const id = nextId++
          const result = await new Promise<SceneResult>((resolve) => {
            const timer = setTimeout(() => {
              pending.delete(id)
              resolve({ id, ok: false, error: `The tab did not answer in ${CALL_TIMEOUT_MS / 1000} s` })
            }, CALL_TIMEOUT_MS)
            pending.set(id, (answer) => {
              clearTimeout(timer)
              resolve(answer)
            })
            tab.client.send('space:call', { id, tab: tab.tab, command: call.command, args: Array.isArray(call.args) ? call.args : [] })
          })

          const body: Record<string, unknown> = { ...result, tab: tab.tab }
          delete body.id
          if (result.ok && typeof result.result === 'string' && result.result.startsWith('data:image/png;base64,')) {
            body.result = { file: saveShot(result.result) }
          }
          reply(response, result.ok ? 200 : 422, body)
        })()
      })
    }
  }
}
