import { promises as fs } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'

// Dev-only API so the browser can write back into the project:
//   GET  /api/artwork          list images in public/artwork
//   POST /api/artwork?name=..  upload one image (raw body), returns { url, name }
//   GET  /api/decor            read data/decor.json
//   PUT  /api/decor            replace data/decor.json
// /api/decor takes ?file=<name> to use data/decor.<name>.json instead (tests use this).
// Changes to the decor files on disk are pushed to open tabs as 'decor:changed'.

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i
const MAX_UPLOAD = 30 * 1024 * 1024

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new Error('Upload too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const artUrl = (name: string) => `/artwork/${encodeURIComponent(name)}`

async function uniqueName(dir: string, wanted: string) {
  const ext = path.extname(wanted).toLowerCase()
  const stem = path.basename(wanted, path.extname(wanted)).replace(/[^\w.\- ]+/g, '-').slice(0, 80) || 'artwork'
  let name = `${stem}${ext}`
  for (let i = 2; ; i++) {
    try {
      await fs.access(path.join(dir, name))
      name = `${stem}-${i}${ext}`
    } catch {
      return name
    }
  }
}

export function studioApi(): Plugin {
  return {
    name: 'studio-api',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root
      const artDir = path.join(root, 'public', 'artwork')
      const dataDir = path.join(root, 'data')
      const decorFileFor = (name: string | null) => {
        if (!name) return path.join(dataDir, 'decor.json')
        if (!/^[a-z0-9-]{1,40}$/.test(name)) throw new Error('Bad decor file name')
        return path.join(dataDir, `decor.${name}.json`)
      }

      server.watcher.add(path.join(dataDir, 'decor*.json'))
      server.watcher.on('change', (file) => {
        const m = path.basename(file).match(/^decor(?:\.([a-z0-9-]+))?\.json$/)
        if (path.dirname(file) === dataDir && m) server.ws.send({ type: 'custom', event: 'decor:changed', data: { file: m[1] ?? null } })
      })

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()
        try {
          if (url.pathname === '/api/artwork' && req.method === 'GET') {
            await fs.mkdir(artDir, { recursive: true })
            const files = (await fs.readdir(artDir)).filter((f) => IMAGE_EXT.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            return send(res, 200, files.map((name) => ({ name, url: artUrl(name) })))
          }
          if (url.pathname === '/api/artwork' && req.method === 'POST') {
            const wanted = url.searchParams.get('name') ?? 'artwork.png'
            if (!IMAGE_EXT.test(wanted)) return send(res, 400, { error: 'Only png, jpg, webp, gif or avif images' })
            const body = await readBody(req, MAX_UPLOAD)
            await fs.mkdir(artDir, { recursive: true })
            const name = await uniqueName(artDir, wanted)
            await fs.writeFile(path.join(artDir, name), body)
            return send(res, 200, { name, url: artUrl(name) })
          }
          const decorFile = url.pathname === '/api/decor' ? decorFileFor(url.searchParams.get('file')) : ''
          if (url.pathname === '/api/decor' && req.method === 'GET') {
            // Served verbatim so clients can compare it with what they last wrote.
            const text = await fs.readFile(decorFile, 'utf8').catch(() => JSON.stringify({ version: 1, items: [] }))
            res.setHeader('Content-Type', 'application/json')
            return res.end(text)
          }
          if (url.pathname === '/api/decor' && req.method === 'PUT') {
            const data = JSON.parse((await readBody(req, 5 * 1024 * 1024)).toString('utf8'))
            if (!Array.isArray(data?.items)) return send(res, 400, { error: 'Expected { items: [] }' })
            await fs.mkdir(path.dirname(decorFile), { recursive: true })
            await fs.writeFile(decorFile, JSON.stringify(data, null, 2) + '\n')
            return send(res, 200, { ok: true })
          }
          send(res, 404, { error: 'Not found' })
        } catch (e) {
          send(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}
