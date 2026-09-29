import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useDecor } from '../decor/store'
import type { Vec3 } from '../model/types'
import { project } from '../project'
import { useView } from '../store'
import { CameraRig } from './CameraRig'
import { requestShadowUpdate, takeShadowUpdate } from './shadows'
import { DecorLayer, SurfaceEvents } from './decor/DecorLayer'
import { Ceilings, Floors } from './Floors'
import { Fixtures } from './Fixtures'
import { Labels } from './Labels'
import { Walls } from './Walls'

declare global {
  interface Window {
    __frames?: number
  }
}

function FrameCounter() {
  useFrame(() => {
    window.__frames = (window.__frames ?? 0) + 1
  })
  return null
}

/** Renders shadow maps only on request (see shadows.ts). */
function ShadowController() {
  const gl = useThree((s) => s.gl)
  const lighting = useView((s) => s.lighting)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    return () => void (gl.shadowMap.autoUpdate = true)
  }, [gl])
  useEffect(() => requestShadowUpdate(), [lighting])
  useFrame(() => {
    if (takeShadowUpdate()) gl.shadowMap.needsUpdate = true
  })
  return null
}

function Lights() {
  const scene = useThree((s) => s.scene)
  const evening = useView((s) => s.lighting === 'evening')
  const downlights = useView((s) => s.downlights)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    target.position.set(3.8, 0, 1.5)
    scene.add(target)
    return () => void scene.remove(target)
  }, [scene, target])

  return (
    <>
      <color attach="background" args={[evening ? '#1d1f24' : '#ecebe7']} />
      <hemisphereLight args={evening ? ['#9fb2d6', '#2a2622', 0.12] : ['#ffffff', '#d9cfc0', 1.5]} />
      <ambientLight intensity={evening ? 0.04 : 0.6} />
      {/* Afternoon sun coming in low through the balcony opening */}
      <directionalLight
        position={[13, 7.5, -2.5]}
        target={target}
        intensity={evening ? 0 : 2.4}
        color="#fff4e2"
        castShadow={!evening}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
      {evening && downlights && project.objects.filter((o) => o.type === 'downlight').map((o) => <Downlight key={o.id} at={o.position} />)}
    </>
  )
}

/** Warm recessed spot pointing straight down. */
function Downlight({ at }: { at: Vec3 }) {
  const scene = useThree((s) => s.scene)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    target.position.set(at[0], 0, at[2])
    scene.add(target)
    return () => void scene.remove(target)
  }, [scene, target, at])
  return <spotLight position={[at[0], at[1] - 0.02, at[2]]} target={target} angle={0.85} penumbra={0.7} intensity={4} decay={2} distance={6} color="#ffe6c8" />
}

export function Scene() {
  return (
    <Canvas
      onPointerMissed={() => {
        const d = useDecor.getState()
        if (!d.movingId) d.select(null)
      }}
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.05, far: 100, position: [11, 7.5, -4.5] }}
      gl={{ antialias: false }}
    >
      <ShadowController />
      <Lights />
      <SurfaceEvents>
        <Floors />
        <Walls />
        <Ceilings />
        <Fixtures />
      </SurfaceEvents>
      <DecorLayer />
      <Labels />
      <CameraRig />
      <FrameCounter />
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={0.8} halfRes />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  )
}
