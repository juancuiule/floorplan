// Shadow maps only re-render when something that casts or receives them
// changes, instead of every frame. Anything that moves geometry or toggles
// castShadow calls requestShadowUpdate(). The canvas renders on demand, so a
// request also schedules the frames that will draw the new shadows.

import { invalidate } from '@react-three/fiber'
import type * as THREE from 'three'

let pending = 8 // a few frames at startup while textures and decor load

export function requestShadowUpdate(frames = 2) {
  pending = Math.max(pending, frames)
  invalidate()
}

/** Consumes one pending update; true when this frame should re-render shadows. */
export function takeShadowUpdate(): boolean {
  if (pending <= 0) return false
  pending--
  if (pending > 0) invalidate()
  return true
}

/**
 * Shadow-only casters: hidden, except during the frames that re-render the
 * shadow maps, where they draw with an invisible material. They cost nothing
 * on ordinary frames and no depth, so they never show up in the view or the AO.
 */
export const shadowOnly = new Set<THREE.Object3D>()
