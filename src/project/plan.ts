import { defaultPlan, plans } from 'virtual:workspace'
import type { Plan } from '../model/plan'
import { checkedPlan } from '../model/validate'
import { launch } from './launch'

// The open workspace's plans are bundled (docs/adr/0002, 0009); ?plan=<id> picks
// one, and the workspace names the default. The plan that opens is checked, so a
// mistake in a hand-written plan shows up as a list of problems rather than as a
// broken scene.

/** The plan that opens without ?plan=, and whose main layout is layouts/decor.json. */
export const DEFAULT_PLAN_ID = defaultPlan

function open(): Plan {
  const id = launch.plan && launch.plan in plans ? launch.plan : DEFAULT_PLAN_ID
  if (!(id in plans)) throw new Error(`No plan "${id}" in the workspace's plans/ folder`)
  const found = checkedPlan(plans[id], `plans/${id}.plan.json`)
  if (found.id !== id) throw new Error(`plans/${id}.plan.json has id "${found.id}"; the id must match the file name`)
  return found
}

/** The open plan. */
export const plan: Plan = open()
export const isDefaultPlan = plan.id === DEFAULT_PLAN_ID
