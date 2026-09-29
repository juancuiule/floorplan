import { create } from 'zustand'
import type { DecorFile, DecorItem, DecorKind } from '../model/decor'

export interface LibraryImage {
  name: string
  url: string
}

export type PanelTab = 'furniture' | 'artwork' | 'plants' | 'lights'

interface DecorState {
  items: DecorItem[]
  loaded: boolean
  selectedId: string | null
  /** Item following the pointer: a new draft being placed, or an existing one being dragged. */
  movingId: string | null
  /** True while movingId is a new item that has not been dropped yet. */
  isDraft: boolean
  /** Original state of an existing item being re-placed, restored on cancel. */
  backup: DecorItem | null
  library: LibraryImage[]
  tab: PanelTab
  error: string | null

  load: () => Promise<void>
  refreshLibrary: () => Promise<void>
  upload: (file: File) => Promise<LibraryImage | null>
  /** Adds a new item that follows the pointer until the next click. */
  startPlacing: (item: DecorItem) => void
  startDragging: (id: string) => void
  /** Re-place an existing item with the next click, like a new one. */
  startRelocating: (id: string) => void
  stopMoving: () => void
  cancelPlacing: () => void
  update: <T extends DecorItem>(id: string, patch: Partial<T>) => void
  remove: (id: string) => void
  duplicate: (id: string) => void
  select: (id: string | null) => void
  setTab: (tab: PanelTab) => void
}

/** Which decor file this tab edits: data/decor.json, or data/decor.<name>.json with ?decor=<name>. */
const decorFile = new URLSearchParams(window.location.search).get('decor')
const decorUrl = `/api/decor${decorFile ? `?file=${encodeURIComponent(decorFile)}` : ''}`

export const newId = (kind: DecorKind) => `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const useDecor = create<DecorState>((set, get) => ({
  items: [],
  loaded: false,
  selectedId: null,
  movingId: null,
  isDraft: false,
  backup: null,
  library: [],
  tab: 'artwork',
  error: null,

  load: async () => {
    try {
      const res = await fetch(decorUrl)
      const data = (await res.json()) as DecorFile
      const items = data.items ?? []
      lastSaved = serialize(items)
      // Keep the item under the pointer when the file is reloaded mid-placement.
      const { movingId, isDraft } = get()
      const moving = isDraft ? get().items.find((i) => i.id === movingId) : undefined
      set({ items: moving ? [...items.filter((i) => i.id !== moving.id), moving] : items, loaded: true })
    } catch {
      // No dev API (e.g. a static build): start empty and do not persist.
      set({ loaded: true, error: 'Saving is only available while running the dev server.' })
    }
  },

  refreshLibrary: async () => {
    try {
      const res = await fetch('/api/artwork')
      if (res.ok) set({ library: (await res.json()) as LibraryImage[] })
    } catch {
      /* leave library as is */
    }
  },

  upload: async (file) => {
    const res = await fetch(`/api/artwork?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file })
    if (!res.ok) {
      set({ error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Upload failed' })
      return null
    }
    const img = (await res.json()) as LibraryImage
    set((s) => ({ library: [...s.library.filter((x) => x.name !== img.name), img], error: null }))
    return img
  },

  startPlacing: (item) => {
    get().cancelPlacing()
    set((s) => ({ items: [...s.items, item], movingId: item.id, isDraft: true, backup: null, selectedId: item.id }))
  },
  startDragging: (id) => set({ movingId: id, isDraft: false, backup: null, selectedId: id }),
  startRelocating: (id) => {
    get().cancelPlacing()
    const item = get().items.find((i) => i.id === id)
    if (item) set({ movingId: id, isDraft: true, backup: structuredClone(item), selectedId: id })
  },
  stopMoving: () => set({ movingId: null, isDraft: false, backup: null }),
  cancelPlacing: () => {
    const { movingId, isDraft, backup } = get()
    if (isDraft && movingId) {
      if (backup) set((s) => ({ items: s.items.map((i) => (i.id === movingId ? backup : i)) }))
      else set((s) => ({ items: s.items.filter((i) => i.id !== movingId), selectedId: null }))
    }
    set({ movingId: null, isDraft: false, backup: null })
  },

  update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? ({ ...i, ...patch } as DecorItem) : i)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
  duplicate: (id) => {
    const src = get().items.find((i) => i.id === id)
    if (!src) return
    get().startPlacing({ ...structuredClone(src), id: newId(src.kind) })
  },
  select: (id) => set({ selectedId: id }),
  setTab: (tab) => set({ tab }),
}))

// Persist placed items (not the one still following the pointer) back to data/decor.json.
let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastSaved = ''
const serialize = (items: DecorItem[]) => JSON.stringify({ version: 1, items } satisfies DecorFile, null, 2) + '\n'
useDecor.subscribe((s) => {
  if (!s.loaded || s.error?.startsWith('Saving')) return
  // A new item still following the pointer is not saved; a relocated one saves its old spot.
  const items = s.isDraft ? s.items.flatMap((i) => (i.id !== s.movingId ? [i] : s.backup ? [s.backup] : [])) : s.items
  const body = serialize(items)
  if (body === lastSaved) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    lastSaved = body
    fetch(decorUrl, { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
  }, 400)
})

// Someone (another tab, an editor, Claude) changed the file on disk: reload it
// unless it is what this tab just wrote.
if (import.meta.hot) {
  import.meta.hot.on('decor:changed', async (data: { file: string | null }) => {
    if ((data.file ?? null) !== (decorFile ?? null)) return
    const text = await fetch(decorUrl).then((r) => r.text()).catch(() => null)
    if (text === null || text === lastSaved) return
    clearTimeout(saveTimer)
    await useDecor.getState().load()
  })
}
