import type { CameraControls } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { facingRotation, mountOf, placeAt, readHit } from '../../decor/placement'
import { useDecor } from '../../decor/store'
import type { DecorItem } from '../../model/decor'
import { requestShadowUpdate } from '../shadows'
import { cutWalls } from '../Walls'
import { Artwork } from './Artwork'
import { Furniture } from './furniture/Furniture'
import { Lamp } from './Lamp'
import { Plant } from './Plant'

/** Below this y a draft has not been dropped on a valid surface yet. */
const UNPLACED_Y = -50

export const unplacedAt = (): [number, number, number] => [0, UNPLACED_Y - 1, 0]

function belongsTo(o: THREE.Object3D | null, id: string): boolean {
  for (; o; o = o.parent) if (o.userData.decorId) return o.userData.decorId === id
  return false
}

/**
 * Wraps the architecture so pointer events over it can place or drag decor.
 * Hidden (faded) meshes are skipped so the pointer reaches what is visible.
 */
export function SurfaceEvents({ children }: { children: ReactNode }) {
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const s = useDecor.getState()
    if (!s.movingId) return
    // The item being moved is not a surface for itself: look past it.
    if (belongsTo(e.object, s.movingId)) return
    const hit = readHit(e)
    if (!hit) return
    e.stopPropagation()
    const item = s.items.find((i) => i.id === s.movingId)
    if (!item) return
    const patch = placeAt(item, hit, { free: e.nativeEvent.altKey })
    if (patch) s.update(item.id, patch)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const s = useDecor.getState()
    if (!s.isDraft || !s.movingId) return
    e.stopPropagation()
    if (e.delta > 6) return
    const item = s.items.find((i) => i.id === s.movingId)
    if (item && item.at[1] > UNPLACED_Y) s.stopMoving()
  }
  return (
    <group onPointerMove={onPointerMove} onClick={onClick}>
      {children}
    </group>
  )
}

export function DecorLayer() {
  const items = useDecor((s) => s.items)
  const selectedId = useDecor((s) => s.selectedId)
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null
  useEffect(() => requestShadowUpdate(), [items])

  // End a drag wherever the pointer is released.
  useEffect(() => {
    const up = () => {
      const s = useDecor.getState()
      if (s.movingId && !s.isDraft) s.stopMoving()
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [controls])

  const onPointerDown = (id: string) => (e: ThreeEvent<PointerEvent>) => {
    const s = useDecor.getState()
    if (s.movingId || e.button !== 0) return
    e.stopPropagation()
    s.startDragging(id)
    if (controls) controls.enabled = false
  }

  return (
    <group>
      {items.map((item) => (
        <DecorNode key={item.id} item={item} selected={item.id === selectedId} onPointerDown={onPointerDown(item.id)} />
      ))}
    </group>
  )
}

function DecorNode({ item, selected, onPointerDown }: { item: DecorItem; selected: boolean; onPointerDown: (e: ThreeEvent<PointerEvent>) => void }) {
  const ref = useRef<THREE.Group>(null)
  const host = 'host' in item ? item.host : undefined
  const wallMounted = mountOf(item) === 'wall'
  const rotationY = wallMounted && 'facing' in item && item.facing ? facingRotation[item.facing] : THREE.MathUtils.degToRad('rotation' in item ? item.rotation : 0)

  useFrame(() => {
    if (!ref.current) return
    ref.current.visible = item.at[1] > UNPLACED_Y && !(host && cutWalls.has(host))
  })

  return (
    <group ref={ref} position={item.at} rotation={[0, rotationY, 0]} onPointerDown={onPointerDown} userData={{ decorId: item.id, host }}>
      <Suspense fallback={null}>
        {item.kind === 'artwork' && <Artwork item={item} />}
        {item.kind === 'plant' && <Plant item={item} />}
        {item.kind === 'lamp' && <Lamp item={item} />}
        {item.kind === 'furniture' && <Furniture item={item} />}
      </Suspense>
      {selected && <SelectionBox target={ref} />}
    </group>
  )
}

/** A thin box around the selected item, drawn in world space. */
function SelectionBox({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const scene = useThree((s) => s.scene)
  const helper = useMemo(() => {
    const h = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#3b82f6'))
    ;(h.material as THREE.LineBasicMaterial).depthTest = false
    h.renderOrder = 10
    return h
  }, [])
  useEffect(() => {
    scene.add(helper)
    return () => {
      scene.remove(helper)
      helper.dispose()
    }
  }, [scene, helper])
  useFrame(() => {
    const t = target.current
    if (!t) return
    helper.visible = t.visible
    helper.box.setFromObject(t).expandByScalar(0.02)
  })
  return null
}
