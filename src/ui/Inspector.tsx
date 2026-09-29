import { memo, type ReactNode } from 'react'
import { FRAME_COLORS, FRAME_STYLES, LAMPS, MAT_WIDTHS, PLANTS, POT_SIZES, POTS, SIZE_PRESETS, WARMTH } from '../decor/catalog'
import { BODY_FINISHES, FABRIC_FINISHES, FURNITURE, METAL_FINISHES, type OptionSpec } from '../decor/furnitureCatalog'
import { mountOf } from '../decor/placement'
import { useDecor } from '../decor/store'
import type { ArtworkItem, DecorItem, FurnitureItem, LampItem, PlantItem, PlantSpecies, PotSize, SizePreset } from '../model/decor'
import type { Vec3 } from '../model/types'
import { artworkOuterSize } from '../scene/decor/Artwork'
import { Chips, Field, NumberInput, Section, Slider, Swatches, Switch, useFieldControlId } from './controls'
import { colorName } from './controlUtils'
import { cm, isPlaced, itemKindLine, itemLabel } from './format'
import { Icon, itemIcon } from './icons'

// Settings for the selected item. Subscribes to that one item only, so dragging
// it re-renders the inspector but not the rest of the panel.

export function Inspector({ id }: { id: string }) {
  const item = useDecor((s) => s.items.find((i) => i.id === id))
  if (!item) return null
  return (
    <div className="inspector">
      <InspectorHeader item={item} />
      {item.kind === 'artwork' && <ArtworkControls item={item} />}
      {item.kind === 'plant' && <PlantControls item={item} />}
      {item.kind === 'lamp' && <LampControls item={item} />}
      {item.kind === 'furniture' && <FurnitureControls item={item} />}
      <InspectorActions id={item.id} canRotate={item.kind !== 'artwork' && mountOf(item) !== 'wall'} />
    </div>
  )
}

function InspectorHeader({ item }: { item: DecorItem }) {
  const select = useDecor((s) => s.select)
  return (
    <header className="i-head">
      <span className="tile large">{item.kind === 'artwork' ? <img src={item.image} alt="" /> : <Icon name={itemIcon(item)} size={22} />}</span>
      <div className="i-title">
        <h2>{itemLabel(item)}</h2>
        <p>{itemKindLine(item)}</p>
      </div>
      <button type="button" className="btn" onClick={() => select(null)} aria-keyshortcuts="Escape" title="Back to the library (Esc)">
        Done
      </button>
    </header>
  )
}

const InspectorActions = memo(function InspectorActions({ id, canRotate }: { id: string; canRotate: boolean }) {
  const remove = useDecor((s) => s.remove)
  const duplicate = useDecor((s) => s.duplicate)
  const relocate = useDecor((s) => s.startRelocating)
  return (
    <div className="i-foot">
      <div className="actions">
        <button type="button" className="btn" onClick={() => relocate(id)} title="Pick it up and place it again with the next click">
          <Icon name="move" size={14} /> Move
        </button>
        <button type="button" className="btn" onClick={() => duplicate(id)} aria-keyshortcuts="Meta+D Control+D">
          <Icon name="duplicate" size={14} /> Duplicate
        </button>
        <button type="button" className="btn danger" onClick={() => remove(id)} aria-keyshortcuts="Delete">
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>
      <p className="note">
        Drag it in the room to move it{canRotate && (
          <>
            , <kbd>R</kbd> to rotate
          </>
        )}
        .
      </p>
    </div>
  )
})

/**
 * Height, rotation and other fields derived from `at`. Hidden while a new item
 * still follows the pointer: until it is dropped, its position is a parking spot
 * below the floor, not a real one.
 */
function PositionSection({ item, children }: { item: DecorItem; children: ReactNode }) {
  if (!isPlaced(item)) return null
  return <Section title="Position">{children}</Section>
}

// ---------- artwork ----------

function ArtworkControls({ item }: { item: ArtworkItem }) {
  const update = useDecor((s) => s.update<ArtworkItem>)
  const set = (patch: Partial<ArtworkItem>) => update(item.id, patch)
  const landscape = item.size.w > item.size.h
  const style = FRAME_STYLES.find((s) => s.id === item.frame.style)!
  const allowsMat = style.id !== 'none' && style.id !== 'canvas'
  const [ow, oh] = artworkOuterSize(item)

  const setPreset = (preset: SizePreset) => {
    if (preset === 'custom') return set({ size: { ...item.size, preset } })
    const [w, h] = SIZE_PRESETS.find((p) => p.id === preset)!.size
    set({ size: { preset, w: landscape ? h : w, h: landscape ? w : h } })
  }

  return (
    <>
      <Section title="Print">
        <Field label="Size" value={`${cm(item.size.w)} × ${cm(item.size.h)} cm`}>
          <Chips value={item.size.preset} options={[...SIZE_PRESETS.map((p) => ({ id: p.id as SizePreset, label: p.label })), { id: 'custom', label: 'Custom' }]} onChange={setPreset} />
        </Field>
        {item.size.preset === 'custom' && (
          <div className="grid-2">
            <Field label="Width">
              <NumberInput name="width" value={cm(item.size.w)} min={5} max={200} unit="cm" onChange={(v) => set({ size: { ...item.size, w: v / 100 } })} />
            </Field>
            <Field label="Height">
              <NumberInput name="height" value={cm(item.size.h)} min={5} max={200} unit="cm" onChange={(v) => set({ size: { ...item.size, h: v / 100 } })} />
            </Field>
          </div>
        )}
        <Field label="Orientation">
          <Chips
            value={landscape ? 'landscape' : 'portrait'}
            options={[
              { id: 'portrait', label: 'Portrait' },
              { id: 'landscape', label: 'Landscape' },
            ]}
            onChange={(v) => {
              if ((v === 'landscape') !== landscape) set({ size: { ...item.size, w: item.size.h, h: item.size.w } })
            }}
          />
        </Field>
        <Field label="Image">
          <Chips
            value={item.fit}
            options={[
              { id: 'cover', label: 'Fill and crop' },
              { id: 'contain', label: 'Whole image' },
            ]}
            onChange={(fit) => set({ fit })}
          />
        </Field>
      </Section>
      <Section title="Frame">
        <Field label="Style">
          <Chips
            value={item.frame.style}
            options={FRAME_STYLES.map((f) => ({ id: f.id, label: f.label }))}
            onChange={(styleId) => {
              const next = FRAME_STYLES.find((f) => f.id === styleId)!
              set({ frame: { ...item.frame, style: styleId, mat: item.frame.mat || next.mat } })
            }}
          />
        </Field>
        {style.id !== 'none' && (
          <Field label={style.id === 'canvas' ? 'Edge color' : 'Frame color'} value={colorName(item.frame.color, FRAME_COLORS)}>
            <Swatches value={item.frame.color} colors={FRAME_COLORS} onChange={(color) => set({ frame: { ...item.frame, color } })} />
          </Field>
        )}
        {allowsMat ? (
          <Field label="Mat (passe-partout)">
            <Chips value={item.frame.mat} options={MAT_WIDTHS.map((m) => ({ id: m, label: m ? `${cm(m)} cm` : 'None' }))} onChange={(mat) => set({ frame: { ...item.frame, mat } })} />
          </Field>
        ) : (
          <p className="note">{style.label} frames have no mat.</p>
        )}
      </Section>
      <PositionSection item={item}>
        <Field label="Center height">
          <NumberInput name="center height" value={cm(item.at[1])} min={20} max={250} unit="cm from floor" onChange={(v) => set({ at: [item.at[0], v / 100, item.at[2]] })} />
        </Field>
        <p className="readout">
          Outer size {cm(ow)} × {cm(oh)} cm · top edge at {cm(item.at[1] + oh / 2)} cm
        </p>
      </PositionSection>
    </>
  )
}

// ---------- plants ----------

const pct = (v: number) => `${Math.round(v * 100)}%`
const deg = (v: number) => `${Math.round(v)}°`

function PlantControls({ item }: { item: PlantItem }) {
  const update = useDecor((s) => s.update<PlantItem>)
  const set = (patch: Partial<PlantItem>) => update(item.id, patch)
  const isCollection = item.species === 'collection'
  const hasClayPot = !isCollection && item.species !== 'windowBox'
  const ownPot = (item.potSize ?? 'auto') === 'auto'
  const potColors = POTS.map((p) => ({ label: p.label, color: p.color }))
  const potColor = POTS.find((p) => p.id === item.pot)!.color
  return (
    <>
      <Section title="Plant">
        <Field label="Species">
          <SpeciesSelect item={item} onChange={(species) => set({ species })} />
        </Field>
        <Field label="Size" value={pct(item.scale)}>
          <Slider value={item.scale} min={0.5} max={1.6} step={0.05} format={pct} onChange={(scale) => set({ scale })} />
        </Field>
      </Section>
      {(hasClayPot || (ownPot && !isCollection)) && (
        <Section title="Pot">
          {hasClayPot && (
            <Field label="Clay pot size">
              <Chips value={item.potSize ?? 'auto'} options={POT_SIZES} onChange={(potSize: PotSize) => set({ potSize })} />
            </Field>
          )}
          {ownPot && !isCollection && (
            <Field label="Pot" value={colorName(potColor, potColors)}>
              <Swatches value={potColor} colors={potColors} onChange={(c) => set({ pot: POTS.find((p) => p.color === c)?.id ?? item.pot })} />
            </Field>
          )}
        </Section>
      )}
      {isCollection && (
        <Section title="Collection">
          <Field label="Pots" value={item.count ?? 10}>
            <Slider value={item.count ?? 10} min={2} max={30} step={1} format={(v) => `${v} pots`} onChange={(count) => set({ count })} />
          </Field>
          <Field label="Strip width" value={`${cm(item.spread ?? 0.9)} cm`}>
            <Slider value={item.spread ?? 0.9} min={0.2} max={2.5} step={0.05} format={(v) => `${cm(v)} cm`} onChange={(spread) => set({ spread })} />
          </Field>
          <button type="button" className="btn" onClick={() => set({ seed: Math.random().toString(36).slice(2, 8) })}>
            Shuffle plants
          </button>
        </Section>
      )}
      <PositionSection item={item}>
        <Field label="Rotation" value={deg(item.rotation)}>
          <Slider value={item.rotation} min={0} max={360} step={5} format={deg} onChange={(rotation) => set({ rotation })} />
        </Field>
      </PositionSection>
    </>
  )
}

function SpeciesSelect({ item, onChange }: { item: PlantItem; onChange: (s: PlantSpecies) => void }) {
  const mount = PLANTS[item.species].mount
  // Only species that hang the same way can swap in place.
  const options = (Object.keys(PLANTS) as PlantSpecies[]).filter((sp) => PLANTS[sp].mount === mount)
  const id = useFieldControlId()
  return (
    <select id={id}className="select" value={item.species} onChange={(e) => onChange(e.target.value as PlantSpecies)}>
      {options.map((sp) => (
        <option key={sp} value={sp}>
          {PLANTS[sp].label}
        </option>
      ))}
    </select>
  )
}

// ---------- lights ----------

function LampControls({ item }: { item: LampItem }) {
  const update = useDecor((s) => s.update<LampItem>)
  const set = (patch: Partial<LampItem>) => update(item.id, patch)
  const mount = mountOf(item)
  const colors = [{ label: 'Original', color: LAMPS[item.type].color }, ...FRAME_COLORS]
  return (
    <>
      <Section title="Light">
        <Switch label="Light on" checked={item.on} onChange={(on) => set({ on })} />
        <Field label="Brightness" value={pct(item.brightness)}>
          <Slider value={item.brightness} min={0.1} max={2} step={0.05} format={pct} onChange={(brightness) => set({ brightness })} />
        </Field>
        <Field label="Warmth">
          <Chips value={item.warmth} options={WARMTH.map((w) => ({ id: w.id, label: w.label }))} onChange={(warmth) => set({ warmth })} />
        </Field>
      </Section>
      <Section title="Finish">
        <Field label="Color" value={colorName(item.color, colors)}>
          <Swatches value={item.color} colors={colors} onChange={(color) => set({ color })} />
        </Field>
        {item.type === 'string' && (
          <Field label="Length" value={`${(item.length ?? 2.4).toFixed(1)} m`}>
            <Slider value={item.length ?? 2.4} min={0.8} max={4} step={0.1} format={(v) => `${v.toFixed(1)} m`} onChange={(length) => set({ length })} />
          </Field>
        )}
      </Section>
      <PositionSection item={item}>
        {mount === 'wall' ? (
          <Field label="Height">
            <NumberInput name="height" value={cm(item.at[1])} min={20} max={260} unit="cm from floor" onChange={(v) => set({ at: [item.at[0], v / 100, item.at[2]] })} />
          </Field>
        ) : (
          <Field label="Rotation" value={deg(item.rotation)}>
            <Slider value={item.rotation} min={0} max={360} step={5} format={deg} onChange={(rotation) => set({ rotation })} />
          </Field>
        )}
      </PositionSection>
    </>
  )
}

// ---------- furniture ----------

const SIT = 0.72
const STAND = 1.1

function FurnitureControls({ item }: { item: FurnitureItem }) {
  const update = useDecor((s) => s.update<FurnitureItem>)
  const set = (patch: Partial<FurnitureItem>) => update(item.id, patch)
  const spec = FURNITURE[item.type]
  const mount = mountOf(item)
  const [w, h, d] = item.size
  const setSize = (i: 0 | 1 | 2, v: number) => {
    const size = [...item.size] as Vec3
    size[i] = Math.max(0.01, v)
    set({ size })
  }
  const isDesk = item.type === 'standingDesk'
  // A desk's height moves with sit/stand, so its presets only fix width and depth.
  const preset = spec.presets?.find((p) => p.size.every((v, i) => (i === 1 && isDesk) || Math.abs(v - item.size[i]) < 0.005))
  const hasSize = !!spec.presets || spec.editable.length > 0 || isDesk
  const finishes = spec.uses

  return (
    <>
      {hasSize && (
        <Section title="Size">
          {spec.presets && (
            <Field label="Preset">
              <Chips
                value={preset?.label ?? 'custom'}
                options={[...spec.presets.map((p) => ({ id: p.label, label: p.label })), ...(preset ? [] : [{ id: 'custom', label: 'Custom' }])]}
                onChange={(label) => {
                  const p = spec.presets!.find((x) => x.label === label)
                  // Keep the desk's current height when switching top sizes.
                  if (p) set({ size: isDesk ? [p.size[0], h, p.size[2]] : ([...p.size] as Vec3) })
                }}
              />
            </Field>
          )}
          {spec.editable.length > 0 && (
            <div className="grid-2">
              {spec.editable.includes('w') && (
                <Field label="Width">
                  <NumberInput name="width" value={cm(w)} min={10} max={400} unit="cm" onChange={(v) => setSize(0, v / 100)} />
                </Field>
              )}
              {spec.editable.includes('d') && (
                <Field label="Depth">
                  <NumberInput name="depth" value={cm(d)} min={2} max={300} unit="cm" onChange={(v) => setSize(2, v / 100)} />
                </Field>
              )}
              {spec.editable.includes('h') && (
                <Field label={item.type === 'hangingRack' ? 'Drop' : 'Height'}>
                  <NumberInput name={item.type === 'hangingRack' ? 'drop' : 'height'} value={cm(h)} min={1} max={260} unit="cm" onChange={(v) => setSize(1, v / 100)} />
                </Field>
              )}
            </div>
          )}
          {isDesk && (
            <Field label="Desk height" value={`${cm(h)} cm`}>
              <Chips
                value={Math.abs(h - SIT) < 0.005 ? 'sit' : Math.abs(h - STAND) < 0.005 ? 'stand' : 'custom'}
                options={[
                  { id: 'sit', label: `Sit · ${cm(SIT)}` },
                  { id: 'stand', label: `Stand · ${cm(STAND)}` },
                ]}
                onChange={(v) => setSize(1, v === 'sit' ? SIT : STAND)}
              />
              <Slider value={h} min={0.62} max={1.27} step={0.01} format={(v) => `${cm(v)} cm`} onChange={(v) => setSize(1, v)} />
            </Field>
          )}
        </Section>
      )}
      {finishes.length > 0 && (
        <Section title="Finish">
          {finishes.includes('body') && (
            <Field label="Body" value={colorName(item.finish.body, BODY_FINISHES)}>
              <Swatches value={item.finish.body} colors={BODY_FINISHES} onChange={(body) => set({ finish: { ...item.finish, body } })} />
            </Field>
          )}
          {finishes.includes('metal') && (
            <Field label="Metal" value={colorName(item.finish.metal, METAL_FINISHES)}>
              <Swatches value={item.finish.metal} colors={METAL_FINISHES} onChange={(metal) => set({ finish: { ...item.finish, metal } })} />
            </Field>
          )}
          {finishes.includes('fabric') && (
            <Field label={item.type === 'butterflyChair' ? 'Sling' : 'Fabric'} value={colorName(item.finish.fabric, FABRIC_FINISHES)}>
              <Swatches value={item.finish.fabric} colors={FABRIC_FINISHES} onChange={(fabric) => set({ finish: { ...item.finish, fabric } })} />
            </Field>
          )}
        </Section>
      )}
      {spec.optionSpecs.length > 0 && (
        <Section title="Options">
          {spec.optionSpecs.map((o) => (
            <OptionControl
              key={o.key}
              spec={o}
              value={item.options[o.key]}
              onChange={(v) => {
                const options = { ...item.options, [o.key]: v }
                set(spec.sizeFor ? { options, size: spec.sizeFor(options, item.size) } : { options })
              }}
            />
          ))}
        </Section>
      )}
      <PositionSection item={item}>
        {mount === 'wall' ? (
          <Field label="Bottom edge">
            <NumberInput name="bottom edge height" value={cm(item.at[1])} min={0} max={250} unit="cm from floor" onChange={(v) => set({ at: [item.at[0], v / 100, item.at[2]] })} />
          </Field>
        ) : (
          <Field label="Facing">
            <Chips value={((Math.round(item.rotation) % 360) + 360) % 360} options={[0, 90, 180, 270].map((r) => ({ id: r, label: `${r}°` }))} onChange={(rotation) => set({ rotation })} />
          </Field>
        )}
      </PositionSection>
    </>
  )
}

function OptionControl({ spec, value, onChange }: { spec: OptionSpec; value: FurnitureItem['options'][string]; onChange: (v: FurnitureItem['options'][string]) => void }) {
  if (spec.kind === 'toggle') return <Switch label={spec.label} checked={value !== false} onChange={onChange} />
  if (spec.kind === 'chips')
    return (
      <Field label={spec.label}>
        <Chips value={value as string} options={spec.choices as { id: string; label: string }[]} onChange={onChange} />
      </Field>
    )
  const unit = spec.unit ? ` ${spec.unit}` : ''
  return (
    <Field label={spec.label} value={`${value}${unit}`}>
      <Slider value={Number(value)} min={spec.min} max={spec.max} step={spec.step} format={(v) => `${v}${unit}`} onChange={onChange} />
    </Field>
  )
}
