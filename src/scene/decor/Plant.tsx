import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { POTS } from '../../decor/catalog'
import type { PlantItem, PotStyle } from '../../model/decor'
import { buildPlant, type PlantMat } from './plantGeometry'

const MATS: Record<Exclude<PlantMat, 'pot'>, THREE.MeshStandardMaterial> = {
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
}

const potMaterials = new Map<PotStyle, THREE.MeshStandardMaterial>()
function potMaterial(style: PotStyle) {
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
  const model = useMemo(() => buildPlant(item.species, item.pot, item.id), [item.species, item.pot, item.id])
  useEffect(() => () => model.parts.forEach((p) => p.geometry.dispose()), [model])
  return (
    <group scale={item.scale}>
      {model.parts.map((p) => (
        <mesh key={p.mat} geometry={p.geometry} material={p.mat === 'pot' ? potMaterial(item.pot) : MATS[p.mat]} castShadow receiveShadow />
      ))}
    </group>
  )
}
