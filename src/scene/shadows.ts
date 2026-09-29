// Shadow maps only re-render when something that casts or receives them
// changes, instead of every frame. Anything that moves geometry or toggles
// castShadow calls requestShadowUpdate().

let pending = 8 // a few frames at startup while textures and decor load

export function requestShadowUpdate(frames = 2) {
  pending = Math.max(pending, frames)
}

/** Consumes one pending update; true when this frame should re-render shadows. */
export function takeShadowUpdate(): boolean {
  if (pending <= 0) return false
  pending--
  return true
}
