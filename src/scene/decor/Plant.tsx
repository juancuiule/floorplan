import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { POTS } from '../../decor/catalog'
import type { PlantItem, PotStyle } from '../../model/decor'
import { buildPlant, POT_SIZES, type PlantMat } from './plantGeometry'

export const MATS: Record<Exclude<PlantMat, 'pot'>, THREE.MeshStandardMaterial> = {
  leaf: new THREE.MeshStandardMaterial({ color: '#4f8a45', roughness: 0.6, side: THREE.DoubleSide }),
  leafDark: new THREE.MeshStandardMaterial({ color: '#2f6533', roughness: 0.5, side: THREE.DoubleSide }),
  leafLight: new THREE.MeshStandardMaterial({ color: '#7aa655', roughness: 0.65, side: THREE.DoubleSide }),
  leafSilver: new THREE.MeshStandardMaterial({ color: '#8e9c7c', roughness: 0.8, flatShading: true }),
  stem: new THREE.MeshStandardMaterial({ color: '#557a3a', roughness: 0.7 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#6e5a45', roughness: 0.9 }),
  soil: new THREE.MeshStandardMaterial({ color: '#3d3027', roughness: 1 }),
  flower: new THREE.MeshStandardMaterial({ color: '#8c7cc6', roughness: 0.8 }),
  cactus: new THREE.MeshStandardMaterial({ color: '#4f7f4b', roughness: 0.7 }),
  cord: new THREE.MeshStandardMaterial({ color: '#d9c9a8', roughness: 0.9 }),
  succulent: new THREE.MeshStandardMaterial({ color: '#8fb09e', roughness: 0.55, side: THREE.DoubleSide }),
  saucer: new THREE.MeshStandardMaterial({ color: '#b86d48', roughness: 0.9, side: THREE.DoubleSide }),
  jade: new THREE.MeshStandardMaterial({ color: '#5e8f4e', roughness: 0.45 }),
  variegated: new THREE.MeshStandardMaterial({ color: '#c8cf8f', roughness: 0.5, side: THREE.DoubleSide }),
  crotonRed: new THREE.MeshStandardMaterial({ color: '#b9472f', roughness: 0.5, side: THREE.DoubleSide }),
  crotonYellow: new THREE.MeshStandardMaterial({ color: '#d8ab3b', roughness: 0.5, side: THREE.DoubleSide }),
}

const potMaterials = new Map<PotStyle, THREE.MeshStandardMaterial>()
export function potMaterial(style: PotStyle) {
  let m = potMaterials.get(style)
  if (!m) {
    const color = POTS.find((p) => p.id === style)?.color ?? '#ccc'
    m = new THREE.MeshStandardMaterial({ color, roughness: style === 'ceramic' ? 0.35 : 0.9, side: THREE.DoubleSide })
    potMaterials.set(style, m)
  }
  return m
}

/** A potted (or hanging) plant in local space, base at the origin. */
export function Plant({ item }: { item: PlantItem }) {
  // A standard clay pot size scales the whole plant so the pot has that diameter.
  const clay = item.potSize !== undefined && item.potSize !== 'auto'
  const pot = clay ? 'clay' : item.pot
  const fit = clay ? (Number(item.potSize) / 200) / POT_SIZES[item.species].r : 1
  const seed = item.seed ?? item.id
  const model = useMemo(() => buildPlant(item.species, pot, seed, { count: item.count, spread: item.spread }), [item.species, pot, seed, item.count, item.spread])
  useEffect(() => () => model.parts.forEach((p) => p.geometry.dispose()), [model])
  return (
    <group scale={item.scale * fit}>
      {model.parts.map((p) => (
        <mesh key={p.mat} geometry={p.geometry} material={p.mat === 'pot' ? potMaterial(pot) : MATS[p.mat]} castShadow receiveShadow />
      ))}
    </group>
  )
}
