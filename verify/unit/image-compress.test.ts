import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compressImageFile,
  computeTargetDimensions,
  resolveCompressionMimeType,
} from '@/lib/image/compress'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveCompressionMimeType', () => {
  it('JPEG/PNG/WebP は入力 MIME を保つ', () => {
    expect(resolveCompressionMimeType('image/jpeg')).toBe('image/jpeg')
    expect(resolveCompressionMimeType('image/jpg')).toBe('image/jpeg')
    expect(resolveCompressionMimeType('image/png')).toBe('image/png')
    expect(resolveCompressionMimeType('image/webp')).toBe('image/webp')
  })

  it('GIF animation は canvas 再エンコードを回避する', () => {
    expect(resolveCompressionMimeType('image/gif')).toBeNull()
  })

  it('その他の image format は PNG、明示 override は指定 MIME を使う', () => {
    expect(resolveCompressionMimeType('image/bmp')).toBe('image/png')
    expect(resolveCompressionMimeType('image/svg+xml')).toBe('image/png')
    expect(resolveCompressionMimeType('image/gif', 'image/webp')).toBe('image/webp')
  })

  it('GIF は実際の compressor でも canvas を使わず元 data URL を返す', async () => {
    const createElement = vi.spyOn(document, 'createElement')
    const file = new File(['GIF89a'], 'animated.gif', { type: 'image/gif' })

    const result = await compressImageFile(file)

    expect(result).toMatch(/^data:image\/gif;base64,/)
    expect(createElement).not.toHaveBeenCalled()
  })
})

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
