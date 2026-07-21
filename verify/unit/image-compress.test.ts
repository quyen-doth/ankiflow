import { describe, expect, it } from 'vitest'
import { computeTargetDimensions } from '@/lib/image/compress'

describe('computeTargetDimensions', () => {
  it('does not scale when both sides are within the limit', () => {
    expect(computeTargetDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(computeTargetDimensions(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })

  it('scales a landscape image down by its longest side (width)', () => {
    expect(computeTargetDimensions(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
  })

  it('scales a portrait image down by its longest side (height)', () => {
    expect(computeTargetDimensions(1200, 2400, 1600)).toEqual({ width: 800, height: 1600 })
  })

  it('preserves aspect ratio within rounding', () => {
    const { width, height } = computeTargetDimensions(4000, 3000, 1600)
    expect(width).toBe(1600)
    expect(height).toBe(1200)
    expect(width / height).toBeCloseTo(4000 / 3000, 2)
  })

  it('never upscales a small image', () => {
    expect(computeTargetDimensions(200, 100, 1600)).toEqual({ width: 200, height: 100 })
  })

  it('returns invalid/zero dimensions unchanged', () => {
    expect(computeTargetDimensions(0, 0, 1600)).toEqual({ width: 0, height: 0 })
    expect(computeTargetDimensions(-10, 100, 1600)).toEqual({ width: -10, height: 100 })
  })
})
