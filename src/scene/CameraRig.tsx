import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../model/types'
import { isFlippable, mirrorCamera, sideOf } from '../project/cameraSides'
import { CAMERAS, CENTER_Z, SIDE_NAMES } from '../project/derived'
import { useView, type ViewPreset } from '../store'

const WIDE = 38
const EYE = 64

const FOV: Record<ViewPreset, number> = { 'iso-balcony': WIDE, 'iso-entry': WIDE, top: WIDE, 'from-balcony': EYE, 'from-entry': EYE }

/** The open plan's camera presets (src/project/derived.ts), with a lens each. */
export const PRESETS: Record<ViewPreset, { label: string; position: Vec3; target: Vec3; fov: number }> = Object.fromEntries(
  (Object.keys(FOV) as ViewPreset[]).map((id) => [id, { ...CAMERAS[id], fov: FOV[id] }]),
) as Record<ViewPreset, { label: string; position: Vec3; target: Vec3; fov: number }>

type Preset = (typeof PRESETS)[ViewPreset]

/** A preset as seen from its own side, or (iso views) mirrored to the other long side. */
export function presetCamera(id: ViewPreset, flipped: boolean): Preset {
  const p = PRESETS[id]
  return flipped && isFlippable(id) ? mirrorCamera(p, CENTER_Z) : p
}

/** Name of the side an iso view looks from, e.g. "bathroom". */
export function viewSide(id: ViewPreset, flipped: boolean): string {
  return SIDE_NAMES[sideOf(presetCamera(id, flipped), CENTER_Z) < 0 ? 0 : 1]
}

/** ?cam=x,y,z,tx,ty,tz[,fov] opens at an exact camera, for screenshots. */
const camParam = new URLSearchParams(window.location.search).get('cam')?.split(',').map(Number)

export function CameraRig() {
  const ref = useRef<CameraControls>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const preset = useView((s) => s.preset)
  const nonce = useView((s) => s.presetNonce)
  const flipped = useView((s) => (isFlippable(s.preset) ? s.isoFlip[s.preset] : false))
  const first = useRef(true)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (first.current && camParam && camParam.length >= 6) {
      camera.fov = camParam[6] || EYE
      camera.updateProjectionMatrix()
      c.setLookAt(camParam[0], camParam[1], camParam[2], camParam[3], camParam[4], camParam[5], false)
      first.current = false
      return
    }
    const p = presetCamera(preset, flipped)
    camera.fov = p.fov
    camera.updateProjectionMatrix()
    c.setLookAt(...p.position, ...p.target, !first.current)
    first.current = false
  }, [preset, nonce, flipped, camera])

  return <CameraControls ref={ref} makeDefault minDistance={0.1} maxDistance={30} dollyToCursor smoothTime={0.35} />
}
