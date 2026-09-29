import { create } from 'zustand'
import { flushSave, serialize, useDecor } from './store'

// Client side of the layouts API (server/layouts.ts): the list for the menu
// and the actions on it. Switching itself lives in the decor store.

export interface LayoutInfo {
  slug: string | null
  name: string
  items: number
  updated: string
}

export const MAIN_NAME = 'Current'

interface LayoutsState {
  list: LayoutInfo[]
  error: string | null
  refresh: () => Promise<void>
  /** Saves the editor's current state as a new layout and switches to it. */
  saveAs: (name: string) => Promise<void>
  rename: (slug: string | null, name: string) => Promise<void>
  remove: (slug: string | null) => Promise<void>
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body
}

const q = (slug: string | null) => (slug ? `?file=${encodeURIComponent(slug)}` : '')
const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

export const useLayouts = create<LayoutsState>((set, get) => ({
  list: [],
  error: null,
  refresh: async () => {
    try {
      set({ list: await call<LayoutInfo[]>('/api/layouts'), error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },
  saveAs: async (name) => {
    const d = useDecor.getState()
    await flushSave()
    try {
      const items = d.items.filter((i) => !(d.isDraft && i.id === d.movingId))
      const data = JSON.parse(serialize(items, d.finishes))
      const { slug } = await call<{ slug: string }>('/api/layouts', { method: 'POST', ...json({ name, data }) })
      await useDecor.getState().switchLayout(slug)
      await get().refresh()
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },
  rename: async (slug, name) => {
    const d = useDecor.getState()
    if (slug === d.layout) await flushSave()
    try {
      const out = await call<{ slug: string | null; name: string }>(`/api/layouts${q(slug)}`, { method: 'PATCH', ...json({ name }) })
      if (slug === useDecor.getState().layout) useDecor.getState().renamed(out.slug, out.name)
      if (slug === useDecor.getState().compareWith) useDecor.getState().setCompareWith(out.slug)
      await get().refresh()
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },
  remove: async (slug) => {
    try {
      const d = useDecor.getState()
      if (slug === d.layout) {
        // Leave it first so no pending save writes it back.
        await d.switchLayout(null)
      }
      await call(`/api/layouts${q(slug)}`, { method: 'DELETE' })
      if (useDecor.getState().compareWith === slug) useDecor.getState().setCompareWith(undefined)
      await get().refresh()
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },
}))

// Another tab (or Claude) added, removed or wrote a layout: keep the list fresh.
if (import.meta.hot) {
  import.meta.hot.on('layouts:changed', () => void useLayouts.getState().refresh())
}
