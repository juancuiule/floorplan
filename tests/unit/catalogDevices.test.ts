// @vitest-environment node
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FURNITURE, FURNITURE_GROUPS, FURNITURE_KEYWORDS } from '../../src/decor/furnitureCatalog'
import { placeAt } from '../../src/decor/placement'
import type { FurnitureItem, FurnitureType } from '../../src/model/decor'
import { FURNITURE_ICON } from '../../src/ui/icons'

const DEVICES: FurnitureType[] = ['speakers', 'standMixer', 'espressoMachine', 'turntable', 'acIndoor', 'acOutdoor']

const item = (type: FurnitureType, options = {}): FurnitureItem => {
  const s = FURNITURE[type]
  return { kind: 'furniture', id: `t-${type}`, type, at: [0, 0, 0], rotation: 0, size: [...s.size], finish: { ...s.finish }, options: { ...s.options, ...options } }
}

describe('appliances & electronics', () => {
  it('has its own panel group holding every device', () => {
    expect(FURNITURE_GROUPS).toContain('Appliances & electronics')
    for (const t of DEVICES) {
      expect(FURNITURE[t].group, t).toBe('Appliances & electronics')
      expect(FURNITURE[t].note.length, t).toBeGreaterThan(0)
      expect(FURNITURE_KEYWORDS[t], t).toBeTruthy()
      expect(FURNITURE_ICON[t], t).toBe(t)
    }
  })

  it('uses the real products’ dimensions', () => {
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 2))
    near(FURNITURE.standMixer.size, [0.24, 0.36, 0.36])
    near(FURNITURE.espressoMachine.size, [0.22, 0.3, 0.28])
    near(FURNITURE.turntable.size, [0.45, 0.157, 0.352])
    near(FURNITURE.acIndoor.size, [0.8, 0.28, 0.21])
    near(FURNITURE.acOutdoor.size, [0.78, 0.55, 0.29])
    // Two 15.5 cm speakers with the default 60 cm gap between them.
    near(FURNITURE.speakers.size, [0.91, 0.24, 0.2])
  })

  it('mounts the indoor AC unit on a wall and everything else on a surface', () => {
    expect(FURNITURE.acIndoor.mount).toBe('wall')
    for (const t of DEVICES.filter((t) => t !== 'acIndoor')) expect(FURNITURE[t].mount, t).toBe('surface')
  })

  it('default sizes agree with the default options', () => {
    for (const t of Object.keys(FURNITURE) as FurnitureType[]) {
      const s = FURNITURE[t]
      if (s.sizeFor) expect(s.sizeFor(s.options, s.size), t).toEqual(s.size)
    }
  })

  it('speaker spacing and the condenser bracket resize the footprint', () => {
    const sp = FURNITURE.speakers
    expect(sp.sizeFor!({ ...sp.options, spacing: 100 }, sp.size)[0]).toBeCloseTo(1.31, 3)
    const ac = FURNITURE.acOutdoor
    expect(ac.sizeFor!({ ...ac.options, bracket: true, lift: 120 }, ac.size)[1]).toBeCloseTo(1.75, 3)
    expect(ac.sizeFor!({ ...ac.options, bracket: false, lift: 120 }, ac.size)[1]).toBeCloseTo(0.55, 3)
  })

  it('the indoor AC unit settles at its usual height when placed near it', () => {
    const hit = (y: number) => ({ point: new THREE.Vector3(3, y, 0.1), normal: new THREE.Vector3(0, 0, 1), kind: 'wall' as const })
    const ac = item('acIndoor')
    // Pointer at the unit's center: bottom edge 14 cm below it.
    expect((placeAt(ac, hit(2.1))!.at as number[])[1]).toBe(2.1)
    expect((placeAt(ac, hit(2.5))!.at as number[])[1]).toBe(2.1)
    expect((placeAt(ac, hit(1.2))!.at as number[])[1]).toBeCloseTo(1.06, 2)
    // Other wall pieces keep following the pointer.
    expect((placeAt(item('floatingShelf'), hit(2.1))!.at as number[])[1]).toBeCloseTo(2.08, 2)
  })
})
