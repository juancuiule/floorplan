import type { Plan } from '../model/plan'

// Every plan in src/plans is bundled; ?plan=<id> picks one, the default is the owner's flat.

const modules = import.meta.glob<Plan>('../plans/*.plan.json', { eager: true, import: 'default' })

export const PLANS: Plan[] = Object.values(modules).sort((a, b) => a.name.localeCompare(b.name))
export const DEFAULT_PLAN_ID = 'monoambiente'

function pick(): Plan {
  const wanted = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('plan')
  const found = PLANS.find((p) => p.id === wanted) ?? PLANS.find((p) => p.id === DEFAULT_PLAN_ID)
  if (!found) throw new Error(`No plan "${wanted ?? DEFAULT_PLAN_ID}" in src/plans`)
  return found
}

/** The open plan. */
export const plan: Plan = pick()
export const isDefaultPlan = plan.id === DEFAULT_PLAN_ID
