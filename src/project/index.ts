import type { Project } from '../model/types'
import { plan } from './plan'

export { plan } from './plan'

/** The open plan's shell, fittings and materials (see src/model/plan.ts). */
export const shell = plan.shell
export const materials = plan.materials
export const objects = plan.fixtures

export const project: Project = {
  name: plan.name,
  materials: plan.materials,
  shell: plan.shell,
  objects: plan.fixtures,
}
