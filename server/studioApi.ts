import { promises as fs } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { slugOfFileName } from '../src/model/layoutNames.ts'
import type { Workspace } from './workspace.ts'
import {
  assertSlug,
  createLayout,
  deleteLayout,
  LayoutError,
  layoutFile,
  listLayouts,
  renameLayout,
} from './layouts.ts'

// Dev-only API so the browser can write back into the open workspace
// (server/workspace.ts); <layouts> and <artwork> are its folders:
//   GET  /api/workspace        { name, defaultPlan, layouts } for scripts and tests
//   GET  /api/artwork          list images in <artwork>
//   POST /api/artwork?name=..  upload one image (raw body), returns { url, name }
//   GET  /api/decor            read <layouts>/decor.json
//   PUT  /api/decor            replace <layouts>/decor.json
// /api/decor takes ?file=<slug> to use <layouts>/decor.<slug>.json instead.
//   GET    /api/layouts             list layouts (main first; ?all=1 includes e2e*/test* files)
//   POST   /api/layouts             { name, data? | from? } save a new layout, returns { slug, name }
//   PATCH  /api/layouts?file=<slug> { name } rename (no ?file= renames the main one), returns { slug, name }
//   DELETE /api/layouts?file=<slug> delete a named layout
//   GET    /api/image?url=<link>    a remote image, fetched here for the TV screen (public http(s) only, 15 MB)
// Changes to the decor files on disk are pushed to open tabs as 'decor:changed',
// and any layout file written, added or removed as 'layouts:changed'.

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
  const stem =
    path
      .basename(wanted, path.extname(wanted))
      .replace(/[^\w.\- ]+/g, '-')
      .slice(0, 80) || 'artwork'
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

/** Remote images for the TV screen, fetched here so the page can use them as textures (no CORS). */
const MAX_IMAGE = 15 * 1024 * 1024
const imageCache = new Map<string, { type: string; body: Buffer }>()

export class ImageError extends Error {
  status = 400
}

/** Only public http(s) hosts: no local or private addresses. */
export function checkImageUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new ImageError('Not a link')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ImageError('Only http and https links')
  const h = u.hostname.toLowerCase()
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/.test(h)
  )
    throw new ImageError('Not a public address')
  return u
}

async function fetchImage(raw: string): Promise<{ type: string; body: Buffer }> {
  const u = checkImageUrl(raw)
  const hit = imageCache.get(u.href)
  if (hit) return hit
  // Ask like a browser: many image hosts refuse other clients (403).
  const r = await fetch(u, {
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      Accept: 'image/webp,image/jpeg,image/png,image/avif,image/*;q=0.8',
      'Accept-Language': 'en,es;q=0.9',
    },
  })
  if (!r.ok) throw new ImageError(`The image server answered ${r.status}`)
  const type = r.headers.get('content-type')?.split(';')[0].trim() ?? ''
  if (!type.startsWith('image/')) throw new ImageError('That link is not an image')
  if (Number(r.headers.get('content-length') ?? 0) > MAX_IMAGE) throw new ImageError('Image too large')
  const body = Buffer.from(await r.arrayBuffer())
  if (body.length > MAX_IMAGE) throw new ImageError('Image too large')
  const out = { type, body }
  if (imageCache.size > 30) imageCache.delete(imageCache.keys().next().value!)
  imageCache.set(u.href, out)
  return out
}

/** Where the API reads and writes: the open workspace's folders (server/workspace.ts). */
export type ApiDirs = Pick<Workspace, 'layoutsDir' | 'artworkDir' | 'defaultPlan' | 'name'>

export function studioApi(ws: ApiDirs): Plugin {
  return {
    name: 'studio-api',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root
      const artDir = ws.artworkDir
      const dataDir = ws.layoutsDir
      const decorFileFor = (slug: string | null) => {
        if (slug) assertSlug(slug)
        return layoutFile(dataDir, slug)
      }

      server.watcher.add(path.join(dataDir, 'decor*.json'))
      /** The slug of a layout file (null for decor.json), undefined for any other file. */
      const layoutOf = (file: string) =>
        path.dirname(file) === dataDir ? slugOfFileName(path.basename(file)) : undefined
      server.watcher.on('change', (file) => {
        const slug = layoutOf(file)
        if (slug === undefined) return
        server.ws.send({ type: 'custom', event: 'decor:changed', data: { file: slug } })
        server.ws.send({ type: 'custom', event: 'layouts:changed', data: {} })
      })
      for (const ev of ['add', 'unlink'] as const)
        server.watcher.on(ev, (file) => {
          if (layoutOf(file) !== undefined) server.ws.send({ type: 'custom', event: 'layouts:changed', data: {} })
        })

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()
        try {
          if (url.pathname === '/api/workspace' && req.method === 'GET') {
            // For scripts and browser tests that seed layout files on disk.
            return send(res, 200, { name: ws.name, defaultPlan: ws.defaultPlan, layouts: path.relative(root, dataDir) })
          }
          if (url.pathname === '/api/artwork' && req.method === 'GET') {
            await fs.mkdir(artDir, { recursive: true })
            const files = (await fs.readdir(artDir))
              .filter((f) => IMAGE_EXT.test(f))
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            return send(
              res,
              200,
              files.map((name) => ({ name, url: artUrl(name) })),
            )
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
          if (url.pathname === '/api/image' && req.method === 'GET') {
            const out = await fetchImage(url.searchParams.get('url') ?? '')
            res.statusCode = 200
            res.setHeader('Content-Type', out.type)
            res.setHeader('Cache-Control', 'max-age=86400')
            return res.end(out.body)
          }
          if (url.pathname === '/api/layouts') {
            const file = url.searchParams.get('file')
            if (req.method === 'GET')
              return send(res, 200, await listLayouts(dataDir, ws.defaultPlan, url.searchParams.get('all') === '1'))
            if (req.method === 'POST') {
              const body = JSON.parse((await readBody(req, 5 * 1024 * 1024)).toString('utf8') || '{}')
              return send(res, 201, await createLayout(dataDir, body))
            }
            if (req.method === 'PATCH') {
              const body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}')
              return send(res, 200, await renameLayout(dataDir, file, body.name))
            }
            if (req.method === 'DELETE') {
              await deleteLayout(dataDir, file)
              return send(res, 200, { ok: true })
            }
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
          if (e instanceof LayoutError || e instanceof ImageError) return send(res, e.status, { error: e.message })
          if (
            e instanceof Error &&
            (e.name === 'TimeoutError' || e.name === 'TypeError') &&
            url.pathname === '/api/image'
          )
            return send(res, 502, { error: 'Could not reach that image' })
          if (e instanceof SyntaxError) return send(res, 400, { error: 'Malformed JSON' })
          send(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}
