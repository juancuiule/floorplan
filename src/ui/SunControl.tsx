import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useView } from '../store'
import { compassBearing, compassName, formatMinutes, sunTimes, todayIn, type Compass } from '../sun/solar'
import { Icon } from './icons'
import './sunControl.css'

/** A whole day plays in this long. */
const DAY_MS = 12000
const STEP = 15

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

/** Southern hemisphere: December is summer. */
const QUICK_DATES: { label: string; tip: string; md: string }[] = [
  { label: 'Dec 21', tip: 'Summer solstice: the highest sun', md: '12-21' },
  { label: 'Mar 20', tip: 'Equinox', md: '03-20' },
  { label: 'Jun 21', tip: 'Winter solstice: the lowest sun', md: '06-21' },
]

// Compass rose, read like a map: north up.
const ROSE: (Compass | null)[] = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE']

/** , and . step the time by 15 minutes ([ and ] belong to the editor). */
function useSunShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (e.key !== ',' && e.key !== '.') return
      const t = e.target as HTMLElement
      if (t.closest('input, select, textarea, [contenteditable="true"]')) return
      const { sun, setSun, setPlaying } = useView.getState()
      const m = sun.minutes
      setPlaying(false)
      setSun({ minutes: e.key === '.' ? Math.floor(m / STEP) * STEP + STEP : Math.ceil(m / STEP) * STEP - STEP })
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Advances the clock while playing; the scene only renders while the time changes. */
function usePlayback() {
  const playing = useView((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      const dt = Math.min(now - last, 100)
      last = now
      const { sun, setSun } = useView.getState()
      setSun({ minutes: sun.minutes + (dt / DAY_MS) * 1440 })
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [playing])
}

export function SunControl() {
  const minutes = useView((s) => s.sun.minutes)
  const date = useView((s) => s.sun.date)
  const night = useView((s) => s.lighting === 'evening')
  const playing = useView((s) => s.playing)
  const setPlaying = useView((s) => s.setPlaying)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useSunShortcuts()
  usePlayback()

  return (
    <div className="sun-wrap">
      <div className="group" role="group" aria-label="Sun">
        <button
          type="button"
          aria-pressed={playing}
          aria-label={playing ? 'Pause the day' : 'Play the day'}
          data-tip={playing ? 'Pause' : 'Play the day'}
          onClick={() => setPlaying(!playing)}
        >
          <PlayIcon playing={playing} />
        </button>
        <button
          ref={triggerRef}
          type="button"
          className="sun-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tip="Sun study: time, date and orientation (, and . step 15 min)"
          aria-keyshortcuts=", ."
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={night ? 'moon' : 'sun'} />
          <span className="sun-clock">{formatMinutes(minutes)}</span>
          <span className="sun-date tb-label opt">{shortDate(date)}</span>
        </button>
      </div>
      {open && <SunPopover onClose={close} triggerRef={triggerRef} />}
    </div>
  )
}

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg className="icon" width={16} height={16} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
      {playing ? <path d="M6 4.5h2.5v11H6zM11.5 4.5H14v11h-2.5z" /> : <path d="M6.5 4.2v11.6L15.5 10z" />}
    </svg>
  )
}

function SunPopover({ onClose, triggerRef }: { onClose: () => void; triggerRef: React.RefObject<HTMLButtonElement | null> }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const sun = useView((s) => s.sun)
  const solar = useView((s) => s.solar)
  const night = useView((s) => s.lighting === 'evening')
  const { setSun, setPlaying } = useView.getState()
  const times = sunTimes(sun.date)
  const year = sun.date.slice(0, 4)
  const today = todayIn()
  const facingName = compassName(sun.facing)

  useEffect(() => {
    ref.current?.focus()
    const trigger = triggerRef.current
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !trigger?.contains(t)) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      if (!document.activeElement || document.activeElement === document.body || ref.current?.contains(document.activeElement)) trigger?.focus()
    }
  }, [onClose, triggerRef])

  const pct = (m: number) => `${((m / 1440) * 100).toFixed(2)}%`
  const status = night
    ? 'Night: lamps on'
    : solar.elevation < 0
      ? 'Twilight'
      : `Sun ${Math.round(solar.elevation)}° up, bearing ${Math.round(solar.azimuth)}°`

  return (
    <div
      ref={ref}
      className="popover sun-pop"
      role="dialog"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          e.nativeEvent.stopImmediatePropagation()
          onClose()
        }
      }}
    >
      <div className="popover-head">
        <h2 id={`${id}-title`}>Sun study</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>

      <section>
        <div className="sun-row">
          <label htmlFor={`${id}-time`} className="group-label">
            Time
          </label>
          <output htmlFor={`${id}-time`} className="sun-now">
            {formatMinutes(sun.minutes)}
          </output>
        </div>
        <div className="sun-slider" style={{ '--rise': pct(times.sunrise), '--set': pct(times.sunset) } as React.CSSProperties}>
          <input
            id={`${id}-time`}
            type="range"
            min={0}
            max={1439}
            step={5}
            value={Math.round(sun.minutes)}
            aria-valuetext={formatMinutes(sun.minutes)}
            onChange={(e) => {
              setPlaying(false)
              setSun({ minutes: Number(e.target.value) })
            }}
          />
          {Number.isFinite(times.sunrise) && (
            <span className="sun-mark" style={{ left: pct(times.sunrise) }}>
              Sunrise {formatMinutes(times.sunrise)}
            </span>
          )}
          {Number.isFinite(times.sunset) && (
            <span className="sun-mark" style={{ left: pct(times.sunset) }}>
              Sunset {formatMinutes(times.sunset)}
            </span>
          )}
        </div>
        <p className="sun-status">{status}</p>
      </section>

      <section>
        <div className="sun-row">
          <label htmlFor={`${id}-date`} className="group-label">
            Date
          </label>
          <input
            id={`${id}-date`}
            className="sun-date-input"
            type="date"
            value={sun.date}
            required
            onChange={(e) => e.target.value && setSun({ date: e.target.value })}
          />
        </div>
        <div className="chips sun-chips">
          {QUICK_DATES.map((q) => {
            const iso = `${year}-${q.md}`
            return (
              <button key={q.md} type="button" aria-pressed={sun.date === iso} title={q.tip} onClick={() => setSun({ date: iso })}>
                {q.label}
              </button>
            )
          })}
          <button type="button" aria-pressed={sun.date === today} onClick={() => setSun({ date: today })}>
            Today
          </button>
        </div>
      </section>

      <section className="sun-facing">
        <div>
          <h3 className="group-label" id={`${id}-facing`}>
            Balcony faces
          </h3>
          <p className="sun-hint">Saved with the apartment. {facingName ? `Facing ${facingName}.` : `Bearing ${Math.round(sun.facing)}°.`}</p>
        </div>
        <div className="rose" role="radiogroup" aria-labelledby={`${id}-facing`}>
          {ROSE.map((c, i) =>
            c ? (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={facingName === c}
                onClick={() => setSun({ facing: compassBearing(c) })}
              >
                {c}
              </button>
            ) : (
              <label key={i} className="rose-center">
                <span className="sr-only">Bearing in degrees</span>
                <input
                  type="number"
                  min={0}
                  max={359}
                  step={5}
                  value={Math.round(sun.facing)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) setSun({ facing: ((v % 360) + 360) % 360 })
                  }}
                />
                <span aria-hidden="true">°</span>
              </label>
            ),
          )}
        </div>
      </section>
      <p className="sun-hint">
        Buenos Aires, UTC−3. <kbd>,</kbd> <kbd>.</kbd> step 15 minutes.
      </p>
    </div>
  )
}
