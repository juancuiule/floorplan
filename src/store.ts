import { create } from 'zustand'
import { duskLevel, NIGHT_BELOW } from './sun/daylight'
import { isIsoDate, parseClock, parseFacing, solarPosition, todayIn, type SunPosition } from './sun/solar'

export type ViewMode = 'dollhouse' | 'xray'
export type ViewPreset = 'iso-balcony' | 'iso-entry' | 'top' | 'from-balcony' | 'from-entry'
export type Lighting = 'day' | 'evening'

export interface SunSettings {
  /** Local date in Buenos Aires, "YYYY-MM-DD". */
  date: string
  /** Minutes after local midnight, 0–1440 (fractional while the day plays). */
  minutes: number
  /** Compass bearing the balcony faces (the plan's +x), degrees clockwise from north. */
  facing: number
}

/** Quick presets behind the Day / Evening toggle and the L key. */
export const LIGHTING_PRESETS: Record<Lighting, number> = { day: 15 * 60, evening: 21 * 60 }

interface ViewState {
  mode: ViewMode
  preset: ViewPreset
  /** Bumped on every preset request so re-selecting the same preset re-frames. */
  presetNonce: number
  showDims: boolean
  sun: SunSettings
  /** Derived from `sun`: where the sun is. */
  solar: SunPosition
  /** Derived: 'evening' once the sun is below NIGHT_BELOW, when lamps and downlights switch on. */
  lighting: Lighting
  /** Derived: lamp shade glow, 0 by day to 1 at night, in 0.1 steps. */
  dusk: number
  /** The day is animating. */
  playing: boolean
  /** Evening only: the recessed ceiling downlights. */
  downlights: boolean
  /** Jumps to today at the preset time. */
  setLighting: (lighting: Lighting) => void
  setSun: (sun: Partial<SunSettings>) => void
  setPlaying: (playing: boolean) => void
  toggleDownlights: () => void
  setMode: (mode: ViewMode) => void
  goTo: (preset: ViewPreset) => void
  toggleDims: () => void
}

const params = new URLSearchParams(window.location.search)
const SUN_KEY = 'monoambiente.sun'

function readSavedSun(): Partial<SunSettings> {
  try {
    const s = JSON.parse(localStorage.getItem(SUN_KEY) ?? '{}')
    return {
      facing: typeof s.facing === 'number' ? s.facing : undefined,
      date: isIsoDate(s.date) ? s.date : undefined,
      minutes: typeof s.minutes === 'number' ? s.minutes : undefined,
    }
  } catch {
    return {}
  }
}

/** URL (?sun=HH:MM&date=YYYY-MM-DD&facing=N, or ?light=evening) wins over what was saved. */
function initialSun(): SunSettings {
  const saved = readSavedSun()
  const urlMinutes = parseClock(params.get('sun')) ?? (params.get('light') === 'evening' ? LIGHTING_PRESETS.evening : null)
  const urlDate = params.get('date')
  return {
    facing: parseFacing(params.get('facing')) ?? saved.facing ?? 0,
    date: isIsoDate(urlDate) ? urlDate : urlMinutes !== null ? todayIn() : (saved.date ?? todayIn()),
    minutes: urlMinutes ?? saved.minutes ?? LIGHTING_PRESETS.day,
  }
}

function derive(sun: SunSettings) {
  const solar = solarPosition(sun.date, sun.minutes)
  return { solar, lighting: (solar.elevation < NIGHT_BELOW ? 'evening' : 'day') as Lighting, dusk: duskLevel(solar.elevation) }
}

const sun0 = initialSun()

export const useView = create<ViewState>((set) => ({
  mode: params.get('mode') === 'xray' ? 'xray' : 'dollhouse',
  preset: (params.get('view') as ViewPreset) || 'iso-balcony',
  presetNonce: 0,
  showDims: params.get('dims') !== '0',
  sun: sun0,
  ...derive(sun0),
  playing: false,
  downlights: params.get('downlights') !== '0',
  setLighting: (lighting) =>
    set((s) => {
      const sun = { ...s.sun, date: todayIn(), minutes: LIGHTING_PRESETS[lighting] }
      return { sun, ...derive(sun), playing: false }
    }),
  setSun: (patch) =>
    set((s) => {
      const sun = { ...s.sun, ...patch }
      sun.minutes = ((sun.minutes % 1440) + 1440) % 1440
      return { sun, ...derive(sun) }
    }),
  setPlaying: (playing) => set({ playing }),
  toggleDownlights: () => set((s) => ({ downlights: !s.downlights })),
  setMode: (mode) => set({ mode }),
  goTo: (preset) => set((s) => ({ preset, presetNonce: s.presetNonce + 1 })),
  toggleDims: () => set((s) => ({ showDims: !s.showDims })),
}))

// The balcony's orientation belongs to the apartment; the time is where you left it.
// URL-driven sessions (screenshots) don't overwrite what you saved.
let saveTimer: ReturnType<typeof setTimeout> | undefined
if (!params.has('sun') && !params.has('facing') && !params.has('light')) {
  useView.subscribe((s, prev) => {
    if ((s.sun === prev.sun && s.playing === prev.playing) || s.playing) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const { facing, date, minutes } = useView.getState().sun
        localStorage.setItem(SUN_KEY, JSON.stringify({ facing, date, minutes: Math.round(minutes) }))
      } catch {
        /* private mode: keep it for this visit only */
      }
    }, 300)
  })
}
