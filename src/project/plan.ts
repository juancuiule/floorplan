import type { Plan } from '../model/plan'
import { DEFAULT_PLAN_ID } from '../plans/default'
import { launch } from './launch'

// Every plan in src/plans is bundled; ?plan=<id> picks one, the default is set in src/plans/default.ts.

const modules = import.meta.glob<Plan>('../plans/*.plan.json', { eager: true, import: 'default' })

export const PLANS: Plan[] = Object.values(modules).sort((a, b) => a.name.localeCompare(b.name))
export { DEFAULT_PLAN_ID }

function pick(): Plan {
  const wanted = launch.plan
  const found = PLANS.find((p) => p.id === wanted) ?? PLANS.find((p) => p.id === DEFAULT_PLAN_ID)
  if (!found) throw new Error(`No plan "${wanted ?? DEFAULT_PLAN_ID}" in src/plans`)
  return found
}

/** The open plan. */
export const plan: Plan = pick()
export const isDefaultPlan = plan.id === DEFAULT_PLAN_ID
