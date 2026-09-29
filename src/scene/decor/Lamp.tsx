import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LAMPS, warmthColor } from '../../decor/catalog'
import type { LampItem } from '../../model/decor'
import { useView } from '../../store'

const metal = new THREE.MeshStandardMaterial({ color: '#b9bbbd', roughness: 0.3, metalness: 0.8 })
const wood = new THREE.MeshStandardMaterial({ color: '#b08557', roughness: 0.7 })
const marble = new THREE.MeshStandardMaterial({ color: '#e9e7e2', roughness: 0.3 })
const cable = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.8 })

const ARC_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.04, 0),
  new THREE.Vector3(0, 1.2, 0),
  new THREE.Vector3(0.18, 1.82, 0),
  new THREE.Vector3(0.75, 2.02, 0),
  new THREE.Vector3(1.22, 1.9, 0),
])

function useLampMaterials(item: LampItem) {
  const evening = useView((s) => s.lighting === 'evening')
  const glowColor = warmthColor(item.warmth)
  const mats = useMemo(() => {
    const shade = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.6, side: THREE.DoubleSide })
    const glow = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.4, side: THREE.DoubleSide })
    const bulb = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.2 })
    return { shade, glow, bulb }
  }, [item.color])
  useEffect(() => {
    const on = item.on ? 1 : 0
    const level = on * item.brightness * (evening ? 1 : 0.25)
    mats.glow.emissive.set(glowColor)
    mats.glow.emissiveIntensity = level * 1.4
    mats.bulb.emissive.set(glowColor)
    mats.bulb.emissiveIntensity = level * 3
    // Translucent fabric shades glow faintly from inside.
    mats.shade.emissive.set(glowColor)
    mats.shade.emissiveIntensity = item.type === 'tripod' || item.type === 'table' ? level * 0.9 : 0
  }, [mats, glowColor, item.on, item.brightness, item.type, evening])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  return mats
}

/**
 * Real lights only exist in the evening: every light adds shader cost even when
 * dim, and against daylight the emissive shades carry the look on their own.
 */
const EVENING_FACTOR = 0.55

function Bulb({ position, item, scale = 1 }: { position: [number, number, number]; item: LampItem; scale?: number }) {
  const evening = useView((s) => s.lighting === 'evening')
  if (!evening || !item.on) return null
  const power = LAMPS[item.type].power * item.brightness * scale * EVENING_FACTOR
  return <pointLight position={position} intensity={power} distance={7} decay={2} color={warmthColor(item.warmth)} />
}

/** A lamp in local space. Surface lamps stand on the origin; ceiling lamps hang from it; wall lamps face +z. */
export function Lamp({ item }: { item: LampItem }) {
  const m = useLampMaterials(item)

  switch (item.type) {
    case 'arc':
      return (
        <group>
          <mesh position={[0, 0.02, 0]} material={marble} castShadow receiveShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.04, 32]} />
          </mesh>
          <mesh material={metal} castShadow>
            <tubeGeometry args={[ARC_CURVE, 40, 0.012, 8, false]} />
          </mesh>
          <mesh position={[1.24, 1.68, 0]} material={m.shade} castShadow>
            <sphereGeometry args={[0.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[1.24, 1.72, 0]} material={m.bulb}>
            <sphereGeometry args={[0.045, 16, 10]} />
          </mesh>
          <Bulb position={[1.24, 1.62, 0]} item={item} />
        </group>
      )

    case 'tripod': {
      const top = new THREE.Vector3(0, 1.32, 0)
      return (
        <group>
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2
            const foot = new THREE.Vector3(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3)
            const mid = foot.clone().lerp(top, 0.5)
            const len = foot.distanceTo(top)
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize())
            return (
              <mesh key={i} position={mid} quaternion={q} material={wood} castShadow>
                <cylinderGeometry args={[0.012, 0.016, len, 8]} />
              </mesh>
            )
          })}
          <mesh position={[0, 1.5, 0]} material={m.shade} castShadow>
            <cylinderGeometry args={[0.22, 0.24, 0.32, 40, 1, true]} />
          </mesh>
          <Bulb position={[0, 1.45, 0]} item={item} />
        </group>
      )
    }

    case 'table':
      return (
        <group>
          <mesh position={[0, 0.13, 0]} material={marble} castShadow>
            <cylinderGeometry args={[0.05, 0.075, 0.26, 24]} />
          </mesh>
          <mesh position={[0, 0.35, 0]} material={m.shade} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 0.19, 32, 1, true]} />
          </mesh>
          <Bulb position={[0, 0.32, 0]} item={item} />
        </group>
      )

    case 'mushroom':
      return (
        <group>
          <mesh position={[0, 0.01, 0]} material={m.glow} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.02, 24]} />
          </mesh>
          <mesh position={[0, 0.12, 0]} material={m.glow} castShadow>
            <cylinderGeometry args={[0.035, 0.045, 0.2, 20]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} material={m.glow} castShadow>
            <sphereGeometry args={[0.15, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <Bulb position={[0, 0.18, 0]} item={item} />
        </group>
      )

    case 'pendant':
      return (
        <group>
          <mesh position={[0, -0.01, 0]} material={cable}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 20]} />
          </mesh>
          <mesh position={[0, -0.4, 0]} material={cable}>
            <cylinderGeometry args={[0.004, 0.004, 0.8, 6]} />
          </mesh>
          <mesh position={[0, -1.0, 0]} material={m.shade} castShadow>
            <sphereGeometry args={[0.22, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, -0.93, 0]} material={m.bulb}>
            <sphereGeometry args={[0.05, 16, 10]} />
          </mesh>
          <Bulb position={[0, -1.02, 0]} item={item} />
        </group>
      )

    case 'globe':
      return (
        <group>
          <mesh position={[0, -0.01, 0]} material={cable}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 20]} />
          </mesh>
          <mesh position={[0, -0.33, 0]} material={cable}>
            <cylinderGeometry args={[0.004, 0.004, 0.66, 6]} />
          </mesh>
          <mesh position={[0, -0.82, 0]} material={m.glow}>
            <sphereGeometry args={[0.16, 36, 24]} />
          </mesh>
          <Bulb position={[0, -0.82, 0]} item={item} />
        </group>
      )

    case 'sconce':
      return (
        <group>
          <mesh position={[0, 0, 0.012]} material={m.shade} castShadow>
            <boxGeometry args={[0.09, 0.14, 0.024]} />
          </mesh>
          <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} material={m.shade}>
            <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
          </mesh>
          <mesh position={[0, 0.04, 0.15]} material={m.shade} castShadow>
            <cylinderGeometry args={[0.09, 0.05, 0.13, 32, 1, true]} />
          </mesh>
          <mesh position={[0, 0.02, 0.15]} material={m.bulb}>
            <sphereGeometry args={[0.03, 12, 8]} />
          </mesh>
          <Bulb position={[0, 0.1, 0.15]} item={item} />
        </group>
      )

    case 'string':
      return <StringLights item={item} bulb={m.bulb} />
  }
}

function StringLights({ item, bulb }: { item: LampItem; bulb: THREE.Material }) {
  const L = item.length ?? 2.4
  const { curve, bulbs } = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const n = 16
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = -L / 2 + L * t
      // Two gentle swags between three anchor points.
      const sag = 0.12 * Math.sin(((t * 2) % 1) * Math.PI)
      pts.push(new THREE.Vector3(x, -sag, 0.03))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const count = Math.max(2, Math.round(L / 0.3))
    const bulbs = Array.from({ length: count }, (_, i) => curve.getPoint((i + 0.5) / count))
    return { curve, bulbs }
  }, [L])
  return (
    <group>
      <mesh material={cable}>
        <tubeGeometry args={[curve, 64, 0.003, 5, false]} />
      </mesh>
      {bulbs.map((p, i) => (
        <mesh key={i} position={[p.x, p.y - 0.035, p.z]} material={bulb}>
          <sphereGeometry args={[0.022, 12, 8]} />
        </mesh>
      ))}
      <Bulb position={[-L / 4, -0.15, 0.2]} item={item} scale={L / 2} />
      <Bulb position={[L / 4, -0.15, 0.2]} item={item} scale={L / 2} />
    </group>
  )
}
