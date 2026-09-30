// @vitest-environment node
import { mkdtempSync, promises as fs, rmSync } from 'node:fs'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { slugify } from '../../server/layouts'
import { studioApi } from '../../server/studioApi'

// /api/layouts on a real http server over a temp project root.

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

let root: string
let base: string
let server: http.Server

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'layouts-api-'))
  let handler: Handler | undefined
  const fake = {
    config: { root },
    watcher: { add: () => {}, on: () => {} },
    ws: { send: () => {} },
    middlewares: { use: (fn: Handler) => (handler = fn) },
  }
  ;(studioApi().configureServer as (s: unknown) => void)(fake)
  server = http.createServer((req, res) => handler!(req, res, () => res.end()))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((r) => server.close(r))
  rmSync(root, { recursive: true, force: true })
})

const data = () => path.join(root, 'data')
const file = (slug: string | null) => path.join(data(), slug ? `decor.${slug}.json` : 'decor.json')
const read = async (slug: string | null) => JSON.parse(await fs.readFile(file(slug), 'utf8'))
const writeLayout = async (slug: string | null, body: unknown) => {
  await fs.mkdir(data(), { recursive: true })
  await fs.writeFile(file(slug), JSON.stringify(body))
}
const list = async (q = '') => (await (await fetch(`${base}/api/layouts${q}`)).json()) as { slug: string | null; name: string; items: number; updated: string; plan: string }[]
const post = (body: unknown) => fetch(`${base}/api/layouts`, { method: 'POST', body: JSON.stringify(body) })
const patch = (slug: string | null, body: unknown) => fetch(`${base}/api/layouts${slug ? `?file=${slug}` : ''}`, { method: 'PATCH', body: JSON.stringify(body) })
const del = (slug: string | null) => fetch(`${base}/api/layouts${slug ? `?file=${slug}` : ''}`, { method: 'DELETE' })

const plant = { kind: 'plant', id: 'p1', species: 'monstera', pot: 'ceramic', at: [4, 0, 1], rotation: 0, scale: 1 }

beforeEach(async () => {
  await fs.rm(data(), { recursive: true, force: true })
})

describe('slugify', () => {
  it('lowercases, strips accents and joins words with dashes', () => {
    expect(slugify('Sofá by the Window!')).toBe('sofa-by-the-window')
    expect(slugify('  --Desk  #2-- ')).toBe('desk-2')
  })
  it('never returns an empty or overlong slug', () => {
    expect(slugify('!!!')).toBe('layout')
    const long = slugify('a very long layout name that keeps going and going and going')
    expect(long.length).toBeLessThanOrEqual(40)
    expect(long).toMatch(/^[a-z0-9-]+$/)
    expect(long.endsWith('-')).toBe(false)
  })
})

describe('GET /api/layouts', () => {
  it('always lists the main layout, as Current, even without a file', async () => {
    expect(await list()).toEqual([{ slug: null, name: 'Current', items: 0, updated: new Date(0).toISOString(), plan: 'monoambiente' }])
  })

  it('says which plan each layout furnishes (the default plan when the file does not say)', async () => {
    await writeLayout(null, { version: 1, items: [plant] })
    await writeLayout('plan-loft', { version: 1, plan: 'loft', items: [] })
    const byslug = Object.fromEntries((await list()).map((l) => [String(l.slug), l.plan]))
    expect(byslug).toEqual({ null: 'monoambiente', 'plan-loft': 'loft' })
  })

  it('lists names, item counts and update times; main first, then by name; hides test files', async () => {
    await writeLayout(null, { version: 1, items: [plant, plant] })
    await writeLayout('b-side', { version: 1, name: 'Bed by the window', items: [plant] })
    await writeLayout('a-side', { version: 1, items: [] })
    await writeLayout('e2e-smoke', { version: 1, items: [] })
    await writeLayout('test-x', { version: 1, items: [] })
    await fs.writeFile(path.join(data(), 'notes.json'), '{}')
    const l = await list()
    expect(l.map((x) => [x.slug, x.name, x.items])).toEqual([
      [null, 'Current', 2],
      ['a-side', 'a-side', 0],
      ['b-side', 'Bed by the window', 1],
    ])
    expect(Number.isNaN(Date.parse(l[1].updated))).toBe(false)
    expect((await list('?all=1')).map((x) => x.slug)).toContain('e2e-smoke')
  })
})

describe('POST /api/layouts', () => {
  it('saves the posted state under a slug made from the name', async () => {
    const res = await post({ name: 'Desk by the window', data: { version: 1, finishes: { wallPaint: '#dfe3d6' }, items: [plant] } })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ slug: 'desk-by-the-window', name: 'Desk by the window' })
    expect(await read('desk-by-the-window')).toEqual({ version: 1, name: 'Desk by the window', finishes: { wallPaint: '#dfe3d6' }, items: [plant] })
  })

  it('duplicates another layout with `from`, and never overwrites: -2, -3…', async () => {
    await writeLayout(null, { version: 1, name: 'Main', items: [plant] })
    const a = await (await post({ name: 'Copy', from: null })).json()
    const b = await (await post({ name: 'Copy', from: null })).json()
    expect([a.slug, b.slug]).toEqual(['copy', 'copy-2'])
    expect(await read('copy-2')).toEqual({ version: 1, name: 'Copy', items: [plant] })
  })

  it('rejects a missing name, a bad source slug and bodies without items', async () => {
    expect((await post({ name: '  ', data: { items: [] } })).status).toBe(400)
    expect((await post({ name: 'x', from: '../etc' })).status).toBe(400)
    expect((await post({ name: 'x', data: { version: 1 } })).status).toBe(400)
    expect((await post('{nope' as unknown as object)).status).toBe(400)
    // Nothing was written (the data folder may not even exist yet).
    expect(await fs.readdir(data()).catch(() => [])).toEqual([])
  })
})

describe('PATCH /api/layouts', () => {
  it('renames a layout and moves it to the new slug, keeping its content', async () => {
    await writeLayout('old', { version: 1, name: 'Old', finishes: { hexBlend: true }, items: [plant] })
    const res = await patch('old', { name: 'New plan' })
    expect(await res.json()).toEqual({ slug: 'new-plan', name: 'New plan' })
    expect(await read('new-plan')).toEqual({ version: 1, name: 'New plan', finishes: { hexBlend: true }, items: [plant] })
    await expect(fs.access(file('old'))).rejects.toThrow()
  })

  it('keeps the slug when only the case changes, and picks a free one when taken', async () => {
    await writeLayout('plan', { version: 1, name: 'plan', items: [] })
    await writeLayout('other', { version: 1, items: [] })
    expect(await (await patch('plan', { name: 'Plan' })).json()).toEqual({ slug: 'plan', name: 'Plan' })
    expect(await (await patch('other', { name: 'Plan' })).json()).toEqual({ slug: 'plan-2', name: 'Plan' })
  })

  it('renames the main layout in place', async () => {
    await writeLayout(null, { version: 1, items: [plant] })
    expect(await (await patch(null, { name: 'As built' })).json()).toEqual({ slug: null, name: 'As built' })
    expect(await read(null)).toEqual({ version: 1, name: 'As built', items: [plant] })
  })

  it('validates slugs and names, and 404s unknown layouts', async () => {
    expect((await patch('Bad Slug', { name: 'x' })).status).toBe(400)
    expect((await patch('..%2Fx', { name: 'x' })).status).toBe(400)
    expect((await patch('missing', { name: 'x' })).status).toBe(404)
    await writeLayout('ok', { version: 1, items: [] })
    expect((await patch('ok', { name: '' })).status).toBe(400)
  })
})

describe('DELETE /api/layouts', () => {
  it('deletes a named layout', async () => {
    await writeLayout('gone', { version: 1, items: [] })
    expect((await del('gone')).status).toBe(200)
    await expect(fs.access(file('gone'))).rejects.toThrow()
  })

  it('refuses the main layout, bad slugs and unknown ones', async () => {
    await writeLayout(null, { version: 1, items: [plant] })
    expect((await del(null)).status).toBe(400)
    expect((await del('UP')).status).toBe(400)
    expect((await del('nope')).status).toBe(404)
    expect((await read(null)).items).toHaveLength(1)
  })
})
