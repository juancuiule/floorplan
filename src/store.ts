import { create } from 'zustand'
import type { Vec2 } from './model/types'

export type ViewMode = 'dollhouse' | 'xray'
export type ViewPreset = 'iso-balcony' | 'iso-entry' | 'top' | 'from-balcony' | 'from-entry'
export type SceneTool = 'measure' | null

/** Eye heights for walk mode, in meters. */
export const EYE_STANDING = 1.6
export const EYE_SEATED = 1.15
export const EYE_MIN = 1.0
export const EYE_MAX = 1.9

interface ViewState {
  mode: ViewMode
  preset: ViewPreset
  /** Bumped on every preset request so re-selecting the same preset re-frames. */
  presetNonce: number
  showDims: boolean
  lighting: 'day' | 'evening'
  /** Evening only: the recessed ceiling downlights. */
  downlights: boolean
  setLighting: (lighting: 'day' | 'evening') => void
  toggleDownlights: () => void
  setMode: (mode: ViewMode) => void
  goTo: (preset: ViewPreset) => void
  toggleDims: () => void
  /** First-person walk mode; the orbit view comes back when it ends. */
  walking: boolean
  /** Where the walk starts (plan x, z); null = at the entry. */
  walkFrom: Vec2 | null
  eyeHeight: number
  enterWalk: (from?: Vec2 | null) => void
  exitWalk: () => void
  setEyeHeight: (h: number) => void
  /** A tool that takes over clicks in the scene. */
  tool: SceneTool
  setTool: (tool: SceneTool) => void
  /** Distances from the selected floor piece to its surroundings. */
  clearances: boolean
  toggleClearances: () => void
}

const params = new URLSearchParams(window.location.search)

export const useView = create<ViewState>((set) => ({
  mode: params.get('mode') === 'xray' ? 'xray' : 'dollhouse',
  preset: (params.get('view') as ViewPreset) || 'iso-balcony',
  presetNonce: 0,
  showDims: params.get('dims') !== '0',
  lighting: params.get('light') === 'evening' ? 'evening' : 'day',
  downlights: params.get('downlights') !== '0',
  setLighting: (lighting) => set({ lighting }),
  toggleDownlights: () => set((s) => ({ downlights: !s.downlights })),
  setMode: (mode) => set({ mode }),
  // A camera preset ends a walk: the preset takes over the camera.
  goTo: (preset) => set((s) => ({ preset, presetNonce: s.presetNonce + 1, walking: false })),
  toggleDims: () => set((s) => ({ showDims: !s.showDims })),
  walking: false,
  walkFrom: null,
  eyeHeight: EYE_STANDING,
  enterWalk: (from = null) => set({ walking: true, walkFrom: from }),
  exitWalk: () => set({ walking: false }),
  setEyeHeight: (h) => set({ eyeHeight: Math.min(EYE_MAX, Math.max(EYE_MIN, h)) }),
  tool: null,
  setTool: (tool) => set({ tool }),
  clearances: params.get('clearances') === '1',
  toggleClearances: () => set((s) => ({ clearances: !s.clearances })),
}))
