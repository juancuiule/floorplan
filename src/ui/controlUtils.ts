import type { KeyboardEvent } from 'react'

/** Arrow keys, Home and End move the checked radio, as in the ARIA radio group pattern. */
export function onRadioKeys<T>(e: KeyboardEvent<HTMLElement>, values: T[], current: number, pick: (v: T) => void) {
  const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  let next = current
  if (delta) next = (Math.max(current, 0) + delta + values.length) % values.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = values.length - 1
  else return
  e.preventDefault()
  pick(values[next])
  const radios = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')
  radios[next]?.focus()
}

/** Name of a color in a palette, or its hex code for a custom one. */
export const colorName = (value: string, colors: { label: string; color: string }[]) =>
  colors.find((c) => c.color.toLowerCase() === value.toLowerCase())?.label ?? `Custom ${value.toLowerCase()}`

/**
 * A number typed by a person: "12", "12.5", "12,5", "-3", ".5". Anything else
 * ("12abc", "0x10", "1e9", "Infinity", "") is null, so it never reaches a size.
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}
