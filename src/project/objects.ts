import type { SceneObject } from '../model/types'

// Fixed fittings only. The main room starts empty on purpose, and the space
// next to the kitchen run (the dashed box on the plan) is left free.

export const objects: SceneObject[] = [
  // Bathroom
  { id: 'toilet', type: 'toilet', position: [0.33, 0, 0.36], rotation: 90 },
  { id: 'basin', type: 'basin', position: [0.2, 0, 1.0], rotation: 90, size: [0.46, 0.86, 0.38] },
  { id: 'shower-tray', type: 'showerTray', position: [1.725, 0, 0.35], size: [0.75, 0.06, 0.7] },

  // Kitchen run along the kitchen-side wall, facing the hall.
  // The fridge stands just past the wall stub, at the start of the main room.
  { id: 'fridge', type: 'fridge', position: [2.52, 0, 2.69], rotation: 180, size: [0.6, 1.75, 0.62] },
  { id: 'counter', type: 'counter', position: [1.365, 0, 2.7], rotation: 180, size: [1.45, 0.9, 0.6] },
  { id: 'kitchen-sink', type: 'kitchenSink', position: [1.0, 0.9, 2.72], rotation: 180, size: [0.45, 0.18, 0.38] },
  { id: 'cooktop', type: 'cooktop', position: [1.74, 0.9, 2.72], rotation: 180, size: [0.3, 0.01, 0.5] },

  // Balcony railings (glass panels with a steel handrail): front plus both open sides
  { id: 'railing-front', type: 'railing', position: [8.36, 0, 1.5], rotation: 90, size: [3.36, 1.05, 0.02] },
  { id: 'railing-bath', type: 'railing', position: [7.73, 0, -0.16], size: [1.26, 1.05, 0.02] },
  { id: 'railing-kitchen', type: 'railing', position: [7.73, 0, 3.16], size: [1.26, 1.05, 0.02] },

  // Recessed downlights (small discs on the ceiling)
  { id: 'dl-bath', type: 'downlight', position: [0.7, 2.4, 0.65] },
  { id: 'dl-hall', type: 'downlight', position: [1.05, 2.4, 1.9] },
  { id: 'dl-main-1', type: 'downlight', position: [3.4, 2.6, 1.5] },
  { id: 'dl-main-2', type: 'downlight', position: [5.6, 2.6, 1.5] },
  { id: 'dl-balcony', type: 'downlight', position: [7.75, 2.6, 1.5] },
]
