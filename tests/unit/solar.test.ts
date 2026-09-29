// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  compassBearing,
  compassName,
  formatMinutes,
  parseClock,
  parseFacing,
  solarPosition,
  sunDirection,
  sunTimes,
  todayIn,
} from '../../src/sun/solar'

const clock = (hhmm: string) => parseClock(hhmm)!

describe('solar position in Buenos Aires', () => {
  it('peaks near 78.8° at the December solstice and 32° at the June solstice', () => {
    const dec = sunTimes('2025-12-21')
    const jun = sunTimes('2026-06-21')
    // 90 − |lat − declination|
    expect(solarPosition('2025-12-21', dec.noon).elevation).toBeCloseTo(78.8, 0)
    expect(solarPosition('2026-06-21', jun.noon).elevation).toBeCloseTo(32.0, 0)
  })

  it('puts solar noon about 53 minutes after 12:00 (the city is west of its time zone)', () => {
    expect(sunTimes('2025-12-21').noon).toBeGreaterThan(clock('12:48'))
    expect(sunTimes('2025-12-21').noon).toBeLessThan(clock('12:54'))
    expect(sunTimes('2026-06-21').noon).toBeGreaterThan(clock('12:52'))
    expect(sunTimes('2026-06-21').noon).toBeLessThan(clock('12:58'))
  })

  it('has the sun due north at solar noon and rising in the east', () => {
    const { noon, sunrise, sunset } = sunTimes('2026-03-20')
    const az = solarPosition('2026-03-20', noon).azimuth
    expect(Math.min(az, 360 - az)).toBeLessThan(1)
    expect(solarPosition('2026-03-20', sunrise + 1).azimuth).toBeCloseTo(90, -1)
    expect(solarPosition('2026-03-20', sunset - 1).azimuth).toBeCloseTo(270, -1)
    // Winter sunrise is north of east, summer sunrise south of it.
    expect(solarPosition('2026-06-21', sunTimes('2026-06-21').sunrise + 1).azimuth).toBeLessThan(65)
    expect(solarPosition('2025-12-21', sunTimes('2025-12-21').sunrise + 1).azimuth).toBeGreaterThan(110)
  })

  it('matches published sunrise and sunset times within a few minutes', () => {
    // timeanddate.com / Servicio de Hidrografía Naval, Buenos Aires.
    const cases: [string, string, string][] = [
      ['2025-12-21', '05:37', '20:06'],
      ['2026-06-21', '08:00', '17:50'],
    ]
    for (const [date, rise, set] of cases) {
      const t = sunTimes(date)
      expect(Math.abs(t.sunrise - clock(rise)), `${date} sunrise ${formatMinutes(t.sunrise)}`).toBeLessThan(4)
      expect(Math.abs(t.sunset - clock(set)), `${date} sunset ${formatMinutes(t.sunset)}`).toBeLessThan(4)
    }
  })

  it('has the apparent sun on the horizon at sunrise and sunset', () => {
    const t = sunTimes('2026-06-21')
    expect(solarPosition('2026-06-21', t.sunrise).elevation).toBeCloseTo(-0.27, 0)
    expect(solarPosition('2026-06-21', t.sunset).elevation).toBeCloseTo(-0.27, 0)
    expect(solarPosition('2026-06-21', clock('03:00')).elevation).toBeLessThan(-30)
  })
})

describe('orientation', () => {
  it('maps compass points and free angles', () => {
    expect(compassBearing('N')).toBe(0)
    expect(compassBearing('SW')).toBe(225)
    expect(parseFacing('nw')).toBe(315)
    expect(parseFacing('100')).toBe(100)
    expect(parseFacing('-90')).toBe(270)
    expect(parseFacing('up')).toBeNull()
    expect(compassName(270)).toBe('W')
    expect(compassName(359.5)).toBe('N')
    expect(compassName(100)).toBeNull()
  })

  it('points +x at the sun when the sun is where the balcony faces', () => {
    const [x, y, z] = sunDirection({ azimuth: 0, elevation: 0 }, 0)
    expect(x).toBeCloseTo(1)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
  })

  it('turns clockwise from +x to +z, like compass bearings seen from above', () => {
    // Balcony facing north: the eastern (morning) sun is on the +z side.
    const [x, , z] = sunDirection({ azimuth: 90, elevation: 0 }, 0)
    expect(x).toBeCloseTo(0)
    expect(z).toBeCloseTo(1)
    // Balcony facing west: the northern noon sun is also on the +z side.
    expect(sunDirection({ azimuth: 0, elevation: 30 }, 270)[2]).toBeGreaterThan(0.8)
    // Straight up stays straight up.
    expect(sunDirection({ azimuth: 123, elevation: 90 }, 45)[1]).toBeCloseTo(1)
  })
})

describe('time helpers', () => {
  it('formats and parses clock times', () => {
    expect(formatMinutes(0)).toBe('00:00')
    expect(formatMinutes(1059.6)).toBe('17:40')
    expect(formatMinutes(1440)).toBe('00:00')
    expect(parseClock('9:05')).toBe(545)
    expect(parseClock('24:00')).toBeNull()
  })

  it('knows the date in Buenos Aires, three hours behind UTC', () => {
    expect(todayIn(undefined, Date.UTC(2026, 0, 1, 2, 0))).toBe('2025-12-31')
    expect(todayIn(undefined, Date.UTC(2026, 0, 1, 4, 0))).toBe('2026-01-01')
  })
})
