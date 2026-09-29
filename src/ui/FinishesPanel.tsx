import { useDecor } from '../decor/store'
import { ACCENT_WALLS, TILE_LAYOUTS, ZONE_FLOORS, type FloorId, type FloorZone } from '../model/finishes'
import { ACCENT_LABELS, ACCENTS, bathTileDef, FLOORS, PAINTS, TILE_COLORS, TILE_LAYOUT_LABELS, ZONE_LABELS } from '../project/finishes'
import { patternThumb } from '../scene/patterns'
import { Chips, Field, Section, Swatches } from './controls'
import { onRadioKeys } from './controlUtils'
import './finishes.css'

// The Room tab: floors per zone, wall paint with an optional accent wall, and
// the bathroom wall tiles. Changes apply live and are saved in the open
// layout's file, so each layout variant keeps its own finishes.

const ZONES: FloorZone[] = ['main', 'hall', 'bath', 'balcony']

export function FinishesPanel() {
  const f = useDecor((s) => s.finishes)
  const set = useDecor((s) => s.setFinishes)
  const hallHex = f.floors.hall.startsWith('hex')
  const mainHex = f.floors.main.startsWith('hex')

  return (
    <div className="finishes">
      <div className="finishes-head">
        <div className="i-title">
          <h2>Finishes</h2>
          <p>Floors, paint and tiles for this layout</p>
        </div>
      </div>

      <Section title="Floors">
        {ZONES.map((zone) => (
          <Field key={zone} label={ZONE_LABELS[zone]} value={FLOORS[f.floors[zone]].label}>
            <FloorPicker
              zone={zone}
              value={f.floors[zone]}
              onChange={(id) => set({ floors: { ...f.floors, [zone]: id } })}
            />
            {zone === 'hall' && hallHex && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={f.hexBlend}
                  disabled={mainHex}
                  onChange={(e) => set({ hexBlend: e.target.checked })}
                />
                <span>
                  Scatter hexagons into the main room
                  {mainHex && <span className="hint-text"> (needs another floor there)</span>}
                </span>
              </label>
            )}
          </Field>
        ))}
      </Section>

      <Section title="Walls">
        <Field label="Paint" value={PAINTS.find((p) => p.color === f.wallPaint)?.label ?? 'Custom'}>
          <Swatches value={f.wallPaint} colors={PAINTS} onChange={(wallPaint) => set({ wallPaint })} />
        </Field>
        <Field label="Accent wall">
          <Chips value={f.accentWall} options={ACCENT_WALLS.map((id) => ({ id, label: ACCENT_LABELS[id] }))} onChange={(accentWall) => set({ accentWall })} />
        </Field>
        {f.accentWall !== 'none' && (
          <Field label="Accent color" value={ACCENTS.find((p) => p.color === f.accentColor)?.label ?? 'Custom'}>
            <Swatches value={f.accentColor} colors={ACCENTS} onChange={(accentColor) => set({ accentColor })} />
          </Field>
        )}
      </Section>

      <Section title="Bathroom tiles">
        <Field label="Layout">
          <TilePicker value={f.bathTile.layout} color={f.bathTile.color} onChange={(layout) => set({ bathTile: { ...f.bathTile, layout } })} />
        </Field>
        <Field label="Color" value={TILE_COLORS.find((p) => p.color === f.bathTile.color)?.label ?? 'Custom'}>
          <Swatches value={f.bathTile.color} colors={TILE_COLORS} onChange={(color) => set({ bathTile: { ...f.bathTile, color } })} />
        </Field>
      </Section>
    </div>
  )
}

/** A grid of finish samples, one radio each. */
function SampleGrid<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string; thumb: string; color: string }[]
  onChange: (id: T) => void
}) {
  const index = options.findIndex((o) => o.id === value)
  return (
    <div
      className="samples"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => onRadioKeys(e, options.map((o) => o.id), index, onChange)}
    >
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          tabIndex={i === index || (index < 0 && i === 0) ? 0 : -1}
          title={o.label}
          data-finish={o.id}
          onClick={() => onChange(o.id)}
        >
          <span className="sample-img" style={{ backgroundColor: o.color, backgroundImage: o.thumb ? `url(${o.thumb})` : undefined }} />
          <span className="sample-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function FloorPicker({ zone, value, onChange }: { zone: FloorZone; value: FloorId; onChange: (id: FloorId) => void }) {
  const options = ZONE_FLOORS[zone].map((id) => ({ id, label: FLOORS[id].label, thumb: patternThumb(FLOORS[id].def), color: FLOORS[id].def.color }))
  return <SampleGrid label={`${ZONE_LABELS[zone]} floor`} value={value} options={options} onChange={onChange} />
}

function TilePicker({ value, color, onChange }: { value: (typeof TILE_LAYOUTS)[number]; color: string; onChange: (v: (typeof TILE_LAYOUTS)[number]) => void }) {
  const options = TILE_LAYOUTS.map((id) => {
    const def = bathTileDef({ layout: id, color })
    return { id, label: TILE_LAYOUT_LABELS[id], thumb: patternThumb(def, 112, 0.7), color }
  })
  return <SampleGrid label="Bathroom tile layout" value={value} options={options} onChange={onChange} />
}
