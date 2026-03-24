import { describe, expect, it } from 'vitest'
import { haversineDistanceMiles } from '../src/gathering/haversine.js'

describe('haversineDistanceMiles', () => {
  it('returns 0 for the same point', () => {
    const distance = haversineDistanceMiles(40.7128, -74.006, 40.7128, -74.006)
    expect(distance).toBe(0)
  })

  it('calculates distance between New York and Los Angeles (~2,451 mi)', () => {
    const distance = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437)
    expect(distance).toBeGreaterThan(2400)
    expect(distance).toBeLessThan(2500)
  })

  it('calculates short distance between nearby ZIP codes (~5 mi)', () => {
    // Manhattan (10001) to Brooklyn (11201) is roughly 3-5 miles
    const distance = haversineDistanceMiles(40.7484, -73.9967, 40.6892, -73.9857)
    expect(distance).toBeGreaterThan(2)
    expect(distance).toBeLessThan(10)
  })
})
