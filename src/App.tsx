import { useEffect } from 'react'
import { screenAxes, useEdit } from './decor/edit'
import { alongWall, mountOf } from './decor/placement'
import { useDecor } from './decor/store'
import type { Vec3 } from './model/types'
import { Scene } from './scene/Scene'
import { DecorPanel } from './ui/DecorPanel'
import { EditBar } from './ui/EditBar'
import { Toolbar } from './ui/Toolbar'

const HINTS = {
  wall: 'Click a wall to hang it',
  surface: 'Click the floor or any surface to set it down · hold Alt to skip wall snapping',
  ceiling: 'Click anywhere below the ceiling spot to hang it',
}

const INVALID_HINTS = {
  wall: 'Only walls can take this',
  surface: 'Needs a floor or a flat surface',
  ceiling: 'Point below a ceiling',
}

/** Typing fields keep their own keys; sliders, checkboxes and buttons do not need Cmd+Z etc. */
function isTextField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el?.closest) return false
  if (el.closest('textarea, select, [contenteditable="true"]')) return true
  const input = el.closest('input') as HTMLInputElement | null
  return !!input && !['range', 'checkbox', 'radio', 'button', 'color'].includes(input.type)
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useDecor.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      // Undo / redo work everywhere except inside a text field (which has its own undo).
      if (mod && !e.altKey && (key === 'z' || key === 'y') && !isTextField(e.target)) {
        e.preventDefault()
        if (key === 'y' || e.shiftKey) s.redo()
        else s.undo()
        return
      }

      const t = e.target as HTMLElement
      if (t.closest?.('input, select, textarea')) return
      const sel = s.items.find((i) => i.id === s.selectedId)

      if (mod && key === 'c' && sel) {
        if (window.getSelection()?.toString()) return
        e.preventDefault()
        s.copy(sel.id)
      } else if (mod && key === 'v' && s.hasClipboard) {
        e.preventDefault()
        s.paste()
      } else if (mod && key === 'd' && sel) {
        e.preventDefault()
        s.duplicate(sel.id)
      } else if (mod) {
        return
      } else if (e.key === 'Escape') {
        if (s.movingId) s.cancelPlacing()
        else s.select(null)
      } else if (s.movingId || useEdit.getState().rotating) {
        // Keys below edit a placed item; not while it is following the pointer.
        return
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        s.remove(sel.id)
      } else if (key === 'r' && sel && 'rotation' in sel && mountOf(sel) !== 'wall') {
        // Furniture turns in quarter turns; plants and lamps in small steps.
        s.rotateBy(sel.id, (sel.kind === 'furniture' ? 90 : 15) * (e.shiftKey ? -1 : 1))
      } else if (sel && (e.key.startsWith('Arrow') || e.key === 'PageUp' || e.key === 'PageDown' || e.key === '[' || e.key === ']')) {
        const d = e.shiftKey ? 0.1 : 0.01
        const wall = mountOf(sel) === 'wall' && 'facing' in sel && sel.facing
        let delta: Vec3 | null = null
        if (e.key === 'PageUp' || e.key === ']') delta = wall ? [0, d, 0] : null
        else if (e.key === 'PageDown' || e.key === '[') delta = wall ? [0, -d, 0] : null
        else if (wall) {
          // Along the wall, left/right as seen on screen; up/down is height.
          if (e.key === 'ArrowUp') delta = [0, d, 0]
          else if (e.key === 'ArrowDown') delta = [0, -d, 0]
          else {
            const [ax, az] = alongWall(sel.facing!)
            const { right } = screenAxes()
            const sign = (ax * right[0] + az * right[1] >= 0 ? 1 : -1) * (e.key === 'ArrowRight' ? 1 : -1)
            delta = [ax * d * sign, 0, az * d * sign]
          }
        } else {
          // On the floor: arrows follow the screen, snapped to the room's axes.
          const { right, away } = screenAxes()
          const v = e.key === 'ArrowRight' ? right : e.key === 'ArrowLeft' ? [-right[0], -right[1]] : e.key === 'ArrowUp' ? away : [-away[0], -away[1]]
          delta = [v[0] * d, 0, v[1] * d]
        }
        if (delta) {
          e.preventDefault()
          s.nudge(sel.id, delta)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const moving = useDecor((s) => (s.isDraft ? s.items.find((i) => i.id === s.movingId) : undefined))
  const invalid = useEdit((s) => s.invalid !== null)
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
      <EditBar />
      {moving && (
        <div className="hint" role="status">
          {invalid ? INVALID_HINTS[mountOf(moving)] : HINTS[mountOf(moving)]} · <kbd>Esc</kbd> to cancel
        </div>
      )}
    </div>
  )
}
