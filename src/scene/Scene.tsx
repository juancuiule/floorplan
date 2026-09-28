import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { CameraRig } from './CameraRig'
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

function Lights() {
  const scene = useThree((s) => s.scene)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    target.position.set(3.8, 0, 1.5)
    scene.add(target)
    return () => void scene.remove(target)
  }, [scene, target])

  return (
    <>
      <hemisphereLight args={['#ffffff', '#d9cfc0', 1.5]} />
      <ambientLight intensity={0.6} />
      {/* Afternoon sun coming in low through the balcony opening */}
      <directionalLight
        position={[13, 7.5, -2.5]}
        target={target}
        intensity={2.4}
        color="#fff4e2"
        castShadow
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
    </>
  )
}

export function Scene() {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.05, far: 100, position: [11, 7.5, -4.5] }}
      gl={{ antialias: false, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#ecebe7']} />
      <Lights />
      <Floors />
      <Walls />
      <Ceilings />
      <Fixtures />
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
