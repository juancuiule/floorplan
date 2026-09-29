import { create } from 'zustand'
import type { DecorFile, DecorItem, DecorKind } from '../model/decor'
import type { Vec3 } from '../model/types'
import { editRefs } from './edit'
import { isFloorPiece, mountOf, placeAt } from './placement'

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
  /** Patches an item. Repeated patches of the same fields in quick succession (a slider scrub) are one undo step. */
  update: <T extends DecorItem>(id: string, patch: Partial<T>) => void
  remove: (id: string) => void
  /** Places a copy that follows the pointer until the next click. */
  duplicate: (id: string) => void
  /** Moves an item by a plan offset in meters; a burst of nudges is one undo step. */
  nudge: (id: string, delta: Vec3) => void
  /** Turns an item around y by `deg` (one undo step each). */
  rotateBy: (id: string, deg: number) => void
  copy: (id: string) => void
  /** Places a copy of the copied item, following the pointer. */
  paste: () => void
  hasClipboard: boolean
  /** Groups every change until endGesture into one undo step (a drag, a rotate-handle turn). */
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
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
  hasClipboard: false,
  canUndo: false,
  canRedo: false,

  load: async () => {
    try {
      const res = await fetch(decorUrl)
      const data = (await res.json()) as DecorFile
      const items = data.items ?? []
      lastSaved = serialize(items)
      // Keep the item under the pointer when the file is reloaded mid-placement.
      const { movingId, isDraft } = get()
      const moving = isDraft ? get().items.find((i) => i.id === movingId) : undefined
      applying = true
      set({ items: moving ? [...items.filter((i) => i.id !== moving.id), moving] : items, loaded: true })
      applying = false
      // A file loaded from disk starts a fresh history: undo never reverts someone else's edit.
      past.length = 0
      future.length = 0
      syncFlags()
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
  startDragging: (id) => {
    // Keep the item itself (not a copy) so Esc can put back exactly what was there.
    const item = get().items.find((i) => i.id === id) ?? null
    get().beginGesture()
    set({ movingId: id, isDraft: false, backup: item, selectedId: id })
  },
  startRelocating: (id) => {
    get().cancelPlacing()
    const item = get().items.find((i) => i.id === id)
    if (item) set({ movingId: id, isDraft: true, backup: structuredClone(item), selectedId: id })
  },
  stopMoving: () => {
    set({ movingId: null, isDraft: false, backup: null })
    get().endGesture()
  },
  cancelPlacing: () => {
    const { movingId, backup } = get()
    if (movingId) {
      // A draft (new item or relocation) or a drag: put back what was there, or drop the new item.
      if (backup) set((s) => ({ items: s.items.map((i) => (i.id === movingId ? backup : i)), movingId: null, isDraft: false, backup: null }))
      else if (get().isDraft) set((s) => ({ items: s.items.filter((i) => i.id !== movingId), selectedId: null, movingId: null, isDraft: false, backup: null }))
    }
    set({ movingId: null, isDraft: false, backup: null })
    get().endGesture()
  },

  update: (id, patch) => {
    pendingKey = `update:${id}:${Object.keys(patch).sort().join(',')}`
    set((s) => ({ items: s.items.map((i) => (i.id === id ? ({ ...i, ...patch } as DecorItem) : i)) }))
  },
  remove: (id) => {
    if (get().movingId === id) get().cancelPlacing()
    set((s) => ({ items: s.items.filter((i) => i.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }))
  },
  duplicate: (id) => {
    const src = get().items.find((i) => i.id === id)
    if (src) placeCopy(src)
  },
  nudge: (id, [dx, dy, dz]) => {
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    const r = (v: number) => Math.round(v * 1000) / 1000
    const at: Vec3 = [r(item.at[0] + dx), r(Math.max(0, item.at[1] + dy)), r(item.at[2] + dz)]
    pendingKey = `nudge:${id}`
    set((s) => ({ items: s.items.map((i) => (i.id === id ? ({ ...i, at } as DecorItem) : i)) }))
  },
  rotateBy: (id, deg) => {
    const item = get().items.find((i) => i.id === id)
    if (!item || !('rotation' in item) || mountOf(item) === 'wall') return
    const rotation = (((item.rotation + deg) % 360) + 360) % 360
    pendingKey = null
    set((s) => ({ items: s.items.map((i) => (i.id === id ? ({ ...i, rotation } as DecorItem) : i)) }))
  },
  copy: (id) => {
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    clipboard = structuredClone(item)
    set({ hasClipboard: true })
  },
  paste: () => {
    if (clipboard) placeCopy(clipboard)
  },
  beginGesture: () => {
    gestureKey = `g:${++gestureN}`
  },
  endGesture: () => {
    gestureKey = null
  },
  undo: () => {
    if (get().movingId) get().cancelPlacing()
    const e = past.pop()
    if (!e) return
    future.push(e)
    applyItems(e.before, e.after)
  },
  redo: () => {
    if (get().movingId) get().cancelPlacing()
    const e = future.pop()
    if (!e) return
    past.push(e)
    applyItems(e.after, e.before)
  },
  select: (id) => set({ selectedId: id }),
  setTab: (tab) => set({ tab }),
}))

// ---------- copy / duplicate ----------

let clipboard: DecorItem | null = null

/** Starts placing a copy of `src`, under the pointer when it is over the scene. */
function placeCopy(src: DecorItem) {
  const copy = { ...structuredClone(src), id: newId(src.kind) } as DecorItem
  // Plants lay out their leaves from the seed (the id by default): keep the copy identical.
  if (copy.kind === 'plant' && src.kind === 'plant') copy.seed = src.seed ?? src.id
  const hit = editRefs.pointerInCanvas ? (isFloorPiece(src) ? editRefs.lastFloorHit : editRefs.lastHit) : null
  const patch = hit && placeAt(copy, hit)
  useDecor.getState().startPlacing(patch ? ({ ...copy, ...patch } as DecorItem) : copy)
}

// ---------- undo / redo ----------
//
// History records the committed layout: what is saved to disk. A draft still
// following the pointer is not part of it, so placing, relocating and pasting
// only record the final drop. Each entry keeps the whole items array before and
// after the change; unchanged items are shared, so entries are cheap.

interface Entry {
  before: DecorItem[]
  after: DecorItem[]
  /** Changes with the same key merge into one entry (a drag gesture, a slider scrub). */
  key: string | null
  t: number
}

const HISTORY_LIMIT = 200
/** Same-field edits closer together than this merge into one step. */
const MERGE_MS = 1000
const past: Entry[] = []
const future: Entry[] = []
let committed: DecorItem[] = []
let applying = false
let gestureKey: string | null = null
let gestureN = 0
/** Set by an action right before its set() so the change can be merged with similar ones. */
let pendingKey: string | null = null

/** What is saved: a new item still following the pointer is left out; a relocated one keeps its old spot. */
function committedOf(s: DecorState): DecorItem[] {
  return s.isDraft ? s.items.flatMap((i) => (i.id !== s.movingId ? [i] : s.backup ? [s.backup] : [])) : s.items
}

const sameItems = (a: DecorItem[], b: DecorItem[]) => a.length === b.length && a.every((x, i) => x === b[i])

function syncFlags() {
  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const s = useDecor.getState()
  if (s.canUndo !== canUndo || s.canRedo !== canRedo) useDecor.setState({ canUndo, canRedo })
}

/** Restores a snapshot, selecting the item the step touched. */
function applyItems(target: DecorItem[], from: DecorItem[]) {
  const fromById = new Map(from.map((i) => [i.id, i]))
  const changed = target.filter((i) => fromById.get(i.id) !== i).map((i) => i.id)
  const { selectedId } = useDecor.getState()
  const stillThere = selectedId && target.some((i) => i.id === selectedId)
  applying = true
  useDecor.setState({ items: target, selectedId: changed.length ? changed[changed.length - 1] : stillThere ? selectedId : null })
  applying = false
  syncFlags()
}

useDecor.subscribe((s) => {
  const key = gestureKey ?? pendingKey
  pendingKey = null
  if (!s.loaded) return
  const next = committedOf(s)
  if (sameItems(next, committed)) return
  const prev = committed
  committed = next
  if (applying) return
  const now = performance.now()
  const top = past[past.length - 1]
  if (top && key && top.key === key && (key.startsWith('g:') || now - top.t < MERGE_MS)) {
    top.after = next
    top.t = now
    // A drag that ended where it started (or was cancelled with Esc) is no step at all.
    if (sameItems(top.before, next)) past.pop()
  } else {
    past.push({ before: prev, after: next, key, t: now })
    if (past.length > HISTORY_LIMIT) past.shift()
  }
  future.length = 0
  syncFlags()
})

// Persist placed items (not the one still following the pointer) back to data/decor.json.
let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastSaved = ''
let lastItems: DecorItem[] | null = null
/** Bodies this tab wrote recently: their file-change echoes must not trigger a reload. */
const written: string[] = []
const serialize = (items: DecorItem[]) => JSON.stringify({ version: 1, items } satisfies DecorFile, null, 2) + '\n'
useDecor.subscribe((s) => {
  if (!s.loaded || s.error?.startsWith('Saving')) return
  const items = committedOf(s)
  if (items === lastItems) return
  lastItems = items
  const body = serialize(items)
  clearTimeout(saveTimer)
  // Back to what is on disk (a cancelled drag, an undo): drop the pending save too.
  if (body === lastSaved) return
  saveTimer = setTimeout(() => {
    lastSaved = body
    written.push(body)
    if (written.length > 8) written.shift()
    fetch(decorUrl, { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
  }, 400)
})

// Someone (another tab, an editor, Claude) changed the file on disk: reload it
// unless it is what this tab just wrote.
if (import.meta.hot) {
  import.meta.hot.on('decor:changed', async (data: { file: string | null }) => {
    if ((data.file ?? null) !== (decorFile ?? null)) return
    const text = await fetch(decorUrl).then((r) => r.text()).catch(() => null)
    if (text === null || text === lastSaved || written.includes(text)) return
    clearTimeout(saveTimer)
    await useDecor.getState().load()
  })
}
