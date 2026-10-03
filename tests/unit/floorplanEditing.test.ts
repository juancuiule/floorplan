import { describe, expect, it } from 'vitest'
import type { SketchRoom } from '../../src/model/sketch'
import { edgeLines, openingSpot, overlapping, rectFrom, roomAt, snap, toGrid } from '../../src/pages/floorplan/editing'

const room = (id: string, rect: SketchRoom['rect']): SketchRoom => ({ id, name: '', kind: 'living', rect })

describe('floor plan editing', () => {
  it('snaps to another room’s edge when close, else to the 5 cm grid', () => {
    expect(snap(4.08, [4])).toBe(4)
    expect(snap(4.3, [4])).toBe(4.3)
    expect(snap(4.32, [4])).toBe(4.3)
    expect(toGrid(1.024)).toBe(1)
  })

  it('collects the edges of the other rooms only', () => {
    expect(edgeLines([room('a', [0, 0, 4, 3]), room('b', [4, 0, 6, 3])], 'b')).toEqual({ x: [0, 4], z: [0, 3] })
  })

  it('orders a drawn rectangle and keeps it at least 60 cm a side', () => {
    expect(rectFrom([4, 3], [0, 0])).toEqual([0, 0, 4, 3])
    expect(rectFrom([1, 1], [1.2, 1.1])).toEqual([1, 1, 1.6, 1.6])
  })

  it('finds rooms that overlap, but not rooms that only share a wall', () => {
    expect(overlapping([room('a', [0, 0, 4, 3]), room('b', [4, 0, 6, 3])])).toEqual([])
    expect(overlapping([room('a', [0, 0, 4, 3]), room('b', [3.5, 0, 6, 3])]).sort()).toEqual(['a', 'b'])
  })

  it('picks the innermost room under the pointer', () => {
    const rooms = [room('big', [0, 0, 6, 6]), room('small', [1, 1, 2, 2])]
    expect(roomAt(rooms, [1.5, 1.5])?.id).toBe('small')
    expect(roomAt(rooms, [5, 5])?.id).toBe('big')
    expect(roomAt(rooms, [7, 7])).toBeUndefined()
  })

  it('puts an opening on the nearest wall, kept inside it', () => {
    const rooms = [room('a', [0, 0, 4, 3])]
    expect(openingSpot(rooms, [2, 0.2], 0.9)).toEqual([2, 0])
    // Near a corner, it slides along the wall so it fits.
    expect(openingSpot(rooms, [0.1, 0.1], 0.9)).toEqual([0.5, 0])
    expect(openingSpot(rooms, [2, 1.5], 0.9)).toBeNull()
  })
})
