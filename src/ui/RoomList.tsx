import { memo, useEffect, useMemo, useRef } from 'react'
import { useDecor } from '../decor/store'
import type { DecorKind } from '../model/decor'
import { structureOf } from '../model/finishes'
import { lostWallOf, WALL_LABELS, type HungItem } from '../project/structure'
import { isPlaced, itemLabel, TABS } from './format'
import { Icon, itemIcon, type IconName } from './icons'
import { useUi } from './uiStore'

// Everything placed in the room, grouped by kind. Docked at the bottom of the
// panel and collapsible; it scrolls on its own when the list is long.

interface Row {
  id: string
  kind: DecorKind
  label: string
  icon: IconName
  image?: string
  /** Hung on a wall this layout takes out. */
  lostWall?: string
}

const SEP = '\u0001'

/**
 * One string per placed item with only what a row shows. Moving an item changes
 * its position but not this string, so dragging does not re-render the list.
 */
const rowsSignature = (s: ReturnType<typeof useDecor.getState>) =>
  s.items
    .filter(isPlaced)
    .map((i) => [i.id, i.kind, itemLabel(i), itemIcon(i), i.kind === 'artwork' ? i.image : '', lostWallOf(i as HungItem, structureOf(s.finishes)) ?? ''].join(SEP))
    .join('\n')

export function useRoomCounts() {
  const sig = useDecor((s) => TABS.map((t) => s.items.filter((i) => i.kind === t.kind && isPlaced(i)).length).join(','))
  return useMemo(() => sig.split(',').map(Number), [sig])
}

export function RoomList() {
  const open = useUi((s) => s.roomListOpen)
  const toggle = useUi((s) => s.toggleRoomList)
  const sig = useDecor(rowsSignature)
  const selectedId = useDecor((s) => s.selectedId)
  const select = useDecor((s) => s.select)
  const remove = useDecor((s) => s.remove)
  const listRef = useRef<HTMLDivElement>(null)

  const rows = useMemo<Row[]>(
    () =>
      sig
        ? sig.split('\n').map((line) => {
            const [id, kind, label, icon, image, lostWall] = line.split(SEP)
            return { id, kind: kind as DecorKind, label, icon: icon as IconName, image: image || undefined, lostWall: lostWall || undefined }
          })
        : [],
    [sig],
  )
  const groups = TABS.map((t) => ({ ...t, rows: rows.filter((r) => r.kind === t.kind) })).filter((g) => g.rows.length > 0)

  const onDelete = (id: string) => {
    // Keep keyboard focus in the list: move it to the next row, or the previous one.
    const i = rows.findIndex((r) => r.id === id)
    const next = rows[i + 1] ?? rows[i - 1]
    remove(id)
    requestAnimationFrame(() => {
      const el = next && listRef.current?.querySelector<HTMLElement>(`[data-row="${next.id}"] .placed-main`)
      ;(el ?? document.getElementById('room-toggle'))?.focus()
    })
  }

  return (
    <section className={`room${open ? ' open' : ''}`} aria-labelledby="room-toggle">
      <h2 className="room-head">
        <button type="button" id="room-toggle" aria-expanded={open} aria-controls="room-list" onClick={toggle}>
          <Icon name="chevron" size={14} className="disclosure" />
          In the room
          <span className="count">{rows.length}</span>
        </button>
      </h2>
      <div id="room-list" className="room-list" ref={listRef} hidden={!open}>
        {rows.length === 0 && <p className="note">Nothing placed yet. Choose something above, then click in the room to set it down.</p>}
        {groups.map((g) => (
          <div key={g.kind} className="room-group" role="group" aria-labelledby={`room-${g.kind}`}>
            <h3 className="group-label" id={`room-${g.kind}`}>
              {g.label} <span className="count">{g.rows.length}</span>
            </h3>
            <ul className="placed">
              {g.rows.map((r) => (
                <PlacedRow key={r.id} row={r} selected={r.id === selectedId} onSelect={select} onDelete={onDelete} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

const PlacedRow = memo(function PlacedRow({
  row,
  selected,
  onSelect,
  onDelete,
}: {
  row: Row
  selected: boolean
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  // Selecting in the room scrolls the list to the row.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  return (
    <li ref={ref} className={`placed-row${selected ? ' on' : ''}`} data-row={row.id}>
      <button type="button" className="placed-main" aria-pressed={selected} onClick={() => onSelect(selected ? null : row.id)}>
        <span className="tile small">{row.image ? <img src={row.image} alt="" loading="lazy" decoding="async" /> : <Icon name={row.icon} size={16} />}</span>
        <span className="placed-name">{row.label}</span>
        {row.lostWall && (
          <span className="wall-lost-badge" data-lost-wall={row.lostWall} title={`Hung on the ${WALL_LABELS[row.lostWall] ?? row.lostWall} wall, which this layout removes. Move it to another wall.`}>
            Wall removed
          </span>
        )}
      </button>
      <button type="button" className="icon-btn danger" aria-label={`Delete ${row.label}`} title="Delete" onClick={() => onDelete(row.id)}>
        <Icon name="trash" size={14} />
      </button>
    </li>
  )
})
