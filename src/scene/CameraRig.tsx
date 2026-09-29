import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../model/types'
import { useView, type ViewPreset } from '../store'

const WIDE = 38
const EYE = 64

export const PRESETS: Record<ViewPreset, { label: string; position: Vec3; target: Vec3; fov: number }> = {
  'iso-balcony': { label: 'Iso · balcony', position: [11.2, 7.6, -4.6], target: [4.0, 0.4, 1.5], fov: WIDE },
  'iso-entry': { label: 'Iso · entry', position: [-3.8, 7.6, 7.4], target: [4.0, 0.4, 1.5], fov: WIDE },
  top: { label: 'Top', position: [4.1, 13.5, 1.5001], target: [4.1, 0, 1.5], fov: WIDE },
  'from-balcony': { label: 'From balcony', position: [8.2, 1.55, 1.5], target: [0, 1.2, 1.6], fov: EYE },
  'from-entry': { label: 'From entry', position: [0.9, 1.6, 1.95], target: [6.9, 1.1, 1.3], fov: EYE },
}

/** ?cam=x,y,z,tx,ty,tz[,fov] opens at an exact camera, for screenshots. */
const camParam = new URLSearchParams(window.location.search).get('cam')?.split(',').map(Number)

export function CameraRig() {
  const ref = useRef<CameraControls>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const preset = useView((s) => s.preset)
  const nonce = useView((s) => s.presetNonce)
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
    const p = PRESETS[preset]
    camera.fov = p.fov
    camera.updateProjectionMatrix()
    c.setLookAt(...p.position, ...p.target, !first.current)
    first.current = false
  }, [preset, nonce, camera])

  return <CameraControls ref={ref} makeDefault minDistance={0.1} maxDistance={30} dollyToCursor smoothTime={0.35} />
}
