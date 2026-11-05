/** Axis scaling for the usage charts: readable steps and k/M/B labels. */

import { describe, expect, it } from 'vitest'
import { formatAxisValue, niceAxis } from '../src/client/chartShared.ts'

describe('niceAxis', () => {
  it('picks a step from the data magnitude instead of an arbitrary division', () => {
    expect(niceAxis(34_000_000).ticks).toEqual([0, 10_000_000, 20_000_000, 30_000_000, 40_000_000])
    expect(niceAxis(123_000_000).ticks).toEqual([0, 50_000_000, 100_000_000, 150_000_000])
    expect(niceAxis(480_000_000).ticks).toEqual([
      0, 100_000_000, 200_000_000, 300_000_000, 400_000_000, 500_000_000,
    ])
  })

  it('keeps small magnitudes in their own units', () => {
    expect(niceAxis(640).ticks).toEqual([0, 200, 400, 600, 800])
    expect(niceAxis(3).ticks).toEqual([0, 1, 2, 3])
  })

  it('reports no ticks for an empty plot', () => {
    expect(niceAxis(0)).toEqual({ max: 0, ticks: [0] })
  })
})

describe('formatAxisValue', () => {
  it('uses M for millions and k for thousands', () => {
    expect(formatAxisValue(0)).toBe('0')
    expect(formatAxisValue(500)).toBe('500')
    expect(formatAxisValue(20_000)).toBe('20k')
    expect(formatAxisValue(1_500_000)).toBe('1.5M')
    expect(formatAxisValue(100_000_000)).toBe('100M')
    expect(formatAxisValue(500_000_000)).toBe('500M')
    expect(formatAxisValue(2_000_000_000)).toBe('2B')
  })
})
