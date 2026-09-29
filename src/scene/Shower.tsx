import { useMemo } from 'react'
import * as THREE from 'three'
import { useDecor } from '../decor/store'
import type { ShowerFittings, ShowerScreen } from '../model/finishes'
import type { Vec3 } from '../model/types'
import { Box } from './Box'
import { Merged } from './Merged'
import { sharedEdgeMaterial, sharedMaterial } from './materials'

// The shower in the bathroom corner, over the tray at x 1.35–2.10, z 0–0.70.
// Walls around it are tiled (10 mm cladding): back face at x = 2.09, side
// faces at z = 0.01 (bath-side wall) and z = 0.69 (shower-niche wall). The
// open side, toward the rest of the bathroom, is the plane x = 1.35.

const X0 = 1.35
const BACK = 2.09
const Z0 = 0.01
const Z1 = 0.69
const TRAY_TOP = 0.06
const ZC = (Z0 + Z1) / 2

const FITTINGS: Record<ShowerFittings, THREE.MeshStandardMaterial> = {
  chrome: new THREE.MeshStandardMaterial({ color: '#d4d7da', roughness: 0.22, metalness: 0.35 }),
  black: new THREE.MeshStandardMaterial({ color: '#1e1f21', roughness: 0.55, metalness: 0.1 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c09a55', roughness: 0.35, metalness: 0.35 }),
}
const edge = () => sharedEdgeMaterial()

/** A cylinder between two points. */
function Pipe({ a, b, r, m }: { a: Vec3; b: Vec3; r: number; m: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    return {
      length: dir.length(),
      position: va.clone().add(vb).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    }
  }, [a, b])
  return (
    <mesh position={position} quaternion={quaternion} material={m} castShadow>
      <cylinderGeometry args={[r, r, length, 12]} />
    </mesh>
  )
}

/** A disc facing -x (mounted on the back wall). */
function WallDisc({ p, r, m, t = 0.012 }: { p: Vec3; r: number; m: THREE.Material; t?: number }) {
  return (
    <mesh position={p} rotation={[0, 0, Math.PI / 2]} material={m} castShadow>
      <cylinderGeometry args={[r, r, t, 32]} />
    </mesh>
  )
}

/** Mixer, slide bar with hand shower and hose, rain head on a wall arm, and a corner shelf. */
function Fittings({ m }: { m: THREE.Material }) {
  const hose = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(BACK - 0.03, 1.02, ZC + 0.06),
      new THREE.Vector3(BACK - 0.06, 0.62, ZC + 0.12),
      new THREE.Vector3(BACK - 0.05, 0.75, 0.52),
      new THREE.Vector3(BACK - 0.06, 1.55, 0.53),
    ])
    return new THREE.TubeGeometry(curve, 32, 0.007, 6, false)
  }, [])
  const bottles: [number, number, string][] = [
    [0.025, 0.2, '#e8e2d6'],
    [0.02, 0.17, '#6f8fa3'],
    [0.022, 0.14, '#c9a36b'],
  ]
  return (
    <group>
      {/* thermostatic mixer: plate and two handles */}
      <WallDisc p={[BACK - 0.006, 1.02, ZC]} r={0.06} m={m} />
      <Box size={[0.03, 0.02, 0.08]} position={[BACK - 0.03, 1.02, ZC - 0.07]} material={m} edgeMaterial={edge()} />
      <Box size={[0.03, 0.02, 0.08]} position={[BACK - 0.03, 1.02, ZC + 0.07]} material={m} edgeMaterial={edge()} />
      <Pipe a={[BACK, 1.02, ZC + 0.06]} b={[BACK - 0.035, 1.02, ZC + 0.06]} r={0.012} m={m} />

      {/* slide bar with the hand shower resting in its holder */}
      <Pipe a={[BACK - 0.035, 1.15, 0.53]} b={[BACK - 0.035, 1.9, 0.53]} r={0.011} m={m} />
      <Pipe a={[BACK, 1.15, 0.53]} b={[BACK - 0.035, 1.15, 0.53]} r={0.01} m={m} />
      <Pipe a={[BACK, 1.9, 0.53]} b={[BACK - 0.035, 1.9, 0.53]} r={0.01} m={m} />
      <Pipe a={[BACK - 0.06, 1.55, 0.53]} b={[BACK - 0.1, 1.72, 0.53]} r={0.013} m={m} />
      <mesh position={[BACK - 0.11, 1.76, 0.53]} rotation={[0, 0, 0.9]} material={m} castShadow>
        <cylinderGeometry args={[0.045, 0.04, 0.02, 24]} />
      </mesh>
      <mesh geometry={hose} material={m} />

      {/* rain head on an arm from the back wall */}
      <Pipe a={[BACK, 2.12, ZC]} b={[BACK - 0.32, 2.12, ZC]} r={0.011} m={m} />
      <Pipe a={[BACK - 0.32, 2.12, ZC]} b={[BACK - 0.32, 2.07, ZC]} r={0.011} m={m} />
      <mesh position={[BACK - 0.32, 2.06, ZC]} material={m} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.012, 40]} />
      </mesh>

      {/* corner shelf with a few bottles */}
      <mesh position={[BACK, 1.3, Z0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={m} castShadow receiveShadow>
        <circleGeometry args={[0.2, 16, 0, Math.PI / 2]} />
      </mesh>
      {bottles.map(([r, h, color], i) => (
        <mesh key={i} position={[BACK - 0.05 - i * 0.045, 1.3 + h / 2, Z0 + 0.04 + (i % 2) * 0.05]} castShadow>
          <cylinderGeometry args={[r, r, h, 16]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

/** Frameless glass door across the open side, on a slim steel profile, with a bar handle. */
function GlassDoor({ m }: { m: THREE.Material }) {
  const H = 1.95
  return (
    <group>
      <Box size={[0.008, H, Z1 - Z0]} position={[X0 + 0.01, TRAY_TOP + H / 2, ZC]} material={sharedMaterial('glass')} castShadow={false} />
      {/* wall profile and the top stabilizer bar to the back wall */}
      <Box size={[0.02, H, 0.015]} position={[X0 + 0.01, TRAY_TOP + H / 2, Z0 + 0.0075]} material={m} edgeMaterial={edge()} />
      <Pipe a={[X0 + 0.01, TRAY_TOP + H - 0.02, Z1 - 0.02]} b={[BACK, TRAY_TOP + H - 0.02, Z1 - 0.02]} r={0.008} m={m} />
      <Box size={[0.05, 0.3, 0.015]} position={[X0 - 0.02, 1.05, Z1 - 0.07]} material={m} edgeMaterial={edge()} />
    </group>
  )
}

/** Curtain on a straight rail, drawn two thirds closed, with soft folds. */
function Curtain({ color, m }: { color: string; m: THREE.Material }) {
  const { geometry, material } = useMemo(() => {
    const width = (Z1 - Z0) * 0.62
    const height = 1.78
    const g = new THREE.PlaneGeometry(width, height, 48, 1)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.022 * Math.sin((pos.getX(i) / width) * Math.PI * 10))
    g.computeVertexNormals()
    // The plane's x runs along the rail (plan z); turn it to face the room (-x).
    g.rotateY(-Math.PI / 2)
    g.translate(0, height / 2, 0)
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide })
    return { geometry: g, material, width }
  }, [color])
  const railY = 2.02
  return (
    <group>
      <Pipe a={[X0 + 0.03, railY, Z0]} b={[X0 + 0.03, railY, Z1]} r={0.01} m={m} />
      <mesh geometry={geometry} material={material} position={[X0 + 0.03, railY - 0.02 - 1.78, Z0 + ((Z1 - Z0) * 0.62) / 2]} castShadow receiveShadow />
    </group>
  )
}

function ScreenFor({ screen, curtainColor, m }: { screen: ShowerScreen; curtainColor: string; m: THREE.Material }) {
  if (screen === 'glass') return <GlassDoor m={m} />
  if (screen === 'curtain') return <Curtain color={curtainColor} m={m} />
  return null
}

/** The shower fittings and its screen, following the layout's finishes. */
export function Shower() {
  const screen = useDecor((s) => s.finishes.shower.screen)
  const curtainColor = useDecor((s) => s.finishes.shower.curtainColor)
  const fittings = useDecor((s) => s.finishes.shower.fittings)
  const m = FITTINGS[fittings]
  // Remount (and re-merge) only when the choice changes.
  return (
    <Merged key={`${screen}|${curtainColor}|${fittings}`}>
      <Fittings m={m} />
      <ScreenFor screen={screen} curtainColor={curtainColor} m={m} />
    </Merged>
  )
}
