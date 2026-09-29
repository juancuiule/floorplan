import { create } from 'zustand'
import type { DecorFile, DecorItem, DecorKind } from '../model/decor'
import { DEFAULT_FINISHES, isDefaultFinishes, normalizeFinishes, type Finishes } from '../model/finishes'
import type { Vec3 } from '../model/types'
import { copyOffset, followLead, rotateAround, sameWall, type Patches } from './arrange'
import { editRefs } from './edit'
import { isWallItem, translated } from './extent'
import { isFloorPiece, mountOf, placeAt } from './placement'

export interface LibraryImage {
  name: string
  url: string
}

export type PanelTab = 'furniture' | 'artwork' | 'plants' | 'lights' | 'room'

interface DecorState {
  items: DecorItem[]
  loaded: boolean
  /** The primary selected item: the one last clicked, shown in the inspector. */
  selectedId: string | null
  /** Every selected item (includes selectedId); more than one is a multi-selection. */
  selectedIds: string[]
  /** Names given to groups, by groupId (saved in the layout file, not part of undo). */
  groupNames: Record<string, string>
  /** Originals of the other selected items that move along with movingId in a drag. */
  followers: DecorItem[]
  /** Item following the pointer: a new draft being placed, or an existing one being dragged. */
  movingId: string | null
  /** True while movingId is a new item that has not been dropped yet. */
  isDraft: boolean
  /** Original state of an existing item being re-placed, restored on cancel. */
  backup: DecorItem | null
  library: LibraryImage[]
  tab: PanelTab
  error: string | null
  /** Floors, paint and tiles of this layout (saved in its file, not part of undo). */
  finishes: Finishes
  /** The layout being edited: null for data/decor.json, else the <slug> of data/decor.<slug>.json. */
  layout: string | null
  /** Display name stored in the file ('' when it has none). */
  layoutName: string
  /** The other side of the A/B compare toggle (undefined: nothing to compare with). */
  compareWith: string | null | undefined

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
  /** Selects these items; `primary` (default: the last) is the one the inspector follows. */
  selectMany: (ids: string[], primary?: string | null) => void
  /** Shift+click: adds or removes an item (its whole group unless `single`). */
  toggleSelect: (id: string, opts?: { single?: boolean }) => void
  /** Click: selects an item's whole group (unless `single`), or keeps a multi-selection it is part of. */
  pick: (id: string, opts?: { single?: boolean }) => void
  /** Cmd+A: everything on the selected item's wall, or everything of its kind (or of `kind`). */
  selectAllLike: (kind?: DecorKind) => void
  /** Patches several items at once (one undo step, or part of the current gesture). */
  applyPatches: (patches: Patches, key?: string | null) => void
  removeMany: (ids: string[]) => void
  /** Duplicates the selection: one item follows the pointer; several are placed next to their originals. */
  duplicateSelection: () => void
  /** Moves each item by its own offset; a burst of nudges is one undo step. */
  nudgeMany: (deltas: Record<string, Vec3>) => void
  /** Turns the selection's floor and surface pieces together about their center. */
  rotateSelection: (deg: number) => void
  /** Groups the selection (Cmd+G), ungroups it (Shift+Cmd+G). */
  group: () => void
  ungroup: () => void
  renameGroup: (groupId: string, name: string) => void
  setTab: (tab: PanelTab) => void
  setFinishes: (patch: Partial<Finishes>) => void
  /** Saves what is pending, then loads another layout (fresh undo history). The URL follows. */
  switchLayout: (slug: string | null) => Promise<void>
  /** Flips between this layout and compareWith. */
  toggleCompare: () => Promise<void>
  setCompareWith: (slug: string | null | undefined) => void
  /** After a rename on the server: the new slug and name of the open layout. */
  renamed: (slug: string | null, name: string) => void
}

/** Which decor file this tab edits: data/decor.json, or data/decor.<name>.json with ?decor=<name>. */
let decorFile = new URLSearchParams(window.location.search).get('decor')
const decorUrl = () => `/api/decor${decorFile ? `?file=${encodeURIComponent(decorFile)}` : ''}`

/** Keeps ?decor= in the address bar in step with the open layout, without a reload. */
function syncUrl() {
  const url = new URL(window.location.href)
  if (decorFile) url.searchParams.set('decor', decorFile)
  else url.searchParams.delete('decor')
  window.history.replaceState(window.history.state, '', url)
}

export const newId = (kind: DecorKind) => `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const useDecor = create<DecorState>((set, get) => ({
  items: [],
  loaded: false,
  selectedId: null,
  selectedIds: [],
  groupNames: {},
  followers: [],
  movingId: null,
  isDraft: false,
  backup: null,
  library: [],
  tab: 'artwork',
  error: null,
  finishes: DEFAULT_FINISHES,
  layout: decorFile,
  layoutName: '',
  compareWith: undefined,
  hasClipboard: false,
  canUndo: false,
  canRedo: false,

  load: async () => {
    try {
      const file = decorFile
      const res = await fetch(decorUrl())
      const data = (await res.json()) as DecorFile
      // Switched again while this was loading: the newer load wins.
      if (file !== decorFile) return
      const items = data.items ?? []
      const finishes = normalizeFinishes(data.finishes)
      const layoutName = typeof data.name === 'string' ? data.name : ''
      const groupNames = namesOf(data.groups)
      lastSaved = serialize(items, finishes, layoutName, groupNames)
      lastGroups = groupNames
      lastFinishes = finishes
      lastName = layoutName
      // Keep the item under the pointer when the file is reloaded mid-placement.
      const { movingId, isDraft } = get()
      const moving = isDraft ? get().items.find((i) => i.id === movingId) : undefined
      applying = true
      const next = moving ? [...items.filter((i) => i.id !== moving.id), moving] : items
      const ids = new Set(next.map((i) => i.id))
      const { selectedId: prevId, selectedIds: prevIds } = get()
      const selectedIds = prevIds.filter((id) => ids.has(id))
      const selectedId = prevId && ids.has(prevId) ? prevId : (selectedIds.at(-1) ?? null)
      set({ items: next, loaded: true, finishes, layoutName, groupNames, layout: file, selectedIds, selectedId })
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
    set((s) => ({ items: [...s.items, item], movingId: item.id, isDraft: true, backup: null, selectedId: item.id, selectedIds: [item.id] }))
  },
  startDragging: (id) => {
    // Keep the item itself (not a copy) so Esc can put back exactly what was there.
    const s = get()
    const item = s.items.find((i) => i.id === id) ?? null
    const selectedIds = s.selectedIds.includes(id) ? s.selectedIds : [id]
    const followers = selectedIds.flatMap((x) => (x === id ? [] : s.items.filter((i) => i.id === x)))
    get().beginGesture()
    set({ movingId: id, isDraft: false, backup: item, selectedId: id, selectedIds, followers })
  },
  startRelocating: (id) => {
    get().cancelPlacing()
    const item = get().items.find((i) => i.id === id)
    if (item) set({ movingId: id, isDraft: true, backup: structuredClone(item), selectedId: id, selectedIds: [id] })
  },
  stopMoving: () => {
    set({ movingId: null, isDraft: false, backup: null, followers: [] })
    get().endGesture()
  },
  cancelPlacing: () => {
    const { movingId, backup, followers } = get()
    if (movingId) {
      // A draft (new item or relocation) or a drag: put back what was there, or drop the new item.
      const originals = new Map([...(backup ? [backup] : []), ...followers].map((i) => [i.id, i]))
      if (backup) set((s) => ({ items: s.items.map((i) => originals.get(i.id) ?? i), movingId: null, isDraft: false, backup: null }))
      else if (get().isDraft) set((s) => ({ items: s.items.filter((i) => i.id !== movingId), selectedId: null, selectedIds: [], movingId: null, isDraft: false, backup: null }))
    }
    set({ movingId: null, isDraft: false, backup: null, followers: [] })
    get().endGesture()
  },

  update: (id, patch) => {
    pendingKey = `update:${id}:${Object.keys(patch).sort().join(',')}`
    set((s) => ({ items: s.items.map((i) => (i.id === id ? ({ ...i, ...patch } as DecorItem) : i)) }))
  },
  remove: (id) => {
    if (get().movingId === id) get().cancelPlacing()
    get().removeMany([id])
  },
  duplicate: (id) => {
    const src = get().items.find((i) => i.id === id)
    if (src) placeCopy(cloneSet([src], get().items)[0])
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
    const s = get()
    const ids = s.selectedIds.includes(id) ? s.selectedIds : [id]
    const items = s.items.filter((i) => ids.includes(i.id))
    if (!items.length) return
    // Keeps the group ids of groups copied whole, so a pasted gallery is a group again.
    clipboard = cloneSet(items, s.items, false)
    set({ hasClipboard: true })
  },
  paste: () => {
    if (!clipboard?.length) return
    const copies = cloneSet(clipboard, clipboard)
    if (copies.length === 1) return placeCopy(copies[0])
    pasteSet(copies)
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
  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),
  selectMany: (ids, primary) => {
    const have = new Set(get().items.map((i) => i.id))
    const selectedIds = [...new Set(ids)].filter((id) => have.has(id))
    const selectedId = primary && selectedIds.includes(primary) ? primary : (selectedIds.at(-1) ?? null)
    set({ selectedIds, selectedId })
  },
  toggleSelect: (id, opts = {}) => {
    const s = get()
    const item = s.items.find((i) => i.id === id)
    if (!item) return
    const unit = !opts.single && item.groupId ? membersOf(s.items, item.groupId) : [id]
    if (unit.every((u) => s.selectedIds.includes(u))) {
      const rest = s.selectedIds.filter((x) => !unit.includes(x))
      get().selectMany(rest, s.selectedId && rest.includes(s.selectedId) ? s.selectedId : null)
    } else get().selectMany([...s.selectedIds, ...unit], id)
  },
  pick: (id, opts = {}) => {
    const s = get()
    const item = s.items.find((i) => i.id === id)
    if (!item) return
    if (opts.single) return get().selectMany([id], id)
    if (s.selectedIds.length > 1 && s.selectedIds.includes(id)) return set({ selectedId: id })
    get().selectMany(item.groupId ? membersOf(s.items, item.groupId) : [id], id)
  },
  selectAllLike: (kind) => {
    const s = get()
    const prim = s.items.find((i) => i.id === s.selectedId)
    const placed = s.items.filter((i) => i.at[1] > -50)
    let ids: string[]
    if (prim && isWallItem(prim)) ids = placed.filter((i) => i.id === prim.id || sameWall(i, prim)).map((i) => i.id)
    else if (prim) ids = placed.filter((i) => i.kind === prim.kind && !isWallItem(i)).map((i) => i.id)
    else ids = placed.filter((i) => i.kind === kind).map((i) => i.id)
    get().selectMany(ids, prim?.id ?? null)
  },
  applyPatches: (patches, key = null) => {
    if (!Object.keys(patches).length) return
    pendingKey = key
    set((s) => ({ items: s.items.map((i) => (patches[i.id] ? ({ ...i, ...patches[i.id] } as DecorItem) : i)) }))
  },
  removeMany: (ids) => {
    const s = get()
    if (s.movingId && ids.includes(s.movingId)) s.cancelPlacing()
    const gone = new Set(ids)
    set((st) => {
      const selectedIds = st.selectedIds.filter((x) => !gone.has(x))
      return {
        items: st.items.filter((i) => !gone.has(i.id)),
        selectedIds,
        selectedId: st.selectedId && !gone.has(st.selectedId) ? st.selectedId : (selectedIds.at(-1) ?? null),
      }
    })
  },
  duplicateSelection: () => {
    const s = get()
    const items = s.items.filter((i) => s.selectedIds.includes(i.id))
    if (items.length <= 1) {
      if (s.selectedId) s.duplicate(s.selectedId)
      return
    }
    const copies = cloneSet(items, s.items).map((c) => ({ ...c, at: translated(c.at, copyOffset(c)) }) as DecorItem)
    pendingKey = null
    set((st) => ({ items: [...st.items, ...copies] }))
    get().selectMany(
      copies.map((c) => c.id),
      copies[copies.length - 1].id,
    )
  },
  nudgeMany: (deltas) => {
    const ids = Object.keys(deltas)
    if (!ids.length) return
    pendingKey = `nudge:${ids.sort().join(',')}`
    set((s) => ({
      items: s.items.map((i) => {
        const d = deltas[i.id]
        if (!d) return i
        const at = translated(i.at, d)
        at[1] = Math.max(0, at[1])
        return { ...i, at } as DecorItem
      }),
    }))
  },
  rotateSelection: (deg) => {
    const s = get()
    get().applyPatches(rotateAround(s.items.filter((i) => s.selectedIds.includes(i.id)), deg))
  },
  group: () => {
    const s = get()
    if (s.selectedIds.length < 2) return
    const groupId = newGroupId()
    const ids = new Set(s.selectedIds)
    pendingKey = null
    set({ items: s.items.map((i) => (ids.has(i.id) ? ({ ...i, groupId } as DecorItem) : i)) })
  },
  ungroup: () => {
    const s = get()
    const ids = new Set(s.selectedIds)
    if (!s.items.some((i) => ids.has(i.id) && i.groupId)) return
    pendingKey = null
    set({
      items: s.items.map((i) => {
        if (!ids.has(i.id) || !i.groupId) return i
        const rest = { ...i }
        delete rest.groupId
        return rest
      }),
    })
  },
  renameGroup: (groupId, name) => {
    const groupNames = { ...get().groupNames }
    const n = name.trim()
    if (n) groupNames[groupId] = n
    else delete groupNames[groupId]
    set({ groupNames })
  },
  setTab: (tab) => set({ tab }),
  setFinishes: (patch) => set((s) => ({ finishes: { ...s.finishes, ...patch } })),
  switchLayout: async (slug) => {
    const from = decorFile
    if (slug === from) return
    const s = get()
    if (s.movingId) s.cancelPlacing()
    set({ selectedId: null })
    await flushSave()
    decorFile = slug
    syncUrl()
    set({ layout: slug, compareWith: from })
    await get().load()
  },
  toggleCompare: async () => {
    const other = get().compareWith
    if (other !== undefined) await get().switchLayout(other)
  },
  setCompareWith: (compareWith) => set({ compareWith }),
  renamed: (slug, name) => {
    if (slug !== decorFile) {
      decorFile = slug
      syncUrl()
    }
    // The server already wrote the new name: do not write it again.
    lastName = name
    lastSaved = serialize(committedOf(get()), get().finishes, name, get().groupNames)
    set({ layout: slug, layoutName: name })
  },
}))

// ---------- copy / duplicate ----------

let clipboard: DecorItem[] | null = null

const newGroupId = () => `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const membersOf = (items: DecorItem[], groupId: string) => items.filter((i) => i.groupId === groupId).map((i) => i.id)

/**
 * Copies of a set of items, with fresh ids unless `fresh` is false. A group
 * copied whole becomes a new group; a lone member of a group is copied ungrouped.
 */
export function cloneSet(src: DecorItem[], all: DecorItem[], fresh = true): DecorItem[] {
  const ids = new Set(src.map((i) => i.id))
  const regroup = new Map<string, string>()
  return src.map((s) => {
    const copy = structuredClone(s) as DecorItem
    if (fresh) copy.id = newId(s.kind)
    // Plants lay out their leaves from the seed (the id by default): keep the copy identical.
    if (copy.kind === 'plant' && s.kind === 'plant') copy.seed = s.seed ?? s.id
    const g = s.groupId
    const whole = !!g && src.filter((o) => o.groupId === g).length > 1 && all.filter((o) => o.groupId === g).every((o) => ids.has(o.id))
    if (g && whole) {
      if (!regroup.has(g)) regroup.set(g, fresh ? newGroupId() : g)
      copy.groupId = regroup.get(g)
    } else delete copy.groupId
    return copy
  })
}

/** Pastes several items at once: under the pointer when it is over a fitting surface, else next to the originals. */
function pasteSet(copies: DecorItem[]) {
  const lead = copies[0]
  const hit = editRefs.pointerInCanvas ? (isFloorPiece(lead) ? editRefs.lastFloorHit : editRefs.lastHit) : null
  const patch = hit && placeAt(lead, { ...hit, point: hit.point.clone() }, { free: true })
  let placed: DecorItem[]
  if (patch) {
    const leadTo = { ...lead, ...patch } as DecorItem
    placed = copies.map((c) => (c === lead ? leadTo : ({ ...c, ...followLead(lead, leadTo, c) } as DecorItem)))
  } else placed = copies.map((c) => ({ ...c, at: translated(c.at, copyOffset(c)) }) as DecorItem)
  pendingKey = null
  useDecor.setState((s) => ({ items: [...s.items, ...placed] }))
  useDecor.getState().selectMany(
    placed.map((c) => c.id),
    placed[0].id,
  )
}

/** Starts placing a copy (with its own id already), under the pointer when it is over the scene. */
function placeCopy(copy: DecorItem) {
  const src = copy
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
  const { selectedId, selectedIds } = useDecor.getState()
  const ids = new Set(target.map((i) => i.id))
  const kept = selectedIds.filter((id) => ids.has(id))
  applying = true
  useDecor.setState(
    changed.length
      ? { items: target, selectedIds: changed, selectedId: selectedId && changed.includes(selectedId) ? selectedId : changed[changed.length - 1] }
      : { items: target, selectedIds: kept, selectedId: selectedId && ids.has(selectedId) ? selectedId : (kept.at(-1) ?? null) },
  )
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
let pendingSave: (() => Promise<void>) | null = null
let lastSaved = ''
let lastItems: DecorItem[] | null = null
let lastFinishes: Finishes | null = null
let lastName = ''
let lastGroups: Record<string, string> = {}
/** Bodies this tab wrote recently: their file-change echoes must not trigger a reload. */
const written: string[] = []
/** The layout file: name and finishes only when there is something to say, so untouched files keep their shape. */
export const serialize = (items: DecorItem[], finishes: Finishes = DEFAULT_FINISHES, name = '', groupNames: Record<string, string> = {}) => {
  // Names only for groups that still exist.
  const live = new Set(items.map((i) => i.groupId).filter(Boolean))
  const named = Object.entries(groupNames).filter(([g, n]) => live.has(g) && n)
  const groups = named.length ? Object.fromEntries(named.map(([g, n]) => [g, { name: n }])) : undefined
  return (
    JSON.stringify(
      { version: 1, ...(name ? { name } : {}), ...(isDefaultFinishes(finishes) ? {} : { finishes }), ...(groups ? { groups } : {}), items } satisfies DecorFile,
      null,
      2,
    ) + '\n'
  )
}

/** Group names from a layout file. */
export function namesOf(groups: DecorFile['groups']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [g, v] of Object.entries(groups ?? {})) if (v && typeof v.name === 'string' && v.name) out[g] = v.name
  return out
}

/** Writes a pending (debounced) save right away; resolves once it is on disk. */
export async function flushSave() {
  clearTimeout(saveTimer)
  const save = pendingSave
  pendingSave = null
  if (save) await save()
}

useDecor.subscribe((s) => {
  if (!s.loaded || s.error?.startsWith('Saving')) return
  const items = committedOf(s)
  if (items === lastItems && s.finishes === lastFinishes && s.layoutName === lastName && s.groupNames === lastGroups) return
  lastItems = items
  lastFinishes = s.finishes
  lastName = s.layoutName
  lastGroups = s.groupNames
  const body = serialize(items, s.finishes, s.layoutName, s.groupNames)
  clearTimeout(saveTimer)
  pendingSave = null
  // Back to what is on disk (a cancelled drag, an undo): drop the pending save too.
  if (body === lastSaved) return
  const url = decorUrl()
  const save = async () => {
    lastSaved = body
    written.push(body)
    if (written.length > 8) written.shift()
    await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
  }
  pendingSave = save
  saveTimer = setTimeout(() => {
    pendingSave = null
    void save()
  }, 400)
})

// Someone (another tab, an editor, Claude) changed the file on disk: reload it
// unless it is what this tab just wrote.
if (import.meta.hot) {
  import.meta.hot.on('decor:changed', async (data: { file: string | null }) => {
    if ((data.file ?? null) !== (decorFile ?? null)) return
    const text = await fetch(decorUrl()).then((r) => r.text()).catch(() => null)
    if (text === null || text === lastSaved || written.includes(text)) return
    clearTimeout(saveTimer)
    await useDecor.getState().load()
  })
}
