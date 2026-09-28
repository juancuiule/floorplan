import { create } from 'zustand'

export type ViewMode = 'dollhouse' | 'xray'
export type ViewPreset = 'iso-balcony' | 'iso-entry' | 'top' | 'from-balcony' | 'from-entry'

interface ViewState {
  mode: ViewMode
  preset: ViewPreset
  /** Bumped on every preset request so re-selecting the same preset re-frames. */
  presetNonce: number
  showDims: boolean
  setMode: (mode: ViewMode) => void
  goTo: (preset: ViewPreset) => void
  toggleDims: () => void
}

const params = new URLSearchParams(window.location.search)

export const useView = create<ViewState>((set) => ({
  mode: params.get('mode') === 'xray' ? 'xray' : 'dollhouse',
  preset: (params.get('view') as ViewPreset) || 'iso-balcony',
  presetNonce: 0,
  showDims: params.get('dims') !== '0',
  setMode: (mode) => set({ mode }),
  goTo: (preset) => set((s) => ({ preset, presetNonce: s.presetNonce + 1 })),
  toggleDims: () => set((s) => ({ showDims: !s.showDims })),
}))
