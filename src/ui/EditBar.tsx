import { useMemo, type ReactNode } from 'react'
import { LAMPS, PLANTS } from '../decor/catalog'
import { FURNITURE } from '../decor/furnitureCatalog'
import { collisionsOf, mountOf } from '../decor/placement'
import { useDecor } from '../decor/store'
import type { DecorItem } from '../model/decor'
import './editbar.css'

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

function label(item: DecorItem): string {
  if (item.kind === 'artwork') return decodeURIComponent(item.image.split('/').pop() ?? '').replace(/\.[^.]+$/, '') || 'Artwork'
  if (item.kind === 'plant') return PLANTS[item.species].label
  if (item.kind === 'furniture') return FURNITURE[item.type].label
  return LAMPS[item.type].label
}

const icon = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const ICONS = {
  rotL: icon(
    <>
      <path d="M3.5 7.5a4.5 4.5 0 1 1 1.3 3.2" />
      <path d="M3.5 3.5v4h4" />
    </>,
  ),
  rotR: icon(
    <>
      <path d="M12.5 7.5a4.5 4.5 0 1 0-1.3 3.2" />
      <path d="M12.5 3.5v4h-4" />
    </>,
  ),
  dup: icon(
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
    </>,
  ),
  del: icon(
    <>
      <path d="M3 4.5h10" />
      <path d="M6.5 4.5V3h3v1.5" />
      <path d="M4.5 4.5l.6 8.1a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.1" />
    </>,
  ),
  undo: icon(
    <>
      <path d="M6 3.5L3 6.5l3 3" />
      <path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7" />
    </>,
  ),
  redo: icon(
    <>
      <path d="M10 3.5l3 3-3 3" />
      <path d="M13 6.5H6.5a3.5 3.5 0 0 0 0 7H9" />
    </>,
  ),
}

function Btn({ title, onClick, disabled, children, danger }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" className={danger ? 'danger' : undefined} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

/** Floating actions for the selected item, bottom center. */
export function EditBar() {
  const items = useDecor((s) => s.items)
  const selectedId = useDecor((s) => s.selectedId)
  const placing = useDecor((s) => s.isDraft && s.movingId !== null)
  const canUndo = useDecor((s) => s.canUndo)
  const canRedo = useDecor((s) => s.canRedo)
  const { undo, redo, rotateBy, duplicate, remove } = useDecor.getState()
  const item = items.find((i) => i.id === selectedId)
  const col = useMemo(() => (item ? collisionsOf(item, items) : null), [item, items])
  if (!item || placing) return null

  const turnable = 'rotation' in item && mountOf(item) !== 'wall'
  const step = item.kind === 'furniture' ? 90 : 15
  const others = col?.overlaps.map((id) => items.find((i) => i.id === id)).filter((i): i is DecorItem => !!i) ?? []
  const warning = others.length ? `Overlaps ${others.map(label).join(', ')}` : col?.wall ? 'Cuts into a wall' : null

  return (
    <div className="editbar" role="toolbar" aria-label="Selected item">
      <div className="editbar-name">
        <strong title={label(item)}>{label(item)}</strong>
        {warning ? (
          <span className="editbar-warn" role="status" title={warning}>
            {warning}
          </span>
        ) : (
          'rotation' in item &&
          turnable && <span className="editbar-meta">{Math.round(item.rotation)}°</span>
        )}
      </div>
      {turnable && (
        <div className="editbar-group">
          <Btn title={`Rotate left ${step}° (Shift+R)`} onClick={() => rotateBy(item.id, -step)}>
            {ICONS.rotL}
          </Btn>
          <Btn title={`Rotate right ${step}° (R)`} onClick={() => rotateBy(item.id, step)}>
            {ICONS.rotR}
          </Btn>
        </div>
      )}
      <div className="editbar-group">
        <Btn title={`Duplicate (${mod}D)`} onClick={() => duplicate(item.id)}>
          {ICONS.dup}
        </Btn>
        <Btn title="Delete (Delete)" onClick={() => remove(item.id)} danger>
          {ICONS.del}
        </Btn>
      </div>
      <div className="editbar-group">
        <Btn title={`Undo (${mod}Z)`} onClick={undo} disabled={!canUndo}>
          {ICONS.undo}
        </Btn>
        <Btn title={`Redo (${mod === '⌘' ? '⇧⌘Z' : 'Ctrl+Y'})`} onClick={redo} disabled={!canRedo}>
          {ICONS.redo}
        </Btn>
      </div>
    </div>
  )
}
