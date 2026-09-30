import { activeShell } from '../project/structure'
import { faceAt, paintFaces, type PaintFace } from '../project/paintFaces'
import { useDecor } from './store'

// Painting wall faces from the Room tab or with the brush in the scene.

/** Paintable faces of the walls standing in the open layout. */
export function currentFaces(): PaintFace[] {
  return paintFaces(activeShell().walls)
}

/** Sets a face's color; 'base' (or null) puts back the base wall color. One undo step. */
export function paintFace(faceId: string, color: string | null) {
  const s = useDecor.getState()
  const paint = { ...s.finishes.paint }
  if (!color || color === 'base') delete paint[faceId]
  else paint[faceId] = color.toLowerCase()
  s.setFinishes({ paint })
}

/** Paints the face of `wall` under a point on its surface (the brush). */
export function paintAt(wall: string, x: number, z: number, normal: [number, number], color: string) {
  const walls = activeShell().walls
  const face = faceAt(paintFaces(walls), walls, wall, x, z, normal)
  if (face) paintFace(face.id, color)
}
