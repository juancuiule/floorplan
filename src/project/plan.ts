import type { Plan } from '../model/plan'
import { checkedPlan } from '../model/validate'
import { DEFAULT_PLAN_ID } from '../plans/default'
import { launch } from './launch'

// Every plan in src/plans is bundled (docs/adr/0002-plans-are-bundled-data.md);
// ?plan=<id> picks one, the default is set in src/plans/default.ts. The plan
// that opens is checked, so a mistake in a hand-written plan shows up as a list
// of problems rather than as a broken scene.

const modules = import.meta.glob<unknown>('../plans/*.plan.json', { eager: true, import: 'default' })

/** Plan id → its file, from the file name (`<id>.plan.json`). */
const files = new Map(Object.keys(modules).map((path) => [path.match(/([^/]+)\.plan\.json$/)![1], path]))

export { DEFAULT_PLAN_ID }

function open(): Plan {
  const id = launch.plan && files.has(launch.plan) ? launch.plan : DEFAULT_PLAN_ID
  const path = files.get(id)
  if (!path) throw new Error(`No plan "${id}" in src/plans`)
  const found = checkedPlan(modules[path], `src/plans/${id}.plan.json`)
  if (found.id !== id)
    throw new Error(`src/plans/${id}.plan.json has id "${found.id}"; the id must match the file name`)
  return found
}

/** The open plan. */
export const plan: Plan = open()
export const isDefaultPlan = plan.id === DEFAULT_PLAN_ID
