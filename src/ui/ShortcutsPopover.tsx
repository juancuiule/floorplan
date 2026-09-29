import { useEffect, useRef, type RefObject } from 'react'
import { Icon } from './icons'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const MOD = isMac ? '⌘' : 'Ctrl'

const GROUPS: { title: string; items: [keys: string[][], what: string][] }[] = [
  {
    title: 'Placing and editing',
    items: [
      [[['Esc']], 'Cancel placing, or deselect'],
      [[['Alt']], 'Hold while placing to skip wall snapping'],
      [[['R'], ['Shift', 'R']], 'Rotate the selection, either way'],
      [[['←', '↑', '→', '↓']], 'Nudge the selection'],
      [[['Delete']], 'Delete the selection'],
      [[[MOD, 'D']], 'Duplicate'],
      [[[MOD, 'C'], [MOD, 'V']], 'Copy and paste'],
      [[[MOD, 'Z']], 'Undo'],
      [[['Shift', MOD, 'Z']], 'Redo'],
    ],
  },
  {
    title: 'View',
    items: [
      [[['1'], ['5']], 'Camera presets, 1 to 5'],
      [[['X']], 'Switch dollhouse and X-ray'],
      [[['M']], 'Show or hide dimensions'],
      [[['L']], 'Switch day and evening'],
      [[[','], ['.']], 'Sun: 15 minutes earlier or later'],
      [[['/']], 'Search the panel'],
      [[['\\']], 'Show or hide the panel'],
      [[['?']], 'Show these shortcuts'],
    ],
  },
]

/**
 * A non-modal dialog listing keyboard shortcuts. Focus moves into it when it
 * opens and back to the trigger when it closes (Esc, the close button, or a
 * click outside).
 */
export function ShortcutsPopover({ onClose, triggerRef }: { onClose: () => void; triggerRef: RefObject<HTMLButtonElement | null> }) {
  const ref = useRef<HTMLDivElement>(null)

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
      // Return focus only if it would otherwise be lost.
      if (!document.activeElement || document.activeElement === document.body || ref.current?.contains(document.activeElement)) trigger?.focus()
    }
  }, [onClose, triggerRef])

  return (
    <div
      ref={ref}
      className="popover shortcuts"
      role="dialog"
      aria-labelledby="shortcuts-title"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Keep the app from also deselecting the current item.
          e.stopPropagation()
          e.nativeEvent.stopImmediatePropagation()
          onClose()
        }
      }}
    >
      <div className="popover-head">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="group-label">{g.title}</h3>
          <dl>
            {g.items.map(([combos, what]) => (
              <div key={what} className="shortcut">
                <dt>
                  {combos.map((keys, i) => (
                    <span key={i} className="combo">
                      {i > 0 && <span className="or">{combos.length === 2 && what.includes(' to ') ? '–' : '/'}</span>}
                      {keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                      ))}
                    </span>
                  ))}
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
