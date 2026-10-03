import type { DecorFile } from '../model/decor'

// The client of the dev API (server/studioApi.ts, docs/adr/0001). The only
// module that knows the routes: a hosted backend answering the same contract
// replaces the dev server without changes elsewhere.

export interface LibraryImage {
  name: string
  url: string
}

export interface LayoutInfo {
  /** null for the default plan's main layout (data/decor.json). */
  slug: string | null
  name: string
  items: number
  /** ISO time of the last write. */
  updated: string
  /** The plan it furnishes. */
  plan: string
}

/** A request the server answered with an error, or did not answer. */
export class ApiError extends Error {}

/** Reading a layout file: its exact text (to recognize this tab's own writes) and its data. */
export type LayoutRead =
  | { ok: true; text: string; file: DecorFile }
  /** No dev API: a static build answers with its index.html, or not at all. */
  | { ok: false; reason: 'no-api' }
  /** The file is not a layout (a hand edit half done). */
  | { ok: false; reason: 'broken-file' }

const fileQuery = (slug: string | null) => (slug ? `?file=${encodeURIComponent(slug)}` : '')
const json = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
})

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('The dev server is not answering')
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`)
  return body
}

export async function readLayout(slug: string | null): Promise<LayoutRead> {
  let res: Response
  try {
    res = await fetch(`/api/decor${fileQuery(slug)}`)
  } catch {
    return { ok: false, reason: 'no-api' }
  }
  if (!res.ok || /html/.test(res.headers.get('Content-Type') ?? '')) return { ok: false, reason: 'no-api' }
  const text = await res.text()
  try {
    const file = JSON.parse(text) as DecorFile
    if (!file || typeof file !== 'object' || !Array.isArray(file.items ?? []))
      return { ok: false, reason: 'broken-file' }
    return { ok: true, text, file }
  } catch {
    return { ok: false, reason: 'broken-file' }
  }
}

/** The layout file's text as it is on disk, or null when it cannot be read. */
export async function readLayoutText(slug: string | null): Promise<string | null> {
  return fetch(`/api/decor${fileQuery(slug)}`)
    .then((r) => r.text())
    .catch(() => null)
}

/** Writes a serialized layout. Failures are dropped: the next change saves again. */
export async function writeLayout(slug: string | null, body: string): Promise<void> {
  await fetch(`/api/decor${fileQuery(slug)}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {})
}

export const listLayouts = () => call<LayoutInfo[]>('/api/layouts')

/** Saves `data` as a new layout named `name`; returns the slug the server picked. */
export const createLayout = (name: string, data: unknown) =>
  call<{ slug: string; name: string }>('/api/layouts', { method: 'POST', ...json({ name, data }) })

/** Renames a layout; a named one may move to a new slug. */
export const renameLayout = (slug: string | null, name: string) =>
  call<{ slug: string | null; name: string }>(`/api/layouts${fileQuery(slug)}`, { method: 'PATCH', ...json({ name }) })

export const deleteLayout = (slug: string | null) =>
  call<unknown>(`/api/layouts${fileQuery(slug)}`, { method: 'DELETE' })

export async function listArtwork(): Promise<LibraryImage[] | null> {
  try {
    const res = await fetch('/api/artwork')
    return res.ok ? ((await res.json()) as LibraryImage[]) : null
  } catch {
    return null
  }
}

export const uploadArtwork = (file: File) =>
  call<LibraryImage>(`/api/artwork?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file })

/** Where the page loads a picture from: local paths as they are, other links through the dev server (no CORS). */
export function screenImageSrc(link: string): string | null {
  const s = link.trim()
  if (!s) return null
  if (s.startsWith('/')) return s
  if (/^https?:\/\//i.test(s)) return `/api/image?url=${encodeURIComponent(s)}`
  return null
}
