import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Plan } from '../../model/plan'
import {
  FITTINGS,
  ROOM_KINDS,
  type FittingType,
  type OpeningKind,
  type Sketch,
  type SketchRoom,
} from '../../model/sketch'
import type { Rect, Vec2 } from '../../model/types'
import {
  edgeLines,
  extent,
  freshId,
  OPENING_WIDTH,
  openingSpot,
  overlapping,
  rectFrom,
  round,
  roomAt,
  snap,
  toGrid,
  type Selection,
  type Tool,
} from './editing'

// The drawing surface of the floor plan editor: an SVG in plan meters (x right,
// z down, like the 3D app's top view). Rooms are drawn and edited here; the walls
// shown are the ones planFromSketch() builds from them, so what you see is what
// the 3D plan gets.

const KIND_FILL: Record<SketchRoom['kind'], string> = {
  living: '#efe6d6',
  bedroom: '#e9e1ef',
  kitchen: '#e2ecdf',
  bath: '#dde8ee',
  hall: '#ece9e2',
  balcony: '#e9ebe6',
}

type Drag =
  | { type: 'draw'; from: Vec2; to: Vec2 }
  | { type: 'move'; id: string; grab: Vec2; start: Sketch }
  | { type: 'resize'; id: string; corner: [0 | 2, 1 | 3] }
  | { type: 'fitting'; id: string; grab: Vec2 }
  | { type: 'opening'; id: string }
  | { type: 'pan'; client: Vec2; view: Rect }

interface Props {
  sketch: Sketch
  /** The plan the sketch makes now, or null when it cannot make one yet. */
  preview: Plan | null
  tool: Tool
  fittingType: FittingType
  selection: Selection
  /** A change; `commit` is false while a drag is still going (one undo step per gesture). */
  onChange: (sketch: Sketch, commit: boolean) => void
  onSelect: (s: Selection) => void
}

export function FloorplanCanvas({ sketch, preview, tool, fittingType, selection, onChange, onSelect }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<Rect>(() => framed(sketch))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<Vec2 | null>(null)
  const bad = new Set(overlapping(sketch.rooms))

  /** Plan meters under a pointer event. */
  const at = (e: { clientX: number; clientY: number }): Vec2 => {
    const m = svg.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
    return [p.x, p.y]
  }

  // Wheel zooms around the pointer.
  useEffect(() => {
    const el = svg.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const [px, pz] = at(e)
      const k = Math.exp(e.deltaY * 0.0015)
      setView(([x, z, w, h]) => {
        const nw = Math.min(60, Math.max(2, w * k))
        const nh = (nw / w) * h
        return [px - ((px - x) * nw) / w, pz - ((pz - z) * nh) / h, nw, nh]
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const update = (patch: Partial<Sketch>, commit: boolean) => onChange({ ...sketch, ...patch }, commit)
  const setRoom = (id: string, rect: Rect, base = sketch) =>
    ({ ...base, rooms: base.rooms.map((r) => (r.id === id ? { ...r, rect } : r)) }) satisfies Sketch

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const p = at(e)
    svg.current!.setPointerCapture(e.pointerId)
    const lines = edgeLines(sketch.rooms)
    if (tool === 'room') {
      const start: Vec2 = [snap(p[0], lines.x), snap(p[1], lines.z)]
      return setDrag({ type: 'draw', from: start, to: start })
    }
    if (tool === 'fitting') {
      const id = freshId('fit')
      update(
        { fittings: [...sketch.fittings, { id, type: fittingType, at: [toGrid(p[0]), toGrid(p[1])], rotation: 0 }] },
        true,
      )
      return onSelect({ kind: 'fitting', id })
    }
    if (tool !== 'select') {
      const spot = openingSpot(sketch.rooms, p, OPENING_WIDTH[tool])
      if (!spot) return
      const id = freshId('opening')
      update({ openings: [...sketch.openings, { id, kind: tool, at: spot, width: OPENING_WIDTH[tool] }] }, true)
      return onSelect({ kind: 'opening', id })
    }
    const room = roomAt(sketch.rooms, p)
    if (room) {
      onSelect({ kind: 'room', id: room.id })
      return setDrag({ type: 'move', id: room.id, grab: p, start: sketch })
    }
    onSelect(null)
    setDrag({ type: 'pan', client: [e.clientX, e.clientY], view })
  }

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = at(e)
    setHover(p)
    if (!drag) return
    if (drag.type === 'pan') {
      const r = svg.current!.getBoundingClientRect()
      const k = drag.view[2] / r.width
      setView([
        drag.view[0] - (e.clientX - drag.client[0]) * k,
        drag.view[1] - (e.clientY - drag.client[1]) * k,
        drag.view[2],
        drag.view[3],
      ])
      return
    }
    if (drag.type === 'draw') {
      const lines = edgeLines(sketch.rooms)
      return setDrag({ ...drag, to: [snap(p[0], lines.x), snap(p[1], lines.z)] })
    }
    if (drag.type === 'move') {
      const room = drag.start.rooms.find((r) => r.id === drag.id)!
      const lines = edgeLines(drag.start.rooms, drag.id)
      const [x0, z0, x1, z1] = room.rect
      // Snap whichever edge lands nearest another room's edge, else the grid.
      const dx = bestShift([x0, x1], p[0] - drag.grab[0], lines.x)
      const dz = bestShift([z0, z1], p[1] - drag.grab[1], lines.z)
      return onChange(moveRoom(drag.start, drag.id, dx, dz), false)
    }
    if (drag.type === 'resize') {
      const room = sketch.rooms.find((r) => r.id === drag.id)!
      const lines = edgeLines(sketch.rooms, drag.id)
      const r = [...room.rect] as Rect
      r[drag.corner[0]] = snap(p[0], lines.x)
      r[drag.corner[1]] = snap(p[1], lines.z)
      const fixed: Vec2 = [room.rect[2 - drag.corner[0]], room.rect[4 - drag.corner[1]]]
      return onChange(setRoom(drag.id, rectFrom(fixed, [r[drag.corner[0]], r[drag.corner[1]]])), false)
    }
    if (drag.type === 'fitting') {
      const at: Vec2 = [toGrid(p[0] - drag.grab[0]), toGrid(p[1] - drag.grab[1])]
      return update({ fittings: sketch.fittings.map((f) => (f.id === drag.id ? { ...f, at } : f)) }, false)
    }
    if (drag.type === 'opening') {
      const o = sketch.openings.find((x) => x.id === drag.id)!
      const spot = openingSpot(sketch.rooms, p, o.width)
      if (spot) update({ openings: sketch.openings.map((x) => (x.id === o.id ? { ...x, at: spot } : x)) }, false)
    }
  }

  const onUp = () => {
    if (drag?.type === 'draw') {
      const rect = rectFrom(drag.from, drag.to)
      // A click without a drag draws nothing.
      if (Math.abs(drag.to[0] - drag.from[0]) >= 0.3 || Math.abs(drag.to[1] - drag.from[1]) >= 0.3) {
        const id = freshId('room')
        const kind = sketch.rooms.length === 0 ? 'living' : 'bedroom'
        update({ rooms: [...sketch.rooms, { id, name: '', kind, rect }] }, true)
        onSelect({ kind: 'room', id })
      }
    } else if (drag && drag.type !== 'pan') onChange(sketch, true)
    setDrag(null)
  }

  const startDrag = (e: ReactPointerEvent, d: Drag, sel: Selection) => {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    svg.current!.setPointerCapture(e.pointerId)
    onSelect(sel)
    setDrag(d)
  }

  const px = view[2] / 800 // about one screen pixel, in meters
  const draft = drag?.type === 'draw' ? rectFrom(drag.from, drag.to) : null
  const ghost =
    tool !== 'select' && tool !== 'room' && tool !== 'fitting' && hover
      ? openingSpot(sketch.rooms, hover, OPENING_WIDTH[tool])
      : null
  const openingsById = new Map(
    (preview?.shell.walls ?? []).flatMap((w) =>
      (w.openings ?? []).map((o) => [o.id, { wall: w, opening: o }] as const),
    ),
  )

  return (
    <div className="fp-canvas">
      <svg
        ref={svg}
        viewBox={view.join(' ')}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setHover(null)}
        data-tool={tool}
        role="application"
        aria-label="Floor plan drawing"
      >
        <defs>
          <pattern id="fp-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="rgb(43 41 37 / 0.08)" strokeWidth={px} />
          </pattern>
          <pattern id="fp-grid-m" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgb(43 41 37 / 0.16)" strokeWidth={px} />
          </pattern>
        </defs>
        <rect x={view[0] - 50} y={view[1] - 50} width={view[2] + 100} height={view[3] + 100} fill="url(#fp-grid)" />
        <rect x={view[0] - 50} y={view[1] - 50} width={view[2] + 100} height={view[3] + 100} fill="url(#fp-grid-m)" />

        {sketch.rooms.map((r) => {
          const [x0, z0, x1, z1] = r.rect
          const selected = selection?.kind === 'room' && selection.id === r.id
          return (
            <g key={r.id} className="fp-room">
              <rect
                x={x0}
                y={z0}
                width={x1 - x0}
                height={z1 - z0}
                fill={bad.has(r.id) ? '#f6d4cf' : KIND_FILL[r.kind]}
                stroke={selected ? 'var(--focus)' : 'rgb(43 41 37 / 0.3)'}
                strokeWidth={(selected ? 2 : 1) * px}
                strokeDasharray={selected ? undefined : `${4 * px} ${3 * px}`}
              />
              <text
                x={(x0 + x1) / 2}
                y={(z0 + z1) / 2 - 8 * px}
                fontSize={13 * px}
                textAnchor="middle"
                className="fp-label"
              >
                {r.name || ROOM_KINDS.find((k) => k.id === r.kind)!.label}
              </text>
              <text
                x={(x0 + x1) / 2}
                y={(z0 + z1) / 2 + 10 * px}
                fontSize={11 * px}
                textAnchor="middle"
                className="fp-dims"
              >
                {(x1 - x0).toFixed(2)} × {(z1 - z0).toFixed(2)} m
              </text>
            </g>
          )
        })}

        {preview?.shell.walls.map((w) => (
          <line
            key={w.id}
            x1={w.a[0]}
            y1={w.a[1]}
            x2={w.b[0]}
            y2={w.b[1]}
            stroke={w.kind === 'exterior' ? '#3a3732' : '#6d6860'}
            strokeWidth={w.thickness}
            pointerEvents="none"
          />
        ))}
        {preview?.fixtures
          .filter((f) => f.type === 'railing')
          .map((f) => {
            const half = (f.size?.[0] ?? 1) / 2
            const along = f.rotation === 90
            return (
              <line
                key={f.id}
                x1={f.position[0] - (along ? 0 : half)}
                y1={f.position[2] - (along ? half : 0)}
                x2={f.position[0] + (along ? 0 : half)}
                y2={f.position[2] + (along ? half : 0)}
                stroke="#8b8f93"
                strokeWidth={3 * px}
                pointerEvents="none"
              />
            )
          })}

        {sketch.openings.map((o) => {
          const placed = openingsById.get(o.id)
          if (!placed) return null
          const { wall, opening } = placed
          const vertical = wall.a[0] === wall.b[0]
          const start = (vertical ? Math.min(wall.a[1], wall.b[1]) : Math.min(wall.a[0], wall.b[0])) + opening.offset
          const [ax, az, bx, bz] = vertical
            ? [wall.a[0], start, wall.a[0], start + opening.width]
            : [start, wall.a[1], start + opening.width, wall.a[1]]
          const selected = selection?.kind === 'opening' && selection.id === o.id
          return (
            <g
              key={o.id}
              className="fp-opening"
              onPointerDown={(e) => startDrag(e, { type: 'opening', id: o.id }, { kind: 'opening', id: o.id })}
            >
              <line x1={ax} y1={az} x2={bx} y2={bz} stroke="#fbfaf7" strokeWidth={wall.thickness + px} />
              <line
                x1={ax}
                y1={az}
                x2={bx}
                y2={bz}
                stroke={selected ? 'var(--focus)' : OPENING_COLOR[o.kind]}
                strokeWidth={(o.kind === 'passage' ? 2 : 5) * px}
                strokeDasharray={o.kind === 'passage' ? `${4 * px} ${3 * px}` : undefined}
              />
            </g>
          )
        })}

        {sketch.fittings.map((f) => {
          const [w, , d] = FITTINGS[f.type].size
          const selected = selection?.kind === 'fitting' && selection.id === f.id
          return (
            <g
              key={f.id}
              className="fp-fitting"
              transform={`translate(${f.at[0]} ${f.at[1]}) rotate(${-f.rotation})`}
              onPointerDown={(e) =>
                startDrag(
                  e,
                  { type: 'fitting', id: f.id, grab: [at(e)[0] - f.at[0], at(e)[1] - f.at[1]] },
                  { kind: 'fitting', id: f.id },
                )
              }
            >
              <rect
                x={-w / 2}
                y={-d / 2}
                width={w}
                height={d}
                fill="#fbfaf7"
                stroke={selected ? 'var(--focus)' : '#57534c'}
                strokeWidth={(selected ? 2 : 1) * px}
              />
              <text
                y={4 * px}
                fontSize={10 * px}
                textAnchor="middle"
                className="fp-dims"
                transform={`rotate(${f.rotation})`}
              >
                {FITTINGS[f.type].label}
              </text>
            </g>
          )
        })}

        {selection?.kind === 'room' &&
          tool === 'select' &&
          (() => {
            const r = sketch.rooms.find((x) => x.id === selection.id)
            if (!r) return null
            return ([0, 2] as const).flatMap((cx) =>
              ([1, 3] as const).map((cz) => (
                <rect
                  key={`${cx}${cz}`}
                  className="fp-handle"
                  x={r.rect[cx] - 5 * px}
                  y={r.rect[cz] - 5 * px}
                  width={10 * px}
                  height={10 * px}
                  onPointerDown={(e) => startDrag(e, { type: 'resize', id: r.id, corner: [cx, cz] }, selection)}
                />
              )),
            )
          })()}

        {draft && (
          <rect
            x={draft[0]}
            y={draft[1]}
            width={draft[2] - draft[0]}
            height={draft[3] - draft[1]}
            fill="rgb(47 111 214 / 0.12)"
            stroke="var(--focus)"
            strokeWidth={2 * px}
          />
        )}
        {draft && (
          <text x={draft[2]} y={draft[3] + 16 * px} fontSize={12 * px} textAnchor="end" className="fp-dims">
            {(draft[2] - draft[0]).toFixed(2)} × {(draft[3] - draft[1]).toFixed(2)} m
          </text>
        )}
        {ghost && tool !== 'select' && tool !== 'room' && tool !== 'fitting' && (
          <circle
            cx={ghost[0]}
            cy={ghost[1]}
            r={6 * px}
            fill={OPENING_COLOR[tool]}
            opacity={0.7}
            pointerEvents="none"
          />
        )}
      </svg>
      <div className="fp-zoom">
        <button type="button" className="btn" onClick={() => setView(framed(sketch))}>
          Fit
        </button>
      </div>
    </div>
  )
}

const OPENING_COLOR: Record<OpeningKind, string> = {
  door: '#b07a3f',
  window: '#3b82c4',
  glassDoor: '#5aa7d6',
  passage: '#8a857c',
}

/** The view rectangle that frames a sketch with some room around it. */
function framed(sketch: Sketch): Rect {
  const [x0, z0, x1, z1] = extent(sketch)
  const m = 1.5
  return [x0 - m, z0 - m, Math.max(x1 - x0 + 2 * m, 6), Math.max(z1 - z0 + 2 * m, 4)]
}

/** The shift that lands one of `edges` on a snap line, or the grid shift. */
function bestShift(edges: number[], d: number, lines: number[]): number {
  let best = toGrid(edges[0] + d) - edges[0]
  let gap = Infinity
  for (const e of edges) {
    const s = snap(e + d, lines)
    if (lines.includes(s) && Math.abs(s - (e + d)) < gap) {
      gap = Math.abs(s - (e + d))
      best = s - e
    }
  }
  return round(best)
}

/** Moves a room, with the doors and windows on its edges and the fittings inside it. */
function moveRoom(base: Sketch, id: string, dx: number, dz: number): Sketch {
  const room = base.rooms.find((r) => r.id === id)!
  const [x0, z0, x1, z1] = room.rect
  const onEdge = (p: Vec2) =>
    ((Math.abs(p[0] - x0) < 1e-6 || Math.abs(p[0] - x1) < 1e-6) && p[1] >= z0 && p[1] <= z1) ||
    ((Math.abs(p[1] - z0) < 1e-6 || Math.abs(p[1] - z1) < 1e-6) && p[0] >= x0 && p[0] <= x1)
  const inside = (p: Vec2) => p[0] > x0 && p[0] < x1 && p[1] > z0 && p[1] < z1
  const shift = (p: Vec2): Vec2 => [round(p[0] + dx), round(p[1] + dz)]
  return {
    ...base,
    rooms: base.rooms.map((r) =>
      r.id === id ? { ...r, rect: [x0 + dx, z0 + dz, x1 + dx, z1 + dz].map(round) as Rect } : r,
    ),
    openings: base.openings.map((o) => (onEdge(o.at) ? { ...o, at: shift(o.at) } : o)),
    fittings: base.fittings.map((f) => (inside(f.at) ? { ...f, at: shift(f.at) } : f)),
  }
}
