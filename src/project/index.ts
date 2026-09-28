import type { Project } from '../model/types'
import { materials } from './materials'
import { objects } from './objects'
import { shell } from './shell'

export const project: Project = {
  name: 'Monoambiente',
  materials,
  shell,
  objects,
}
