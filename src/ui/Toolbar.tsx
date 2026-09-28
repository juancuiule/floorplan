import { PRESETS } from '../scene/CameraRig'
import { useView, type ViewMode, type ViewPreset } from '../store'

const MODES: { id: ViewMode; label: string }[] = [
  { id: 'dollhouse', label: 'Dollhouse' },
  { id: 'xray', label: 'X-ray' },
]

export function Toolbar() {
  const { mode, preset, showDims, setMode, goTo, toggleDims } = useView()
  return (
    <div className="toolbar">
      <div className="title">
        <strong>Monoambiente</strong>
        <span>6.90 × 3.00 + balcony 1.30</span>
      </div>
      <div className="group" role="radiogroup" aria-label="View mode">
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="group" aria-label="Camera">
        {(Object.keys(PRESETS) as ViewPreset[]).map((p) => (
          <button key={p} className={preset === p ? 'on' : ''} onClick={() => goTo(p)}>
            {PRESETS[p].label}
          </button>
        ))}
      </div>
      <div className="group">
        <button aria-pressed={showDims} className={showDims ? 'on' : ''} onClick={toggleDims}>
          Dimensions
        </button>
      </div>
    </div>
  )
}
