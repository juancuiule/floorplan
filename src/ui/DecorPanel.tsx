import { useEffect, useRef, type ChangeEvent, type ReactNode } from 'react'
import { DEFAULT_POT_SIZE, FRAME_COLORS, FRAME_STYLES, LAMPS, MAT_WIDTHS, PLANTS, POT_SIZES, POTS, SIZE_PRESETS, WARMTH } from '../decor/catalog'
import { BODY_FINISHES, FABRIC_FINISHES, FURNITURE, FURNITURE_GROUPS, METAL_FINISHES, type OptionSpec } from '../decor/furnitureCatalog'
import { mountOf } from '../decor/placement'
import { newId, useDecor, type PanelTab } from '../decor/store'
import type { ArtworkItem, DecorItem, FurnitureItem, FurnitureType, LampItem, LampType, PlantItem, PlantSpecies, PotSize, SizePreset } from '../model/decor'
import type { Vec3 } from '../model/types'
import { artworkOuterSize } from '../scene/decor/Artwork'
import { unplacedAt } from '../scene/decor/DecorLayer'

const TABS: { id: PanelTab; label: string; kind: DecorItem['kind'] }[] = [
  { id: 'furniture', label: 'Furniture', kind: 'furniture' },
  { id: 'artwork', label: 'Art', kind: 'artwork' },
  { id: 'plants', label: 'Plants', kind: 'plant' },
  { id: 'lights', label: 'Lights', kind: 'lamp' },
]

const cm = (m: number) => Math.round(m * 1000) / 10
const fileName = (url: string) => decodeURIComponent(url.split('/').pop() ?? '').replace(/\.[^.]+$/, '')

export function itemLabel(item: DecorItem) {
  if (item.kind === 'artwork') return fileName(item.image)
  if (item.kind === 'plant') return PLANTS[item.species].label
  if (item.kind === 'furniture') return FURNITURE[item.type].label
  return LAMPS[item.type].label
}

export function DecorPanel() {
  const tab = useDecor((s) => s.tab)
  const setTab = useDecor((s) => s.setTab)
  const items = useDecor((s) => s.items)
  const selectedId = useDecor((s) => s.selectedId)
  const select = useDecor((s) => s.select)
  const error = useDecor((s) => s.error)
  const selected = items.find((i) => i.id === selectedId)
  const kind = TABS.find((t) => t.id === tab)!.kind
  const placed = items.filter((i) => i.kind === kind && i.at[1] > -50)

  // Selecting something in the scene brings its tab forward.
  useEffect(() => {
    if (selected) setTab(TABS.find((t) => t.kind === selected.kind)!.id)
  }, [selected, setTab])

  return (
    <aside className="panel" aria-label="Decor">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            <span className="count">{items.filter((i) => i.kind === t.kind && i.at[1] > -50).length || ''}</span>
          </button>
        ))}
      </div>
      {error && <p className="note warn">{error}</p>}

      {selected && selected.kind === kind ? (
        <Inspector item={selected} />
      ) : (
        <>
          {tab === 'furniture' && <FurnitureLibrary />}
          {tab === 'artwork' && <ArtworkLibrary />}
          {tab === 'plants' && <PlantLibrary />}
          {tab === 'lights' && <LampLibrary />}
        </>
      )}

      {placed.length > 0 && (
        <section>
          <h3>In the room</h3>
          <ul className="placed">
            {placed.map((i) => (
              <li key={i.id}>
                <button className={i.id === selectedId ? 'on' : ''} onClick={() => select(i.id === selectedId ? null : i.id)}>
                  {i.kind === 'artwork' && <img src={i.image} alt="" />}
                  <span>{itemLabel(i)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}

// ---------- libraries ----------

function ArtworkLibrary() {
  const library = useDecor((s) => s.library)
  const upload = useDecor((s) => s.upload)
  const startPlacing = useDecor((s) => s.startPlacing)
  const input = useRef<HTMLInputElement>(null)

  const place = (url: string, width: number, height: number) => {
    const landscape = width > height * 1.05
    const [pw, ph] = SIZE_PRESETS[1].size
    startPlacing({
      kind: 'artwork',
      id: newId('artwork'),
      image: url,
      at: unplacedAt(),
      facing: 'z+',
      size: { preset: 'A4', w: landscape ? ph : pw, h: landscape ? pw : ph },
      fit: 'cover',
      frame: { style: 'thin', color: FRAME_COLORS[0].color, mat: 0 },
    })
  }

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    for (const f of files) await upload(f)
  }

  return (
    <section>
      <div className="section-head">
        <h3>Choose an image to hang</h3>
        <button className="btn" onClick={() => input.current?.click()}>
          Upload…
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple hidden onChange={onFiles} />
      </div>
      {library.length === 0 && <p className="note">Upload images, or drop them into public/artwork.</p>}
      <div className="thumbs">
        {library.map((img) => (
          <button
            key={img.url}
            className="thumb"
            title={img.name}
            onClick={(e) => {
              const el = e.currentTarget.querySelector('img')!
              place(img.url, el.naturalWidth || 1, el.naturalHeight || 1)
            }}
          >
            <img src={img.url} alt={img.name} loading="lazy" />
          </button>
        ))}
      </div>
    </section>
  )
}

function PlantLibrary() {
  const startPlacing = useDecor((s) => s.startPlacing)
  return (
    <section>
      <h3>Choose a plant</h3>
      <div className="cards">
        {(Object.keys(PLANTS) as PlantSpecies[]).map((sp) => (
          <button
            key={sp}
            className="card"
            onClick={() =>
              startPlacing({
                kind: 'plant',
                id: newId('plant'),
                species: sp,
                pot: PLANTS[sp].pot,
                at: unplacedAt(),
                rotation: sp === 'collection' || sp === 'windowBox' ? 0 : Math.round(Math.random() * 360),
                scale: 1,
                potSize: DEFAULT_POT_SIZE[sp],
                ...(sp === 'collection' ? { count: 10, spread: 0.9 } : {}),
              })
            }
          >
            <strong>{PLANTS[sp].label}</strong>
            <span>{PLANTS[sp].note}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function LampLibrary() {
  const startPlacing = useDecor((s) => s.startPlacing)
  return (
    <section>
      <h3>Choose a light</h3>
      <div className="cards">
        {(Object.keys(LAMPS) as LampType[]).map((t) => (
          <button
            key={t}
            className="card"
            onClick={() =>
              startPlacing({
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
              })
            }
          >
            <strong>{LAMPS[t].label}</strong>
            <span>{LAMPS[t].note}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ---------- inspector ----------

function Inspector({ item }: { item: DecorItem }) {
  const select = useDecor((s) => s.select)
  const remove = useDecor((s) => s.remove)
  const duplicate = useDecor((s) => s.duplicate)
  const relocate = useDecor((s) => s.startRelocating)
  return (
    <section className="inspector">
      <div className="section-head">
        <h3 title={itemLabel(item)}>{itemLabel(item)}</h3>
        <button className="btn ghost" onClick={() => select(null)}>
          Done
        </button>
      </div>
      {item.kind === 'artwork' && <ArtworkControls item={item} />}
      {item.kind === 'plant' && <PlantControls item={item} />}
      {item.kind === 'lamp' && <LampControls item={item} />}
      {item.kind === 'furniture' && <FurnitureControls item={item} />}
      <div className="actions">
        <button className="btn" onClick={() => relocate(item.id)}>
          Move
        </button>
        <button className="btn" onClick={() => duplicate(item.id)}>
          Duplicate
        </button>
        <button className="btn danger" onClick={() => remove(item.id)}>
          Delete
        </button>
      </div>
      <p className="note">Drag it in the scene to move it. {mountOf(item) === 'surface' && 'R rotates.'} Delete removes it.</p>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="control">{children}</div>
    </div>
  )
}

function Chips<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="chips" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.id)} role="radio" aria-checked={o.id === value} className={o.id === value ? 'on' : ''} disabled={disabled} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Swatches({ value, colors, onChange }: { value: string; colors: { label: string; color: string }[]; onChange: (c: string) => void }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button key={c.color} title={c.label} aria-label={c.label} className={c.color === value ? 'on' : ''} style={{ background: c.color }} onClick={() => onChange(c.color)} />
      ))}
      <label className="custom-color" title="Custom color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
      </label>
    </div>
  )
}

function NumberInput({ value, onChange, min, max, step = 1, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="number">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  )
}

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
      <Field label="Print size">
        <Chips value={item.size.preset} options={[...SIZE_PRESETS.map((p) => ({ id: p.id as SizePreset, label: p.label })), { id: 'custom', label: 'Custom' }]} onChange={setPreset} />
      </Field>
      {item.size.preset === 'custom' && (
        <Field label="Custom size">
          <div className="row">
            <NumberInput value={cm(item.size.w)} min={5} max={200} suffix="cm W" onChange={(v) => set({ size: { ...item.size, w: v / 100 } })} />
            <NumberInput value={cm(item.size.h)} min={5} max={200} suffix="cm H" onChange={(v) => set({ size: { ...item.size, h: v / 100 } })} />
          </div>
        </Field>
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
            { id: 'cover', label: 'Fill (crop)' },
            { id: 'contain', label: 'Whole image' },
          ]}
          onChange={(fit) => set({ fit })}
        />
      </Field>
      <Field label="Frame">
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
        <Field label={style.id === 'canvas' ? 'Edge color' : 'Frame color'}>
          <Swatches value={item.frame.color} colors={FRAME_COLORS} onChange={(color) => set({ frame: { ...item.frame, color } })} />
        </Field>
      )}
      <Field label="Mat (passe-partout)">
        <Chips value={item.frame.mat} disabled={!allowsMat} options={MAT_WIDTHS.map((m) => ({ id: m, label: m ? `${cm(m)} cm` : 'None' }))} onChange={(mat) => set({ frame: { ...item.frame, mat } })} />
      </Field>
      <Field label="Center height">
        <NumberInput value={cm(item.at[1])} min={20} max={250} suffix="cm from floor" onChange={(v) => set({ at: [item.at[0], v / 100, item.at[2]] })} />
      </Field>
      <p className="readout">
        Outer size {cm(ow)} × {cm(oh)} cm · top edge at {cm(item.at[1] + oh / 2)} cm
      </p>
    </>
  )
}

function PlantControls({ item }: { item: PlantItem }) {
  const update = useDecor((s) => s.update<PlantItem>)
  const set = (patch: Partial<PlantItem>) => update(item.id, patch)
  return (
    <>
      <Field label="Plant">
        <select value={item.species} onChange={(e) => set({ species: e.target.value as PlantSpecies })}>
          {(Object.keys(PLANTS) as PlantSpecies[]).map((sp) => (
            <option key={sp} value={sp} disabled={PLANTS[sp].mount !== PLANTS[item.species].mount}>
              {PLANTS[sp].label}
            </option>
          ))}
        </select>
      </Field>
      {item.species !== 'collection' && item.species !== 'windowBox' && (
        <Field label="Clay pot size">
          <Chips value={item.potSize ?? 'auto'} options={POT_SIZES} onChange={(potSize: PotSize) => set({ potSize })} />
        </Field>
      )}
      {(item.potSize ?? 'auto') === 'auto' && item.species !== 'collection' && (
        <Field label="Pot">
          <Swatches value={POTS.find((p) => p.id === item.pot)!.color} colors={POTS.map((p) => ({ label: p.label, color: p.color }))} onChange={(c) => set({ pot: POTS.find((p) => p.color === c)?.id ?? item.pot })} />
        </Field>
      )}
      {item.species === 'collection' && (
        <>
          <Field label={`Pots · ${item.count ?? 10}`}>
            <input type="range" min={2} max={30} step={1} value={item.count ?? 10} onChange={(e) => set({ count: parseInt(e.target.value) })} />
          </Field>
          <Field label={`Strip width · ${cm(item.spread ?? 0.9)} cm`}>
            <input type="range" min={0.2} max={2.5} step={0.05} value={item.spread ?? 0.9} onChange={(e) => set({ spread: parseFloat(e.target.value) })} />
          </Field>
          <Field label="Mix">
            <button className="btn" onClick={() => set({ seed: Math.random().toString(36).slice(2, 8) })}>
              Shuffle plants
            </button>
          </Field>
        </>
      )}
      <Field label={`Size · ${Math.round(item.scale * 100)}%`}>
        <input type="range" min={0.5} max={1.6} step={0.05} value={item.scale} onChange={(e) => set({ scale: parseFloat(e.target.value) })} />
      </Field>
      <Field label={`Rotation · ${Math.round(item.rotation)}°`}>
        <input type="range" min={0} max={360} step={5} value={item.rotation} onChange={(e) => set({ rotation: parseFloat(e.target.value) })} />
      </Field>
    </>
  )
}

function LampControls({ item }: { item: LampItem }) {
  const update = useDecor((s) => s.update<LampItem>)
  const set = (patch: Partial<LampItem>) => update(item.id, patch)
  const mount = mountOf(item)
  return (
    <>
      <Field label="Power">
        <Chips
          value={item.on ? 'on' : 'off'}
          options={[
            { id: 'on', label: 'On' },
            { id: 'off', label: 'Off' },
          ]}
          onChange={(v) => set({ on: v === 'on' })}
        />
      </Field>
      <Field label={`Brightness · ${Math.round(item.brightness * 100)}%`}>
        <input type="range" min={0.1} max={2} step={0.05} value={item.brightness} onChange={(e) => set({ brightness: parseFloat(e.target.value) })} />
      </Field>
      <Field label="Warmth">
        <Chips value={item.warmth} options={WARMTH.map((w) => ({ id: w.id, label: w.label }))} onChange={(warmth) => set({ warmth })} />
      </Field>
      <Field label="Color">
        <Swatches value={item.color} colors={[{ label: 'Linen', color: LAMPS[item.type].color }, ...FRAME_COLORS]} onChange={(color) => set({ color })} />
      </Field>
      {item.type === 'string' && (
        <Field label={`Length · ${(item.length ?? 2.4).toFixed(1)} m`}>
          <input type="range" min={0.8} max={4} step={0.1} value={item.length ?? 2.4} onChange={(e) => set({ length: parseFloat(e.target.value) })} />
        </Field>
      )}
      {mount === 'wall' && (
        <Field label="Height">
          <NumberInput value={cm(item.at[1])} min={20} max={260} suffix="cm from floor" onChange={(v) => set({ at: [item.at[0], v / 100, item.at[2]] })} />
        </Field>
      )}
      {mount !== 'wall' && (
        <Field label={`Rotation · ${Math.round(item.rotation)}°`}>
          <input type="range" min={0} max={360} step={5} value={item.rotation} onChange={(e) => set({ rotation: parseFloat(e.target.value) })} />
        </Field>
      )}
    </>
  )
}

// ---------- furniture ----------

function FurnitureLibrary() {
  const startPlacing = useDecor((s) => s.startPlacing)
  return (
    <section>
      <h3>Choose a piece</h3>
      {FURNITURE_GROUPS.map((group) => (
        <div key={group} className="group-block">
          <span className="group-label">{group}</span>
          <div className="cards">
            {(Object.keys(FURNITURE) as FurnitureType[])
              .filter((t) => FURNITURE[t].group === group)
              .map((t) => {
                const spec = FURNITURE[t]
                return (
                  <button
                    key={t}
                    className="card"
                    onClick={() =>
                      startPlacing({
                        kind: 'furniture',
                        id: newId('furniture'),
                        type: t,
                        at: unplacedAt(),
                        rotation: 0,
                        size: [...spec.size] as Vec3,
                        finish: { ...spec.finish },
                        options: { ...spec.options },
                      })
                    }
                  >
                    <strong>{spec.label}</strong>
                    <span>
                      {spec.note} · {cm(spec.size[0])}×{cm(spec.size[2])}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </section>
  )
}

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
  // A desk's height moves with sit/stand, so its presets only fix width and depth.
  const preset = spec.presets?.find((p) => p.size.every((v, i) => (i === 1 && item.type === 'standingDesk') || Math.abs(v - item.size[i]) < 0.005))

  return (
    <>
      {spec.presets && (
        <Field label="Size">
          <Chips
            value={preset?.label ?? 'custom'}
            options={[...spec.presets.map((p) => ({ id: p.label, label: p.label })), ...(preset ? [] : [{ id: 'custom', label: 'Custom' }])]}
            onChange={(label) => {
              const p = spec.presets!.find((x) => x.label === label)
              // Keep the desk's current height when switching top sizes.
              if (p) set({ size: item.type === 'standingDesk' ? [p.size[0], h, p.size[2]] : ([...p.size] as Vec3) })
            }}
          />
        </Field>
      )}
      {spec.editable.length > 0 && (
        <Field label="Dimensions">
          <div className="row wrap">
            {spec.editable.includes('w') && <NumberInput value={cm(w)} min={10} max={400} suffix="W" onChange={(v) => setSize(0, v / 100)} />}
            {spec.editable.includes('d') && <NumberInput value={cm(d)} min={2} max={300} suffix="D" onChange={(v) => setSize(2, v / 100)} />}
            {spec.editable.includes('h') && (
              <NumberInput value={cm(h)} min={1} max={260} suffix={item.type === 'hangingRack' ? 'drop' : 'H'} onChange={(v) => setSize(1, v / 100)} />
            )}
          </div>
        </Field>
      )}
      {item.type === 'standingDesk' && (
        <Field label={`Desk height · ${cm(h)} cm`}>
          <Chips
            value={Math.abs(h - SIT) < 0.005 ? 'sit' : Math.abs(h - STAND) < 0.005 ? 'stand' : 'custom'}
            options={[
              { id: 'sit', label: `Sit · ${cm(SIT)}` },
              { id: 'stand', label: `Stand · ${cm(STAND)}` },
            ]}
            onChange={(v) => setSize(1, v === 'sit' ? SIT : STAND)}
          />
          <input type="range" min={0.62} max={1.27} step={0.01} value={h} onChange={(e) => setSize(1, parseFloat(e.target.value))} />
        </Field>
      )}
      {spec.uses.includes('body') && (
        <Field label="Wood / body">
          <Swatches value={item.finish.body} colors={BODY_FINISHES} onChange={(body) => set({ finish: { ...item.finish, body } })} />
        </Field>
      )}
      {spec.uses.includes('metal') && (
        <Field label="Metal">
          <Swatches value={item.finish.metal} colors={METAL_FINISHES} onChange={(metal) => set({ finish: { ...item.finish, metal } })} />
        </Field>
      )}
      {spec.uses.includes('fabric') && (
        <Field label={item.type === 'butterflyChair' ? 'Sling' : 'Fabric'}>
          <Swatches value={item.finish.fabric} colors={FABRIC_FINISHES} onChange={(fabric) => set({ finish: { ...item.finish, fabric } })} />
        </Field>
      )}
      {spec.optionSpecs.map((o) => (
        <OptionControl key={o.key} spec={o} value={item.options[o.key]} onChange={(v) => set({ options: { ...item.options, [o.key]: v } })} />
      ))}
      {mount === 'wall' && (
        <Field label="Bottom edge">
          <NumberInput value={cm(item.at[1])} min={0} max={250} suffix="cm from floor" onChange={(v) => set({ at: [item.at[0], v / 100, item.at[2]] })} />
        </Field>
      )}
      {mount !== 'wall' && (
        <Field label="Facing">
          <Chips
            value={Math.round(item.rotation) % 360}
            options={[0, 90, 180, 270].map((r) => ({ id: r, label: `${r}°` }))}
            onChange={(rotation) => set({ rotation })}
          />
        </Field>
      )}
    </>
  )
}

function OptionControl({ spec, value, onChange }: { spec: OptionSpec; value: FurnitureItem['options'][string]; onChange: (v: FurnitureItem['options'][string]) => void }) {
  if (spec.kind === 'toggle')
    return (
      <Field label={spec.label}>
        <Chips
          value={value === false ? 'no' : 'yes'}
          options={[
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
          ]}
          onChange={(v) => onChange(v === 'yes')}
        />
      </Field>
    )
  if (spec.kind === 'chips')
    return (
      <Field label={spec.label}>
        <Chips value={value as string} options={spec.choices as { id: string; label: string }[]} onChange={onChange} />
      </Field>
    )
  return (
    <Field label={`${spec.label} · ${value}`}>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={Number(value)} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </Field>
  )
}
