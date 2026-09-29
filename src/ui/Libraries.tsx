import { memo, useMemo } from 'react'
import { DEFAULT_POT_SIZE, LAMP_KEYWORDS, LAMPS, MOUNT_GROUP, MOUNT_ORDER, PLANT_GROUPS, PLANT_META, PLANTS } from '../decor/catalog'
import { FURNITURE, FURNITURE_GROUPS, FURNITURE_KEYWORDS } from '../decor/furnitureCatalog'
import { newId, useDecor } from '../decor/store'
import type { DecorItem, FurnitureType, LampType, PlantSpecies } from '../model/decor'
import type { Vec3 } from '../model/types'
import { unplacedAt } from '../scene/decor/DecorLayer'
import { cm, matches } from './format'
import { FURNITURE_ICON, Icon, LAMP_ICON, PLANT_ICON, type IconName } from './icons'

// Catalog lists for furniture, plants and lights. Choosing a row starts placing
// a new item, which then follows the pointer until the next click.

interface Entry {
  key: string
  group: string
  icon: IconName
  name: string
  note: string
  meta?: string
  /** Extra words for search only. */
  keywords?: string
  create: () => DecorItem
}

const FURNITURE_ENTRIES: Entry[] = FURNITURE_GROUPS.flatMap((group) =>
  (Object.keys(FURNITURE) as FurnitureType[])
    .filter((t) => FURNITURE[t].group === group)
    .map((t) => {
      const spec = FURNITURE[t]
      const [w, h, d] = spec.size
      // Wall pieces are read by their face; floor pieces by their footprint.
      const meta = spec.mount === 'wall' ? `${cm(w)} × ${cm(h)}` : `${cm(w)} × ${cm(d)}`
      return {
        key: t,
        group: group.replace('&', 'and'),
        icon: FURNITURE_ICON[t],
        name: spec.label,
        note: spec.note,
        meta: `${meta} cm`,
        keywords: `${FURNITURE_KEYWORDS[t] ?? ''} ${spec.mount}`,
        create: () => ({
          kind: 'furniture',
          id: newId('furniture'),
          type: t,
          at: unplacedAt(),
          rotation: 0,
          size: [...spec.size] as Vec3,
          finish: { ...spec.finish },
          options: { ...spec.options },
        }),
      }
    }),
)

const PLANT_ENTRIES: Entry[] = PLANT_GROUPS.flatMap((group) =>
  (Object.keys(PLANTS) as PlantSpecies[])
    .filter((sp) => PLANT_META[sp].group === group)
    .map((sp) => ({
      key: sp,
      group,
      icon: PLANT_ICON[sp],
      name: PLANTS[sp].label,
      note: PLANTS[sp].note,
      keywords: PLANT_META[sp].keywords,
      create: () => ({
        kind: 'plant',
        id: newId('plant'),
        species: sp,
        pot: PLANTS[sp].pot,
        at: unplacedAt(),
        rotation: sp === 'collection' || sp === 'windowBox' ? 0 : Math.round(Math.random() * 360),
        scale: 1,
        potSize: DEFAULT_POT_SIZE[sp],
        ...(sp === 'collection' ? { count: 10, spread: 0.9 } : {}),
      }),
    })),
)

const LAMP_ENTRIES: Entry[] = MOUNT_ORDER.flatMap((mount) =>
  (Object.keys(LAMPS) as LampType[])
    .filter((t) => LAMPS[t].mount === mount)
    .map((t) => ({
      key: t,
      group: MOUNT_GROUP[mount],
      icon: LAMP_ICON[t],
      name: LAMPS[t].label,
      note: LAMPS[t].note,
      keywords: LAMP_KEYWORDS[t],
      create: () => ({
        kind: 'lamp',
        id: newId('lamp'),
        type: t,
        at: unplacedAt(),
        rotation: 0,
        on: true,
        brightness: 1,
        warmth: 2700,
        color: LAMPS[t].color,
        length: t === 'string' ? 2.4 : undefined,
      }),
    })),
)

export const LIBRARY_ENTRIES = { furniture: FURNITURE_ENTRIES, plants: PLANT_ENTRIES, lights: LAMP_ENTRIES }

export function CatalogLibrary({ entries, query, noun, onClear }: { entries: Entry[]; query: string; noun: string; onClear: () => void }) {
  const startPlacing = useDecor((s) => s.startPlacing)
  const groups = useMemo(() => {
    const hits = entries.filter((e) => matches(query, e.name, e.note, e.group, e.keywords))
    const out = new Map<string, Entry[]>()
    for (const e of hits) out.set(e.group, [...(out.get(e.group) ?? []), e])
    return [...out]
  }, [entries, query])

  const total = groups.reduce((n, [, list]) => n + list.length, 0)

  return (
    <div className="library">
      <p className="sr-only" role="status">
        {query.trim() ? `${total} ${total === 1 ? 'result' : 'results'}` : ''}
      </p>
      {groups.length === 0 && <NoResults query={query} noun={noun} onClear={onClear} />}
      {groups.map(([group, list]) => (
        <section key={group} className="lib-group" aria-labelledby={`g-${group.replace(/\W+/g, '-')}`}>
          <h3 className="group-label" id={`g-${group.replace(/\W+/g, '-')}`}>
            {group} <span className="count">{list.length}</span>
          </h3>
          <ul className="rows">
            {list.map((e) => (
              <LibraryRow key={e.key} entry={e} onPick={startPlacing} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const LibraryRow = memo(function LibraryRow({ entry, onPick }: { entry: Entry; onPick: (item: DecorItem) => void }) {
  return (
    <li>
      <button type="button" className="lib-row" onClick={() => onPick(entry.create())}>
        <span className="tile">
          <Icon name={entry.icon} size={20} />
        </span>
        <span className="lib-text">
          <span className="name">{entry.name}</span>
          <span className="note">{entry.note}</span>
        </span>
        {entry.meta && <span className="meta">{entry.meta}</span>}
        <Icon name="plus" size={14} className="add" />
      </button>
    </li>
  )
})

export function NoResults({ query, noun, onClear }: { query: string; noun: string; onClear: () => void }) {
  return (
    <div className="empty">
      <p className="empty-title">Nothing in {noun} matches “{query.trim()}”</p>
      <p className="note">Try a shorter word, like a room or a material.</p>
      <button type="button" className="btn" onClick={onClear}>
        Clear search
      </button>
    </div>
  )
}
