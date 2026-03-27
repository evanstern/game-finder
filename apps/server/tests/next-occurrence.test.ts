import { describe, expect, it } from 'vitest'
import { computeNextOccurrence } from '../src/gathering/next-occurrence.js'

describe('computeNextOccurrence', () => {
  it('returns starts_at for one-off events', () => {
    const startsAt = new Date('2026-04-15T19:00:00Z')
    const result = computeNextOccurrence('once', startsAt, null)
    expect(result).toEqual(startsAt)
  })

  it('returns starts_at when it is in the future for weekly', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const result = computeNextOccurrence('weekly', future, null)
    expect(result).toEqual(future)
  })

  it('returns next matching weekday for weekly when starts_at is past', () => {
    const past = new Date('2025-01-06T19:00:00Z') // a Monday
    const result = computeNextOccurrence('weekly', past, null)
    expect(result).not.toBeNull()
    expect(result?.getDay()).toBe(1) // Monday
    expect(result?.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns correct biweekly occurrence', () => {
    const past = new Date('2025-01-06T19:00:00Z') // a Monday
    const result = computeNextOccurrence('biweekly', past, null)
    expect(result).not.toBeNull()
    expect(result?.getDay()).toBe(1) // Monday
    expect(result?.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns next matching day-of-month for monthly', () => {
    const past = new Date('2025-01-15T19:00:00Z') // 15th
    const result = computeNextOccurrence('monthly', past, null)
    expect(result).not.toBeNull()
    expect(result?.getDate()).toBe(15)
    expect(result?.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns null when recurring series is past end_date', () => {
    const past = new Date('2025-01-06T19:00:00Z')
    const endDate = new Date('2025-02-01')
    const result = computeNextOccurrence('weekly', past, endDate)
    expect(result).toBeNull()
  })
})
