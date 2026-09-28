import type { MaterialDef } from '../model/types'

// Pale first pass: flat colors sampled by eye from the reference photos.
export const materials: Record<string, MaterialDef> = {
  plaster: { color: '#f3f1ec', roughness: 0.95 },
  ceiling: { color: '#f7f6f2', roughness: 0.95 },
  oakFloor: { color: '#e2cba8', roughness: 0.7, pattern: { kind: 'planks', width: 0.19, length: 1.2 } },
  bathFloor: { color: '#c4c1bb', roughness: 0.6, pattern: { kind: 'tiles', width: 0.6, height: 0.6, grout: '#a9a59e' } },
  tile: { color: '#f6f6f4', roughness: 0.35, pattern: { kind: 'tiles', width: 0.6, height: 0.3, grout: '#9c9a96' } },
  oakDoor: { color: '#c8a172', roughness: 0.7 },
  steelFrame: { color: '#8c8f92', roughness: 0.5, metalness: 0.3 },
  aluminum: { color: '#eef0f1', roughness: 0.45, metalness: 0.1 },
  glass: { color: '#cfe4ec', roughness: 0.05, opacity: 0.22 },
  concrete: { color: '#c7c3bc', roughness: 1 },
  balconyFloor: { color: '#c9c4bb', roughness: 0.85, pattern: { kind: 'tiles', width: 0.45, height: 0.45, grout: '#aca79e' } },
  ceramic: { color: '#fbfbfa', roughness: 0.2 },
  cabinet: { color: '#ebe8e2', roughness: 0.7 },
  countertop: { color: '#d6d2ca', roughness: 0.5 },
  appliance: { color: '#e2e3e4', roughness: 0.35, metalness: 0.2 },
  blackGlass: { color: '#1f2022', roughness: 0.15 },
  steel: { color: '#b9bcbf', roughness: 0.3, metalness: 0.7 },
  downlight: { color: '#ffffff', roughness: 0.5, emissive: '#fff6e0' },
}
