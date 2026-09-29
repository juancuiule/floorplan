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
import { Clearances } from './Clearances'
import { requestShadowUpdate, takeShadowUpdate } from './shadows'
import { DecorLayer, SurfaceEvents } from './decor/DecorLayer'
import { Ceilings, Floors } from './Floors'
import { Fixtures } from './Fixtures'
import { Labels } from './Labels'
import { Measure } from './Measure'
import { Walk } from './Walk'
import { Walls } from './Walls'

declare global {
  interface Window {
    __frames?: number
    /** Renderer counters for the last rendered frame (all passes, shadows included). */
    /** Requests one render (the canvas renders on demand). */
    __invalidate?: () => void
    /** Dev only: the scene graph, for scripts that inspect it. */
    __scene?: THREE.Scene
    __stats?: { calls: number; triangles: number; lines: number; points: number; programs: number; geometries: number; textures: number }
  }
}

const WARMUP_FRAMES = 60

/**
 * Counts rendered frames (scripts wait on window.__frames) and publishes
 * renderer.info for the whole frame. Runs after the EffectComposer (priority 1).
 */
function FrameCounter() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    gl.info.autoReset = false
    window.__invalidate = () => invalidate()
    if (import.meta.env.DEV) window.__scene = scene
    return () => {
      gl.info.autoReset = true
      delete window.__invalidate
    }
  }, [gl, invalidate, scene])
  useFrame(() => {
    const n = (window.__frames = (window.__frames ?? 0) + 1)
    // Warm up: render continuously for the first frames while programs
    // compile and textures upload; after that frames are rendered on demand.
    if (n < WARMUP_FRAMES) invalidate()
    const { render, memory, programs } = gl.info
    window.__stats = {
      calls: render.calls,
      triangles: render.triangles,
      lines: render.lines,
      points: render.points,
      programs: programs?.length ?? 0,
      geometries: memory.geometries,
      textures: memory.textures,
    }
    gl.info.reset()
  }, 2)
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
        const v = useView.getState()
        if (!d.movingId && !v.walking && !v.tool) d.select(null)
      }}
      frameloop="demand"
      shadows="soft"
      // Every pixel pays for N8AO, SMAA and tone mapping; past 1.5x the extra
      // sharpness is hard to see and costs ~1.8x the fill of 1.5x.
      dpr={[1, 1.5]}
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
        {/* Decor is a surface too: plants on the desk, lamps on shelves. */}
        <DecorLayer />
      </SurfaceEvents>
      <Labels />
      <CameraRig />
      <Walk />
      <Measure />
      <Clearances />
      <FrameCounter />
      <Effects />
    </Canvas>
  )
}

/**
 * Postprocessing. MSAA on the scene target only at 1x: on high-density
 * screens the pixels are small enough for SMAA alone, and 4x MSAA on a
 * half-float target at 1.5x DPR is a large share of the frame's bandwidth.
 */
function Effects() {
  const dpr = useThree((s) => s.viewport.dpr)
  return (
    <EffectComposer multisampling={dpr > 1.2 ? 0 : 4}>
      <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={0.8} halfRes />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
