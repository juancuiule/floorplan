// @vitest-environment node
import { mkdtempSync, promises as fs, rmSync } from 'node:fs'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { studioApi } from '../../server/studioApi'

// Runs the plugin's middleware on a real http server over a temp project root.

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

let root: string
let base: string
let server: http.Server
let onChange: ((file: string) => void) | undefined
const wsSent: unknown[] = []
const watched: string[] = []

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'studio-api-'))
  let handler: Handler | undefined
  const fakeServer = {
    config: { root },
    watcher: {
      add: (p: string) => watched.push(p),
      on: (ev: string, fn: (file: string) => void) => {
        if (ev === 'change') onChange = fn
      },
    },
    ws: { send: (msg: unknown) => wsSent.push(msg) },
    middlewares: { use: (fn: Handler) => (handler = fn) },
  }
  const plugin = studioApi()
  expect(plugin.apply).toBe('serve')
  ;(plugin.configureServer as (s: unknown) => void)(fakeServer)
  expect(handler).toBeDefined()
  server = http.createServer((req, res) =>
    handler!(req, res, () => {
      res.statusCode = 418
      res.end('next')
    }),
  )
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((r) => server.close(r))
  rmSync(root, { recursive: true, force: true })
})

beforeEach(async () => {
  await fs.rm(path.join(root, 'public'), { recursive: true, force: true })
  await fs.rm(path.join(root, 'data'), { recursive: true, force: true })
  wsSent.length = 0
})

const artDir = () => path.join(root, 'public', 'artwork')
const upload = (name: string, body: string | Uint8Array<ArrayBuffer> = 'img') => fetch(`${base}/api/artwork?name=${encodeURIComponent(name)}`, { method: 'POST', body })

describe('routing', () => {
  it('passes non-API requests to the next middleware', async () => {
    const res = await fetch(`${base}/index.html`)
    expect(res.status).toBe(418)
  })

  it('404s unknown API routes and methods', async () => {
    expect((await fetch(`${base}/api/nope`)).status).toBe(404)
    expect((await fetch(`${base}/api/artwork`, { method: 'DELETE' })).status).toBe(404)
  })
})

describe('/api/artwork', () => {
  it('lists only images, in natural order, creating the folder if needed', async () => {
    expect(await (await fetch(`${base}/api/artwork`)).json()).toEqual([])
    await fs.mkdir(artDir(), { recursive: true })
    for (const f of ['img 10.png', 'img 2.jpg', 'notes.txt', 'b.WEBP', '.DS_Store']) await fs.writeFile(path.join(artDir(), f), 'x')
    const list = (await (await fetch(`${base}/api/artwork`)).json()) as { name: string; url: string }[]
    expect(list.map((x) => x.name)).toEqual(['b.WEBP', 'img 2.jpg', 'img 10.png'])
    expect(list[2].url).toBe('/artwork/img%2010.png')
  })

  it('stores an upload byte for byte', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255])
    const res = await upload('photo.png', bytes)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'photo.png', url: '/artwork/photo.png' })
    expect(new Uint8Array(await fs.readFile(path.join(artDir(), 'photo.png')))).toEqual(bytes)
  })

  it('never overwrites: repeated names get -2, -3…', async () => {
    const names = []
    for (let i = 0; i < 3; i++) names.push(((await (await upload('same.png', `v${i}`)).json()) as { name: string }).name)
    expect(names).toEqual(['same.png', 'same-2.png', 'same-3.png'])
    expect(await fs.readFile(path.join(artDir(), 'same.png'), 'utf8')).toBe('v0')
  })

  it('rejects non-image names', async () => {
    for (const name of ['evil.svg', 'notes.txt', 'x.png.exe', 'noext']) {
      const res = await upload(name)
      expect(res.status, name).toBe(400)
    }
    await expect(fs.readdir(artDir())).rejects.toThrow()
  })

  it('keeps uploads inside public/artwork and sanitizes odd characters', async () => {
    const a = (await (await upload('../../../escape.png')).json()) as { name: string }
    expect(a.name).toBe('escape.png')
    const b = (await (await upload('we?ird<>:name.JPG')).json()) as { name: string }
    expect(b.name).toBe('we-ird-name.jpg')
    const files = await fs.readdir(artDir())
    expect(files.sort()).toEqual(['escape.png', 'we-ird-name.jpg'])
    await expect(fs.access(path.join(root, 'escape.png'))).rejects.toThrow()
  })

  it('lowercases the extension and keeps the stem when uniquing', async () => {
    await upload('Pic.PNG')
    const b = (await (await upload('Pic.png')).json()) as { name: string }
    expect(b.name).toBe('Pic-2.png')
  })
})

describe('/api/decor', () => {
  const empty = { version: 1, items: [] }
  const doc = { version: 1, items: [{ kind: 'plant', id: 'p1' }] }

  it('returns an empty layout when the file is missing', async () => {
    expect(await (await fetch(`${base}/api/decor?file=unit`)).json()).toEqual(empty)
  })

  it('writes and reads back ?file= without touching decor.json', async () => {
    const put = await fetch(`${base}/api/decor?file=unit-1`, { method: 'PUT', body: JSON.stringify(doc) })
    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({ ok: true })
    const text = await fs.readFile(path.join(root, 'data', 'decor.unit-1.json'), 'utf8')
    expect(text).toBe(JSON.stringify(doc, null, 2) + '\n')
    // Served verbatim, so clients can compare with what they wrote.
    expect(await (await fetch(`${base}/api/decor?file=unit-1`)).text()).toBe(text)
    await expect(fs.access(path.join(root, 'data', 'decor.json'))).rejects.toThrow()
  })

  it('uses data/decor.json without ?file=', async () => {
    await fetch(`${base}/api/decor`, { method: 'PUT', body: JSON.stringify(doc) })
    expect(JSON.parse(await fs.readFile(path.join(root, 'data', 'decor.json'), 'utf8'))).toEqual(doc)
  })

  it('rejects bad file names (path traversal, uppercase, too long)', async () => {
    for (const name of ['../x', 'a/b', 'Upper', 'a.b', 'x'.repeat(41), '']) {
      const q = `file=${encodeURIComponent(name)}`
      const get = await fetch(`${base}/api/decor?${q}`)
      // '' means "no file" → the default decor.json, which is fine.
      if (name === '') continue
      expect(get.status, name).toBeGreaterThanOrEqual(400)
      const put = await fetch(`${base}/api/decor?${q}`, { method: 'PUT', body: JSON.stringify(doc) })
      expect(put.status, name).toBeGreaterThanOrEqual(400)
    }
    const files = await fs.readdir(path.join(root, 'data')).catch(() => [])
    expect(files).toEqual([])
  })

  it('rejects bodies without an items array', async () => {
    const res = await fetch(`${base}/api/decor?file=unit`, { method: 'PUT', body: JSON.stringify({ version: 1 }) })
    expect(res.status).toBe(400)
    await expect(fs.access(path.join(root, 'data', 'decor.unit.json'))).rejects.toThrow()
  })

  it('rejects malformed JSON without writing', async () => {
    const res = await fetch(`${base}/api/decor?file=unit`, { method: 'PUT', body: '{nope' })
    expect(res.status).toBeGreaterThanOrEqual(400)
    await expect(fs.access(path.join(root, 'data', 'decor.unit.json'))).rejects.toThrow()
  })
})

describe('file watching', () => {
  it('watches the decor files', () => {
    expect(watched).toContain(path.join(root, 'data', 'decor*.json'))
  })

  it('tells open tabs which decor file changed', () => {
    onChange!(path.join(root, 'data', 'decor.json'))
    onChange!(path.join(root, 'data', 'decor.e2e.json'))
    onChange!(path.join(root, 'data', 'other.json'))
    onChange!(path.join(root, 'src', 'decor.json'))
    expect(wsSent).toEqual([
      { type: 'custom', event: 'decor:changed', data: { file: null } },
      { type: 'custom', event: 'layouts:changed', data: {} },
      { type: 'custom', event: 'decor:changed', data: { file: 'e2e' } },
      { type: 'custom', event: 'layouts:changed', data: {} },
    ])
  })
})
