import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPlan, readPlan, writePlan } from '../../decor/api'
import type { Plan } from '../../model/plan'
import {
  emptySketch,
  FITTINGS,
  planFromSketch,
  ROOM_KINDS,
  type FittingType,
  type PlanMeta,
  type RoomKind,
  type Sketch,
} from '../../model/sketch'
import { validatePlan } from '../../model/validate'
import { links } from '../../project/launch'
import '../pages.css'
import { OPENING_WIDTH, overlapping, type Selection, type Tool } from './editing'
import { FloorplanCanvas } from './FloorplanCanvas'
import './floorplan.css'

// The floor plan editor: draw a plan from nothing, or change one drawn here
// before (docs/adr/0010). Saving turns the sketch into a plan (planFromSketch)
// and opens it in 3D.

/** Cities to pick the sun from; time zones without daylight saving, as the sun model uses them. */
const PLACES: PlanMeta['location'][] = [
  { label: 'Buenos Aires', lat: -34.6037, lon: -58.3816, tz: -3 },
  { label: 'Montevideo', lat: -34.9011, lon: -56.1645, tz: -3 },
  { label: 'Santiago', lat: -33.4489, lon: -70.6693, tz: -4 },
  { label: 'São Paulo', lat: -23.5505, lon: -46.6333, tz: -3 },
  { label: 'Mexico City', lat: 19.4326, lon: -99.1332, tz: -6 },
  { label: 'New York', lat: 40.7128, lon: -74.006, tz: -5 },
  { label: 'London', lat: 51.5072, lon: -0.1276, tz: 0 },
  { label: 'Madrid', lat: 40.4168, lon: -3.7038, tz: 1 },
  { label: 'Barcelona', lat: 41.3874, lon: 2.1686, tz: 1 },
  { label: 'Berlin', lat: 52.52, lon: 13.405, tz: 1 },
  { label: 'Tokyo', lat: 35.6762, lon: 139.6503, tz: 9 },
]

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  {
    id: 'select',
    label: 'Select',
    hint: 'Drag a room to move it, its corners to resize it. Drag the empty grid to pan, scroll to zoom.',
  },
  {
    id: 'room',
    label: 'Room',
    hint: 'Drag on the grid to draw a room. Edges snap to other rooms so they share a wall.',
  },
  { id: 'door', label: 'Door', hint: 'Click a wall to put a door in it.' },
  { id: 'window', label: 'Window', hint: 'Click an outside wall to put a window in it.' },
  {
    id: 'glassDoor',
    label: 'Glass door',
    hint: 'Click a wall for a floor-to-ceiling glass door, e.g. onto a balcony.',
  },
  { id: 'passage', label: 'Opening', hint: 'Click a wall for an open passage, without a door.' },
  { id: 'fitting', label: 'Fitting', hint: 'Click to place it. R turns the selected fitting.' },
]

export function FloorplanEditorPage({ space, plan: planId }: { space: string; plan: string | null }) {
  const [sketch, setSketch] = useState<Sketch | null>(planId ? null : emptySketch())
  const [name, setName] = useState('My apartment')
  const [place, setPlace] = useState(PLACES[0])
  const [tool, setTool] = useState<Tool>('room')
  const [fittingType, setFittingType] = useState<FittingType>('toilet')
  const [selection, setSelection] = useState<Selection>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const past = useRef<Sketch[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const committed = useRef<Sketch | null>(null)

  // An existing plan opens with what was drawn for it.
  useEffect(() => {
    if (!planId) return
    readPlan(space, planId).then(
      (raw) => {
        const p = raw as Plan
        if (!p.sketch) return setError('This plan was not drawn here, so it cannot be edited here.')
        setSketch(p.sketch)
        committed.current = p.sketch
        setName(p.name)
        setPlace(
          PLACES.find((x) => x.label === p.location.label) ?? { ...p.location, label: p.location.label ?? 'Here' },
        )
        setTool('select')
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [space, planId])

  const change = useCallback((next: Sketch, commit: boolean) => {
    setSketch(next)
    if (!commit) return
    if (committed.current) past.current.push(committed.current)
    committed.current = next
    setCanUndo(past.current.length > 0)
  }, [])

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    committed.current = prev
    setSketch(prev)
    setSelection(null)
    setCanUndo(past.current.length > 0)
  }, [])

  const preview = useMemo(() => {
    if (!sketch?.rooms.some((r) => r.kind !== 'balcony')) return null
    try {
      return planFromSketch(sketch, { id: planId ?? 'new', name, location: place })
    } catch {
      return null
    }
  }, [sketch, planId, name, place])

  const problems = useMemo(() => {
    if (!sketch) return []
    const out: string[] = []
    if (!sketch.rooms.some((r) => r.kind !== 'balcony')) out.push('Draw at least one room.')
    if (overlapping(sketch.rooms).length)
      out.push('Some rooms overlap (shown in red). Rooms may share edges, not floor.')
    if (preview && !preview.shell.walls.some((w) => w.openings?.some((o) => o.kind === 'door')))
      out.push('There is no door yet: walk mode starts at the front door.')
    if (preview) out.push(...validatePlan(preview))
    return out
  }, [sketch, preview])
  const blocking = problems.filter((p) => !p.startsWith('There is no door'))

  // Keys: delete the selection, turn a fitting, undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, select, textarea') || !sketch) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return undo()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault()
        const without = <T extends { id: string }>(list: T[]) => list.filter((x) => x.id !== selection.id)
        change(
          {
            ...sketch,
            rooms: without(sketch.rooms),
            openings: without(sketch.openings),
            fittings: without(sketch.fittings),
          },
          true,
        )
        setSelection(null)
      }
      if (e.key.toLowerCase() === 'r' && selection?.kind === 'fitting') {
        change(
          {
            ...sketch,
            fittings: sketch.fittings.map((f) =>
              f.id === selection.id ? { ...f, rotation: (f.rotation + 90) % 360 } : f,
            ),
          },
          true,
        )
      }
      if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sketch, selection, change, undo])

  const save = async () => {
    if (!sketch || !preview || blocking.length) return
    setSaving(true)
    setError(null)
    try {
      const id = planId
        ? (await writePlan(space, planId, planFromSketch(sketch, { id: planId, name, location: place })), planId)
        : await createPlan(space, { name, plan: preview })
      window.location.href = links.plan(space, id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const room = selection?.kind === 'room' ? sketch?.rooms.find((r) => r.id === selection.id) : undefined
  const opening = selection?.kind === 'opening' ? sketch?.openings.find((o) => o.id === selection.id) : undefined
  const fitting = selection?.kind === 'fitting' ? sketch?.fittings.find((f) => f.id === selection.id) : undefined
  const patch = <K extends 'rooms' | 'openings' | 'fittings'>(key: K, id: string, p: Partial<Sketch[K][number]>) =>
    sketch &&
    change({ ...sketch, [key]: (sketch[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...p } : x)) }, true)

  return (
    <main className="fp">
      {sketch ? (
        <FloorplanCanvas
          sketch={sketch}
          preview={preview}
          tool={tool}
          fittingType={fittingType}
          selection={selection}
          onChange={change}
          onSelect={setSelection}
        />
      ) : (
        <div className="fp-canvas" />
      )}
      <aside className="fp-panel" aria-label="Floor plan">
        <a className="brand" href={links.space(space)}>
          ← Your plans
        </a>
        <h1>{planId ? 'Edit floor plan' : 'Draw a floor plan'}</h1>

        <label className="fp-field">
          <span>Name</span>
          <input type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="fp-field">
          <span>City (for the sun)</span>
          <select
            value={place.label}
            onChange={(e) => setPlace(PLACES.find((p) => p.label === e.target.value) ?? place)}
          >
            {!PLACES.some((p) => p.label === place.label) && <option>{place.label}</option>}
            {PLACES.map((p) => (
              <option key={p.label}>{p.label}</option>
            ))}
          </select>
        </label>
        {sketch && (
          <label className="fp-field">
            <span>Ceiling height (m)</span>
            <input
              type="number"
              min={2.2}
              max={4}
              step={0.05}
              value={sketch.height}
              onChange={(e) => {
                const h = Number(e.target.value)
                if (h >= 2.2 && h <= 4) change({ ...sketch, height: h }, true)
              }}
            />
          </label>
        )}

        <fieldset className="fp-tools">
          <legend>Tool</legend>
          {TOOLS.map((t) => (
            <label key={t.id} className={tool === t.id ? 'on' : undefined}>
              <input type="radio" name="tool" checked={tool === t.id} onChange={() => setTool(t.id)} />
              {t.label}
            </label>
          ))}
        </fieldset>
        {tool === 'fitting' && (
          <label className="fp-field">
            <span>Fitting to place</span>
            <select value={fittingType} onChange={(e) => setFittingType(e.target.value as FittingType)}>
              {(Object.keys(FITTINGS) as FittingType[]).map((f) => (
                <option key={f} value={f}>
                  {FITTINGS[f].label}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="fp-hint">{TOOLS.find((t) => t.id === tool)!.hint}</p>

        {room && (
          <section className="fp-inspector" aria-label="Selected room">
            <label className="fp-field">
              <span>Room name</span>
              <input
                type="text"
                value={room.name}
                placeholder={ROOM_KINDS.find((k) => k.id === room.kind)!.label}
                onChange={(e) => patch('rooms', room.id, { name: e.target.value })}
              />
            </label>
            <label className="fp-field">
              <span>Kind</span>
              <select value={room.kind} onChange={(e) => patch('rooms', room.id, { kind: e.target.value as RoomKind })}>
                {ROOM_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="fp-hint">
              {(room.rect[2] - room.rect[0]).toFixed(2)} × {(room.rect[3] - room.rect[1]).toFixed(2)} m, on wall
              centerlines. Delete removes it.
            </p>
          </section>
        )}
        {opening && (
          <section className="fp-inspector" aria-label="Selected opening">
            <label className="fp-field">
              <span>Width (m)</span>
              <input
                type="number"
                min={0.5}
                max={4}
                step={0.05}
                value={opening.width}
                onChange={(e) => {
                  const w = Number(e.target.value)
                  if (w >= 0.5 && w <= 4) patch('openings', opening.id, { width: w })
                }}
              />
            </label>
            <p className="fp-hint">
              Drag it along its wall. Delete removes it. A {opening.kind === 'door' ? 'door' : 'new one'} is{' '}
              {OPENING_WIDTH[opening.kind]} m wide by default.
            </p>
          </section>
        )}
        {fitting && (
          <section className="fp-inspector" aria-label="Selected fitting">
            <p className="fp-hint">
              {FITTINGS[fitting.type].label}: drag to move, R to turn ({fitting.rotation}°), Delete to remove.
            </p>
          </section>
        )}

        {problems.length > 0 && (
          <ul className="fp-problems">
            {problems.slice(0, 5).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {error && <p className="notice error">{error}</p>}

        <div className="fp-actions">
          <button type="button" className="btn" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={save}
            disabled={!preview || blocking.length > 0 || saving}
          >
            {planId ? 'Save and open in 3D' : 'Create and open in 3D'}
          </button>
        </div>
      </aside>
    </main>
  )
}
