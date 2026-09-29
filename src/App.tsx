import { useEffect } from 'react'
import { mountOf } from './decor/placement'
import { useDecor } from './decor/store'
import type { PlantItem } from './model/decor'
import { Scene } from './scene/Scene'
import { DecorPanel } from './ui/DecorPanel'
import { Toolbar } from './ui/Toolbar'

const HINTS = {
  wall: 'Click a wall to hang it',
  surface: 'Click the floor or any surface to set it down · hold Alt to skip wall snapping',
  ceiling: 'Click anywhere below the ceiling spot to hang it',
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, select, textarea')) return
      const s = useDecor.getState()
      const sel = s.items.find((i) => i.id === s.selectedId)
      if (e.key === 'Escape') {
        if (s.movingId && s.isDraft) s.cancelPlacing()
        else s.select(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        s.remove(sel.id)
      } else if ((e.key === 'r' || e.key === 'R') && sel && sel.kind !== 'artwork' && mountOf(sel) !== 'wall') {
        // Furniture turns in quarter turns; plants and lamps in small steps.
        const step = (sel.kind === 'furniture' ? 90 : 15) * (e.shiftKey ? -1 : 1)
        s.update<PlantItem>(sel.id, { rotation: (((sel as PlantItem).rotation + step) % 360 + 360) % 360 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const moving = useDecor((s) => (s.isDraft ? s.items.find((i) => i.id === s.movingId) : undefined))
  useShortcuts()
  useEffect(() => {
    const s = useDecor.getState()
    void s.load()
    void s.refreshLibrary()
  }, [])

  return (
    <div className={`app${moving ? ' placing' : ''}`}>
      <Scene />
      <Toolbar />
      <DecorPanel />
      {moving && (
        <div className="hint" role="status">
          {HINTS[mountOf(moving)]} · <kbd>Esc</kbd> to cancel
        </div>
      )}
    </div>
  )
}
