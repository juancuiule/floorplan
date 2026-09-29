import { useCallback, useEffect, useRef, useState } from 'react'
import { PRESETS } from '../scene/CameraRig'
import { useView, type ViewMode, type ViewPreset } from '../store'
import { onRadioKeys } from './controlUtils'
import { Icon, type IconName } from './icons'
import { ShortcutsPopover } from './ShortcutsPopover'
import { SunControl } from './SunControl'
import { useUi } from './uiStore'

const MODES: { id: ViewMode; label: string; icon: IconName; tip: string }[] = [
  { id: 'dollhouse', label: 'Dollhouse', icon: 'dollhouse', tip: 'Cut away the walls facing you (X)' },
  { id: 'xray', label: 'X-ray', icon: 'xray', tip: 'See through every wall (X)' },
]

const PRESET_IDS = Object.keys(PRESETS) as ViewPreset[]

/** Plain-key shortcuts for the view; editing shortcuts live with the scene. */
function useViewShortcuts(toggleHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement
      if (t.closest('input, select, textarea, [contenteditable="true"]')) return
      const v = useView.getState()
      const ui = useUi.getState()
      const n = Number(e.key)
      if (n >= 1 && n <= PRESET_IDS.length) v.goTo(PRESET_IDS[n - 1])
      else if (e.key === 'x' || e.key === 'X') v.setMode(v.mode === 'xray' ? 'dollhouse' : 'xray')
      else if (e.key === 'm' || e.key === 'M') v.toggleDims()
      else if (e.key === 'l' || e.key === 'L') v.setLighting(v.lighting === 'day' ? 'evening' : 'day')
      else if (e.key === '\\') ui.togglePanel()
      else if (e.key === '?') toggleHelp()
      else if (e.key === '/') {
        if (!ui.panelOpen) ui.setPanelOpen(true)
        requestAnimationFrame(() => document.getElementById('decor-search')?.focus())
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleHelp])
}

export function Toolbar() {
  const mode = useView((s) => s.mode)
  const preset = useView((s) => s.preset)
  const showDims = useView((s) => s.showDims)
  const lighting = useView((s) => s.lighting)
  const downlights = useView((s) => s.downlights)
  const { setMode, goTo, toggleDims, setLighting, toggleDownlights } = useView.getState()
  const panelOpen = useUi((s) => s.panelOpen)
  const togglePanel = useUi((s) => s.togglePanel)
  const [help, setHelp] = useState(false)
  const helpRef = useRef<HTMLButtonElement>(null)
  const closeHelp = useCallback(() => setHelp(false), [])
  const toggleHelp = useCallback(() => setHelp((h) => !h), [])
  useViewShortcuts(toggleHelp)

  const modeIndex = MODES.findIndex((m) => m.id === mode)
  const presetIndex = PRESET_IDS.indexOf(preset)
  const lights = ['day', 'evening'] as const

  return (
    <div className="toolbar">
      <div className="title">
        <h1>Monoambiente</h1>
        <span>6.90 × 3.00 m + 1.30 m balcony</span>
      </div>

      <div className="tb-main">
        <div className="group" role="radiogroup" aria-label="View mode" onKeyDown={(e) => onRadioKeys(e, MODES.map((m) => m.id), modeIndex, setMode)}>
          {MODES.map((m, i) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} tabIndex={i === modeIndex ? 0 : -1} data-tip={m.tip} aria-keyshortcuts="X" onClick={() => setMode(m.id)}>
              <Icon name={m.icon} />
              <span className="tb-label">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="group cameras" role="radiogroup" aria-label="Camera" onKeyDown={(e) => onRadioKeys(e, PRESET_IDS, presetIndex, goTo)}>
          {PRESET_IDS.map((p, i) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={preset === p}
              tabIndex={i === presetIndex ? 0 : -1}
              data-tip={`Camera ${i + 1}`}
              aria-keyshortcuts={String(i + 1)}
              onClick={() => goTo(p)}
            >
              {PRESETS[p].label}
            </button>
          ))}
        </div>
        <label className="group camera-select">
          <Icon name="camera" />
          <span className="sr-only">Camera</span>
          <select value={preset} onChange={(e) => goTo(e.target.value as ViewPreset)}>
            {PRESET_IDS.map((p) => (
              <option key={p} value={p}>
                {PRESETS[p].label}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} className="select-chevron" />
        </label>

        <div className="group">
          <button type="button" aria-pressed={showDims} data-tip="Show room dimensions (M)" aria-keyshortcuts="M" onClick={toggleDims}>
            <Icon name="ruler" />
            <span className="tb-label opt">Dimensions</span>
          </button>
        </div>

        <div className="group" role="group" aria-label="Lighting">
          <div role="radiogroup" aria-label="Time of day" className="sub" onKeyDown={(e) => onRadioKeys(e, [...lights], lights.indexOf(lighting), setLighting)}>
            {lights.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lighting === l}
                tabIndex={lighting === l ? 0 : -1}
                data-tip={l === 'day' ? 'Afternoon sun, 15:00 (L)' : 'Evening, 21:00, lamps on (L)'}
                aria-keyshortcuts="L"
                onClick={() => setLighting(l)}
              >
                <Icon name={l === 'day' ? 'sun' : 'moon'} />
                <span className="tb-label opt">{l === 'day' ? 'Day' : 'Evening'}</span>
              </button>
            ))}
          </div>
          {lighting === 'evening' && (
            <button type="button" aria-pressed={downlights} data-tip="Recessed ceiling lights" onClick={toggleDownlights}>
              <Icon name="downlight" />
              <span className="tb-label">Downlights</span>
            </button>
          )}
        </div>
        <SunControl />
      </div>

      <div className="tb-end">
        <div className="help-wrap">
          <button
            ref={helpRef}
            type="button"
            className="round"
            aria-label="Keyboard shortcuts"
            aria-haspopup="dialog"
            aria-expanded={help}
            aria-keyshortcuts="?"
            data-tip="Keyboard shortcuts (?)"
            onClick={toggleHelp}
          >
            <Icon name="help" />
          </button>
          {help && <ShortcutsPopover onClose={closeHelp} triggerRef={helpRef} />}
        </div>
        <button
          type="button"
          className="round"
          aria-label={panelOpen ? 'Hide panel' : 'Show panel'}
          aria-expanded={panelOpen}
          aria-controls="decor-panel"
          aria-keyshortcuts="\"
          data-tip={`${panelOpen ? 'Hide' : 'Show'} panel (\\)`}
          data-tip-end=""
          onClick={togglePanel}
        >
          <Icon name="panel" />
        </button>
      </div>
    </div>
  )
}
