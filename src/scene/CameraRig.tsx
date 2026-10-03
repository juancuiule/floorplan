import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { isFlippable } from '../project/cameraSides'
import { useView } from '../store'
import { EYE_FOV, presetCamera } from './cameraPresets'

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
      camera.fov = camParam[6] || EYE_FOV
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
