import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  isHiddenSlug,
  isMainSlug,
  isPlanMainSlug,
  LAYOUT_SLUG,
  type LayoutInfo,
  layoutFileName,
  MAIN_NAME,
  slugify,
  slugOfFileName,
} from '../src/model/layoutNames.ts'

// Layout variants on disk, in the workspace's layouts/ folder: decor.json is the
// default plan's main layout ("Current"), decor.<slug>.json are the others. A file may carry its display name
// ({ version, name, finishes, items }); the slug is the file identity.

export class LayoutError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function assertSlug(slug: string) {
  if (!LAYOUT_SLUG.test(slug)) throw new LayoutError('Bad layout name')
}

export const layoutFile = (dataDir: string, slug: string | null) => path.join(dataDir, layoutFileName(slug))

const cleanName = (name: unknown) => {
  if (typeof name !== 'string' || !name.trim()) throw new LayoutError('A layout needs a name')
  return name.trim().replace(/\s+/g, ' ').slice(0, 60)
}

async function exists(file: string) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'))
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

const write = (file: string, data: unknown) => fs.writeFile(file, JSON.stringify(data, null, 2) + '\n')

/** A slug that is free: the wanted one, or wanted-2, wanted-3… */
async function freeSlug(dataDir: string, wanted: string) {
  const cut = (s: string) => s.slice(0, 36).replace(/-+$/, '')
  // plan-<id> is the main layout of plan <id>: "Plan B" (or a second "Plan") must not take one.
  const base = isPlanMainSlug(wanted) ? cut(`layout-${wanted}`) : cut(wanted) || 'layout'
  if (!(await exists(layoutFile(dataDir, base)))) return base
  const stem = isPlanMainSlug(`${base}-2`) ? `layout-${base}` : base
  for (let i = 2; ; i++) {
    const slug = `${stem}-${i}`
    if (!(await exists(layoutFile(dataDir, slug)))) return slug
  }
}

/** Every layout: the main one first, then named ones by name. Test files are left out unless `all`. */
export async function listLayouts(dataDir: string, defaultPlan: string, all = false): Promise<LayoutInfo[]> {
  await fs.mkdir(dataDir, { recursive: true })
  const files = await fs.readdir(dataDir)
  const out: LayoutInfo[] = []
  for (const f of files) {
    const slug = slugOfFileName(f)
    if (slug === undefined) continue
    if (slug && !all && isHiddenSlug(slug)) continue
    const file = path.join(dataDir, f)
    const [data, stat] = await Promise.all([readJson(file), fs.stat(file)])
    out.push({
      slug,
      name: typeof data.name === 'string' && data.name ? data.name : isMainSlug(slug) ? MAIN_NAME : slug!,
      items: Array.isArray(data.items) ? data.items.length : 0,
      updated: stat.mtime.toISOString(),
      plan: typeof data.plan === 'string' && data.plan ? data.plan : defaultPlan,
    })
  }
  if (!out.some((l) => l.slug === null))
    out.push({ slug: null, name: MAIN_NAME, items: 0, updated: new Date(0).toISOString(), plan: defaultPlan })
  return out.sort((a, b) =>
    a.slug === null ? -1 : b.slug === null ? 1 : a.name.localeCompare(b.name, undefined, { numeric: true }),
  )
}

/**
 * Saves a new layout named `name`: a copy of `data` when given (the editor's
 * current state), else of the layout `from` (null = main).
 */
export async function createLayout(dataDir: string, body: { name?: unknown; from?: unknown; data?: unknown }) {
  const name = cleanName(body.name)
  let data: Record<string, unknown>
  if (body.data !== undefined) {
    data = body.data as Record<string, unknown>
    if (!data || typeof data !== 'object' || !Array.isArray(data.items)) throw new LayoutError('Expected { items: [] }')
  } else {
    const from = body.from ?? null
    if (from !== null) assertSlug(String(from))
    data = await readJson(layoutFile(dataDir, from as string | null))
    if (!Array.isArray(data.items)) data.items = []
  }
  await fs.mkdir(dataDir, { recursive: true })
  const slug = await freeSlug(dataDir, slugify(name))
  const { name: _old, ...rest } = data
  await write(layoutFile(dataDir, slug), { version: 1, name, ...rest })
  return { slug, name }
}

/**
 * Renames a layout. A named one also moves to the slug of its new name (when
 * that is free); a main layout (this plan's or another's) keeps its file and
 * only takes the name.
 */
export async function renameLayout(dataDir: string, slug: string | null, rawName: unknown) {
  const name = cleanName(rawName)
  if (slug !== null) assertSlug(slug)
  const file = layoutFile(dataDir, slug)
  if (!(await exists(file))) throw new LayoutError('No such layout', 404)
  const { name: _old, version: _v, ...rest } = await readJson(file)
  let next = slug
  if (!isMainSlug(slug)) {
    const wanted = slugify(name)
    if (wanted !== slug) next = await freeSlug(dataDir, wanted)
  }
  await write(layoutFile(dataDir, next), { version: 1, name, ...rest })
  if (next !== slug) await fs.rm(file)
  return { slug: next, name }
}

export async function deleteLayout(dataDir: string, slug: string | null) {
  if (slug === null || isPlanMainSlug(slug)) throw new LayoutError('The current layout cannot be deleted')
  assertSlug(slug)
  const file = layoutFile(dataDir, slug)
  if (!(await exists(file))) throw new LayoutError('No such layout', 404)
  await fs.rm(file)
}
