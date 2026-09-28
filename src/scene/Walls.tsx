import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { outwardNormal, wallFrame, wallPieces } from '../geometry/walls'
import type { Bulge, Opening, Vec2, Vec3, Wall } from '../model/types'
import { project } from '../project'
import { useView } from '../store'
import { Box } from './Box'
import { applyFade, faceDims, makeEdgeMaterial, makeMaterial } from './materials'

/** Height in meters of one pattern repeat, used to keep tile rows continuous across the stub cut. */
function patternHeight(id: string): number {
  const p = project.materials[id]?.pattern
  if (!p) return 0
  return p.kind === 'tiles' ? p.height * 2 : p.length * 2
}

/** Height of the wall stub left standing when dollhouse mode cuts a wall away. */
export const STUB_HEIGHT = 0.3
const XRAY_ALPHA = 0.14
const FADE_SPEED = 9
const INSIDE: Vec2 = [3.45, 1.5]

export function Walls() {
  const { walls, bulges } = project.shell
  return (
    <group>
      {walls.map((w) => (
        <WallView key={w.id} wall={w} bulges={bulges.filter((b) => b.host === w.id)} />
      ))}
    </group>
  )
}

type MatPool = (id: string) => THREE.MeshStandardMaterial

interface BulgePiece {
  key: string
  size: [number, number, number]
  position: [number, number, number]
  material: THREE.MeshStandardMaterial
  stub: boolean
}

function WallView({ wall, bulges }: { wall: Wall; bulges: Bulge[] }) {
  const frame = useMemo(() => wallFrame(wall), [wall])
  const pieces = useMemo(() => wallPieces(wall, STUB_HEIGHT), [wall])
  const outward = useMemo(() => outwardNormal(wall, INSIDE), [wall])
  const groupRef = useRef<THREE.Group>(null)

  // Each wall owns its materials so it can fade on its own. Everything lands
  // in either the stub set or the upper set.
  const mats = useMemo(() => {
    const stubSet = new Set<THREE.Material>()
    const upperSet = new Set<THREE.Material>()
    const pool = new Map<string, THREE.MeshStandardMaterial>()
    const get: MatPool = (id) => {
      let m = pool.get(id)
      if (!m) {
        pool.set(id, (m = makeMaterial(id)))
        upperSet.add(m)
      }
      return m
    }
    const stub = makeMaterial(wall.material)
    const stubEdge = makeEdgeMaterial()
    const upper = makeMaterial(wall.material)
    const upperEdge = makeEdgeMaterial()
    stubSet.add(stub).add(stubEdge)
    upperSet.add(upper).add(upperEdge)

    const bulgePieces: BulgePiece[] = []
    for (const b of bulges) {
      const spans: [number, number, boolean][] =
        b.min[1] < STUB_HEIGHT && b.max[1] > STUB_HEIGHT
          ? [
              [b.min[1], STUB_HEIGHT, true],
              [STUB_HEIGHT, b.max[1], false],
            ]
          : [[b.min[1], b.max[1], b.max[1] <= STUB_HEIGHT]]
      // Patterns (tiles) are scaled to the whole bulge so the grid stays continuous across the cut.
      const full: Vec3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
      for (const [y0, y1, isStub] of spans) {
        const size: [number, number, number] = [full[0], y1 - y0, full[2]]
        const dims = faceDims(size)
        const material = makeMaterial(b.material, dims)
        if (material.map) material.map.offset.y = isStub ? 0 : (y0 - b.min[1]) / (patternHeight(b.material) || 1)
        ;(isStub ? stubSet : upperSet).add(material)
        bulgePieces.push({
          key: `${b.id}:${isStub ? 's' : 'u'}`,
          size,
          position: [(b.min[0] + b.max[0]) / 2, (y0 + y1) / 2, (b.min[2] + b.max[2]) / 2],
          material,
          stub: isStub,
        })
      }
    }
    return { stub, stubEdge, upper, upperEdge, get, stubSet, upperSet, bulgePieces }
  }, [wall, bulges])

  const alpha = useRef({ stub: 1, upper: 1, shadows: true })

  useFrame(({ camera }, dt) => {
    const mode = useView.getState().mode
    let stub = 1
    let upper = 1
    if (mode === 'xray') {
      stub = upper = XRAY_ALPHA
    } else if (wall.kind === 'exterior') {
      const mx = (wall.a[0] + wall.b[0]) / 2
      const mz = (wall.a[1] + wall.b[1]) / 2
      const beyond = (camera.position.x - mx) * outward[0] + (camera.position.z - mz) * outward[1]
      if (beyond > 0.05) upper = 0
    }
    const k = 1 - Math.exp(-FADE_SPEED * dt)
    const a = alpha.current
    a.stub += (stub - a.stub) * k
    a.upper += (upper - a.upper) * k
    applyFade(mats.stubSet, a.stub)
    applyFade(mats.upperSet, a.upper)

    // Faded parts should not keep casting shadows into the room.
    const shadows = mode !== 'xray' && upper > 0.5
    if (shadows !== a.shadows && groupRef.current) {
      a.shadows = shadows
      groupRef.current.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !mats.stubSet.has((o as THREE.Mesh).material as THREE.Material)) o.castShadow = shadows
      })
    }
  })

  return (
    <group ref={groupRef}>
      <group position={[frame.origin[0], 0, frame.origin[1]]} rotation={[0, frame.rotY, 0]}>
        {pieces.map((p, i) => (
          <Box
            key={i}
            size={[p.s1 - p.s0, p.y1 - p.y0, wall.thickness]}
            position={[(p.s0 + p.s1) / 2, (p.y0 + p.y1) / 2, 0]}
            material={p.stub ? mats.stub : mats.upper}
            edgeMaterial={p.stub ? mats.stubEdge : mats.upperEdge}
          />
        ))}
        {wall.openings?.map((o) => (
          <OpeningView key={o.id} opening={o} wall={wall} get={mats.get} edge={mats.upperEdge} />
        ))}
      </group>
      {mats.bulgePieces.map((p) => (
        <Box key={p.key} size={p.size} position={p.position} material={p.material} edgeMaterial={p.stub ? mats.stubEdge : mats.upperEdge} />
      ))}
    </group>
  )
}

interface OpeningProps {
  opening: Opening
  wall: Wall
  get: MatPool
  edge: THREE.Material
}

function OpeningView({ opening, wall, get, edge }: OpeningProps) {
  if (opening.kind === 'door' && opening.leaf) return <DoorView opening={opening} wall={wall} get={get} edge={edge} />
  if (opening.kind === 'window' && opening.glazing) return <SlidingDoorView opening={opening} wall={wall} get={get} edge={edge} />
  return null
}

const FRAME = 0.045

function DoorView({ opening: o, wall, get, edge }: OpeningProps) {
  const leaf = o.leaf!
  const frameMat = get(leaf.frameMaterial)
  const leafMat = get(leaf.material)
  const handleMat = get('steel')
  const depth = wall.thickness + 0.02
  const s0 = o.offset
  const s1 = o.offset + o.width
  const leafW = o.width - FRAME * 2
  const leafH = o.height - FRAME - 0.01
  const leafT = 0.04
  const hingeS = leaf.hinge === 'a' ? s0 + FRAME : s1 - FRAME
  const dir = leaf.hinge === 'a' ? 1 : -1
  const pivotZ = leaf.swing * (wall.thickness / 2 - leafT / 2)
  const phi = -dir * leaf.swing * THREE.MathUtils.degToRad(leaf.openDeg)

  return (
    <group>
      <Box size={[FRAME, o.height, depth]} position={[s0 + FRAME / 2, o.height / 2, 0]} material={frameMat} edgeMaterial={edge} />
      <Box size={[FRAME, o.height, depth]} position={[s1 - FRAME / 2, o.height / 2, 0]} material={frameMat} edgeMaterial={edge} />
      <Box size={[o.width, FRAME, depth]} position={[(s0 + s1) / 2, o.height - FRAME / 2, 0]} material={frameMat} edgeMaterial={edge} />
      <group position={[hingeS, 0, pivotZ]} rotation={[0, phi, 0]}>
        <Box size={[leafW, leafH, leafT]} position={[(dir * leafW) / 2, 0.01 + leafH / 2, 0]} material={leafMat} edgeMaterial={edge} />
        {[1, -1].map((side) => (
          <Box
            key={side}
            size={[0.12, 0.02, 0.02]}
            position={[dir * (leafW - 0.09), 1.0, side * (leafT / 2 + 0.03)]}
            material={handleMat}
          />
        ))}
      </group>
    </group>
  )
}

function SlidingDoorView({ opening: o, get, edge }: OpeningProps) {
  const g = o.glazing!
  const frameMat = get(g.frameMaterial)
  const glassMat = get('glass')
  const handleMat = get('blackGlass')
  const sill = o.sill ?? 0
  const s0 = o.offset
  const s1 = o.offset + o.width
  const outerD = 0.1
  const panelW = (o.width - FRAME * 2) / g.panels + 0.04
  const panelH = o.height - FRAME * 2
  const bar = 0.055

  const panels = Array.from({ length: g.panels }, (_, i) => {
    const left = s0 + FRAME + i * ((o.width - FRAME * 2 - panelW) / Math.max(1, g.panels - 1))
    const z = (i % 2 === 0 ? 1 : -1) * 0.022
    return { cx: left + panelW / 2, z }
  })

  return (
    <group>
      {/* Outer frame */}
      <Box size={[FRAME, o.height, outerD]} position={[s0 + FRAME / 2, sill + o.height / 2, 0]} material={frameMat} edgeMaterial={edge} />
      <Box size={[FRAME, o.height, outerD]} position={[s1 - FRAME / 2, sill + o.height / 2, 0]} material={frameMat} edgeMaterial={edge} />
      <Box size={[o.width, FRAME, outerD]} position={[(s0 + s1) / 2, sill + o.height - FRAME / 2, 0]} material={frameMat} edgeMaterial={edge} />
      <Box size={[o.width, FRAME, outerD]} position={[(s0 + s1) / 2, sill + FRAME / 2, 0]} material={frameMat} edgeMaterial={edge} />
      {panels.map((p, i) => (
        <group key={i} position={[p.cx, sill + FRAME + panelH / 2, p.z]}>
          <Box size={[bar, panelH, 0.035]} position={[-panelW / 2 + bar / 2, 0, 0]} material={frameMat} edgeMaterial={edge} />
          <Box size={[bar, panelH, 0.035]} position={[panelW / 2 - bar / 2, 0, 0]} material={frameMat} edgeMaterial={edge} />
          <Box size={[panelW, bar, 0.035]} position={[0, panelH / 2 - bar / 2, 0]} material={frameMat} edgeMaterial={edge} />
          <Box size={[panelW, bar * 1.6, 0.035]} position={[0, -panelH / 2 + bar * 0.8, 0]} material={frameMat} edgeMaterial={edge} />
          <Box size={[panelW - bar * 2, panelH - bar * 2.6, 0.006]} position={[0, bar * 0.3, 0]} material={glassMat} castShadow={false} />
          {/* Pull handle on the meeting stile */}
          <Box
            size={[0.02, 0.22, 0.03]}
            position={[(i === 0 ? 1 : -1) * (panelW / 2 - bar / 2), -0.1, (i % 2 === 0 ? 1 : -1) * 0.03]}
            material={handleMat}
          />
        </group>
      ))}
    </group>
  )
}
