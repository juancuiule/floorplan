import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Ceiling, Rect } from '../model/types'
import { project } from '../project'
import { Box } from './Box'
import { faceDims, makeMaterial, sharedEdgeMaterial, sharedMaterial } from './materials'

const FLOOR_T = 0.012
const INLAY_T = 0.006

function rectBox(r: Rect, y0: number, y1: number) {
  return {
    size: [r[2] - r[0], y1 - y0, r[3] - r[1]] as [number, number, number],
    position: [(r[0] + r[2]) / 2, (y0 + y1) / 2, (r[1] + r[3]) / 2] as [number, number, number],
  }
}

export function Floors() {
  const { slab, baseFloor, rooms } = project.shell
  const edge = sharedEdgeMaterial()
  return (
    <group>
      <Box {...rectBox(slab.rect, -slab.thickness - FLOOR_T, -FLOOR_T)} material={sharedMaterial(slab.material)} edgeMaterial={edge} />
      <FloorBox rect={baseFloor.rect} y0={-FLOOR_T} y1={0} material={baseFloor.material} />
      {rooms
        .filter((r) => r.floor)
        .map((r) => (
          <FloorBox key={r.id} rect={r.rect} y0={0} y1={INLAY_T} material={r.floor!} />
        ))}
    </group>
  )
}

function FloorBox({ rect, y0, y1, material }: { rect: Rect; y0: number; y1: number; material: string }) {
  const { box, mat } = useMemo(() => {
    const box = rectBox(rect, y0, y1)
    return { box, mat: makeMaterial(material, faceDims(box.size)) }
  }, [rect, y0, y1, material])
  return <Box {...box} material={mat} castShadow={false} />
}

export function Ceilings() {
  return (
    <group>
      {project.shell.ceilings.map((c) => (
        <CeilingView key={c.id} ceiling={c} />
      ))}
    </group>
  )
}

/** Ceilings only show while the camera is below them, so orbiting from above looks into the rooms. */
function CeilingView({ ceiling: c }: { ceiling: Ceiling }) {
  const ref = useRef<THREE.Mesh>(null)
  const { geometry, position } = useMemo(() => {
    const [x0, z0, x1, z1] = c.rect
    return {
      geometry: new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      position: [(x0 + x1) / 2, c.height, (z0 + z1) / 2] as [number, number, number],
    }
  }, [c])
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.y < c.height - 0.01
  })
  return (
    <mesh ref={ref} geometry={geometry} position={position} rotation={[Math.PI / 2, 0, 0]} material={sharedMaterial(c.material)} receiveShadow />
  )
}
