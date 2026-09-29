import type { CameraControls } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { editRefs, useEdit } from '../../decor/edit'
import { facingOf, facingRotation, facingVector, mountOf, placeAt, readIntersection, type SurfaceHit } from '../../decor/placement'
import { useDecor } from '../../decor/store'
import type { DecorItem } from '../../model/decor'
import { useView } from '../../store'
import { requestShadowUpdate } from '../shadows'
import { cutWalls } from '../Walls'
import { Artwork } from './Artwork'
import { Furniture } from './furniture/Furniture'
import { EditOverlays } from './Gizmo'
import { Lamp } from './Lamp'
import { Plant } from './Plant'

/** Below this y a draft has not been dropped on a valid surface yet. */
const UNPLACED_Y = -50
/** Pixels the pointer must travel before a press on an item becomes a drag. */
const DRAG_THRESHOLD = 4

export const unplacedAt = (): [number, number, number] => [0, UNPLACED_Y - 1, 0]

/** The decor item an object belongs to, if any. */
export function decorIdOf(o: THREE.Object3D | null): string | null {
  for (; o; o = o.parent) if (o.userData.decorId) return o.userData.decorId as string
  return null
}

/** Not drawn at all: a hidden object or parent, or only invisible materials (a faded-out wall). */
function hidden(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return true
  const m = (o as THREE.Mesh).material
  const mats = Array.isArray(m) ? m : m ? [m] : []
  return mats.length > 0 && mats.every((x) => !x.visible)
}

/**
 * Whether the pointer sees through this hit when picking items: hidden or
 * editor-helper objects, and architecture faded by x-ray or dollhouse mode.
 */
function seeThrough(o: THREE.Object3D): boolean {
  // Edge lines and points are picked from far away (raycaster line threshold): never let them block.
  if (!(o as THREE.Mesh).isMesh || o.userData.editHelper || hidden(o)) return true
  if (decorIdOf(o)) return false
  const m = (o as THREE.Mesh).material
  const mats = Array.isArray(m) ? m : m ? [m] : []
  return mats.length > 0 && mats.every((x) => !x.visible || (x.transparent && x.opacity < 0.5))
}

/** First hit the eye actually sees. */
export function firstSolid(list: THREE.Intersection[]) {
  return list.find((i) => !seeThrough(i.object))
}

/** First hit that is a usable surface, ignoring decor if asked (floor pieces slide on the floor). */
function surfaceUnder(list: THREE.Intersection[], opts: { skipId?: string | null; skipDecor?: boolean }) {
  for (const i of list) {
    if (!i.face || i.object.userData.editHelper || hidden(i.object)) continue
    const id = decorIdOf(i.object)
    if (id && (id === opts.skipId || opts.skipDecor)) continue
    const hit = readIntersection(i)
    if (hit || !id) return { hit, intersection: i }
  }
  return null
}

/** Walk mode (drag looks around) and the measure tool (clicks take points) leave decor alone. */
const sceneTakenOver = () => {
  const v = useView.getState()
  return v.walking || v.tool !== null
}

/** Where the pointer grabbed the moving item, relative to the spot the item would snap to. */
interface Grab {
  x: number
  y: number
  armed: boolean
  offset: THREE.Vector3
  wall: boolean
}
let grab: Grab | null = null
let lastMoveEvent: Event | null = null
let lastClickEvent: Event | null = null

const plane = new THREE.Plane()
const tmp = new THREE.Vector3()

function grabOffset(item: DecorItem, ray: THREE.Ray): { offset: THREE.Vector3; wall: boolean } {
  const zero = { offset: new THREE.Vector3(), wall: false }
  const mount = mountOf(item)
  if (mount === 'wall' && 'facing' in item && item.facing) {
    const [nx, nz] = facingVector(item.facing)
    const n = new THREE.Vector3(nx, 0, nz)
    plane.setFromNormalAndCoplanarPoint(n, tmp.set(...item.at))
    const p = ray.intersectPlane(plane, new THREE.Vector3())
    if (!p) return zero
    const patch = placeAt(item, { point: p, normal: n, kind: 'wall', host: 'host' in item ? item.host : undefined })
    if (!patch?.at) return zero
    const offset = new THREE.Vector3(...item.at).sub(new THREE.Vector3(...patch.at))
    return offset.length() < 2 ? { offset, wall: true } : zero
  }
  plane.set(new THREE.Vector3(0, 1, 0), -(mount === 'ceiling' ? 0 : item.at[1]))
  const p = ray.intersectPlane(plane, new THREE.Vector3())
  if (!p) return zero
  const offset = new THREE.Vector3(item.at[0] - p.x, 0, item.at[2] - p.z)
  return offset.length() < 2 ? { offset, wall: false } : zero
}

function applyGrab(item: DecorItem, hit: SurfaceHit) {
  if (!grab) return
  if (hit.kind === 'wall') {
    if (grab.wall && 'facing' in item && item.facing === facingOf(hit.normal)) hit.point.add(grab.offset)
  } else if (!grab.wall) {
    hit.point.x += grab.offset.x
    hit.point.z += grab.offset.z
  }
}

/**
 * Wraps the architecture and decor so pointer events over them can pick,
 * place and drag decor. Each native event is handled once, from the full list
 * of intersections, so faded walls and the moving item itself are looked past.
 */
export function SurfaceEvents({ children }: { children: ReactNode }) {
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const s = useDecor.getState()
    if (s.movingId || e.button !== 0 || sceneTakenOver()) return
    const first = firstSolid(e.intersections)
    const id = first ? decorIdOf(first.object) : null
    // Architecture under the pointer: leave the press to the camera.
    if (!id) return
    e.stopPropagation()
    const item = s.items.find((i) => i.id === id)
    if (!item) return
    s.startDragging(id)
    grab = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, armed: false, ...grabOffset(item, e.ray) }
    if (controls) controls.enabled = false
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent === lastMoveEvent) return
    lastMoveEvent = e.nativeEvent
    e.stopPropagation()
    editRefs.pointerInCanvas = true
    const s = useDecor.getState()
    const edit = useEdit.getState()

    if (!s.movingId) {
      if (edit.rotating) return
      const first = firstSolid(e.intersections)
      const hoverId = first ? decorIdOf(first.object) : null
      if (hoverId !== edit.hoverId) edit.set({ hoverId })
      editRefs.lastHit = surfaceUnder(e.intersections, {})?.hit ?? null
      editRefs.lastFloorHit = surfaceUnder(e.intersections, { skipDecor: true })?.hit ?? null
      return
    }

    const item = s.items.find((i) => i.id === s.movingId)
    if (!item) return
    if (!s.isDraft && grab && !grab.armed) {
      if (Math.hypot(e.nativeEvent.clientX - grab.x, e.nativeEvent.clientY - grab.y) < DRAG_THRESHOLD) return
      grab.armed = true
    }
    if (edit.hoverId) edit.set({ hoverId: null })
    // Floor furniture slides along the floor, wall pieces along walls: neither climbs onto other decor.
    const mount = mountOf(item)
    const skipDecor = mount === 'wall' || (item.kind === 'furniture' && mount === 'surface')
    const under = surfaceUnder(e.intersections, { skipId: item.id, skipDecor })
    if (!under) return
    const hit = under.hit
    const report = { snap: [] as ReturnType<typeof useEdit.getState>['snap'] }
    const patch = hit && (applyGrab(item, hit), placeAt(item, hit, { free: e.nativeEvent.altKey, report }))
    if (patch) {
      s.update(item.id, patch)
      edit.set({ invalid: null, snap: report.snap })
    } else {
      edit.set({ invalid: { point: under.intersection.point.clone(), normal: hit?.normal ?? new THREE.Vector3(0, 1, 0) }, snap: [] })
    }
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.nativeEvent === lastClickEvent) return
    lastClickEvent = e.nativeEvent
    e.stopPropagation()
    const s = useDecor.getState()
    if (e.delta > 6 || (sceneTakenOver() && !s.movingId)) return
    if (s.isDraft && s.movingId) {
      const item = s.items.find((i) => i.id === s.movingId)
      if (item && item.at[1] > UNPLACED_Y && !useEdit.getState().invalid) {
        s.stopMoving()
        useEdit.getState().set({ snap: [], invalid: null })
      }
      return
    }
    // A click on the room (not on an item) clears the selection.
    const first = firstSolid(e.intersections)
    if (!first || !decorIdOf(first.object)) s.select(null)
  }

  const onPointerLeave = () => {
    editRefs.pointerInCanvas = false
    const edit = useEdit.getState()
    if (edit.hoverId) edit.set({ hoverId: null })
  }

  return (
    <group onPointerDown={onPointerDown} onPointerMove={onPointerMove} onClick={onClick} onPointerLeave={onPointerLeave}>
      {children}
    </group>
  )
}

export function DecorLayer() {
  const items = useDecor((s) => s.items)
  const selectedId = useDecor((s) => s.selectedId)
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null
  const gl = useThree((s) => s.gl)
  useEffect(() => requestShadowUpdate(), [items])

  // End a drag wherever the pointer is released.
  useEffect(() => {
    const up = () => {
      const s = useDecor.getState()
      if (s.movingId && !s.isDraft) {
        s.stopMoving()
        useEdit.getState().set({ snap: [], invalid: null })
      }
      grab = null
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [controls])

  // Cursor: grab over items and the rotate handle, grabbing while dragging, not-allowed over a bad drop target.
  const hoverId = useEdit((s) => s.hoverId)
  const handleHover = useEdit((s) => s.handleHover)
  const rotating = useEdit((s) => s.rotating)
  const invalid = useEdit((s) => s.invalid !== null)
  const moving = useDecor((s) => (s.movingId ? (s.isDraft ? 'draft' : 'drag') : null))
  useEffect(() => {
    const c = rotating || moving === 'drag' ? 'grabbing' : moving && invalid ? 'not-allowed' : moving === 'draft' ? 'copy' : hoverId || handleHover ? 'grab' : ''
    gl.domElement.style.cursor = c
  }, [gl, hoverId, handleHover, rotating, invalid, moving])
  useEffect(() => {
    if (!moving) useEdit.getState().set({ snap: [], invalid: null })
  }, [moving])

  return (
    <group>
      {items.map((item) => (
        <DecorNode key={item.id} item={item} selected={item.id === selectedId} />
      ))}
      <EditOverlays />
    </group>
  )
}

function DecorNode({ item, selected }: { item: DecorItem; selected: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const host = 'host' in item ? item.host : undefined
  const wallMounted = mountOf(item) === 'wall'
  const rotationY = wallMounted && 'facing' in item && item.facing ? facingRotation[item.facing] : THREE.MathUtils.degToRad('rotation' in item ? item.rotation : 0)
  const hovered = useEdit((s) => s.hoverId === item.id)

  useFrame(() => {
    if (!ref.current) return
    ref.current.visible = item.at[1] > UNPLACED_Y && !(host && cutWalls.has(host))
  })

  return (
    <group ref={ref} position={item.at} rotation={[0, rotationY, 0]} userData={{ decorId: item.id, host }}>
      <Suspense fallback={null}>
        {item.kind === 'artwork' && <Artwork item={item} />}
        {item.kind === 'plant' && <Plant item={item} />}
        {item.kind === 'lamp' && <Lamp item={item} />}
        {item.kind === 'furniture' && <Furniture item={item} />}
      </Suspense>
      {selected ? <OutlineBox target={ref} color="#3b82f6" opacity={1} /> : hovered && <OutlineBox target={ref} color="#3b82f6" opacity={0.45} />}
    </group>
  )
}

/** A thin box around an item, drawn in world space over everything. */
function OutlineBox({ target, color, opacity }: { target: React.RefObject<THREE.Group | null>; color: string; opacity: number }) {
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const helper = useMemo(() => {
    const h = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(color))
    const m = h.material as THREE.LineBasicMaterial
    m.depthTest = false
    m.transparent = opacity < 1
    m.opacity = opacity
    h.renderOrder = 10
    h.userData.editHelper = true
    h.raycast = () => {}
    return h
  }, [color, opacity])
  useEffect(() => {
    scene.add(helper)
    invalidate()
    return () => {
      scene.remove(helper)
      helper.dispose()
      invalidate()
    }
  }, [scene, helper, invalidate])
  useFrame(() => {
    const t = target.current
    if (!t) return
    helper.visible = t.visible
    helper.box.setFromObject(t).expandByScalar(0.02)
  })
  return null
}
