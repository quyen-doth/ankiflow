import { describe, expect, it } from 'vitest'
import { validateCardEntry, dataUrlBytes, MAX_IMAGE_BYTES } from '@/lib/cardValidation'
import { FormType, type Entry } from '@/types'

/** Tạo data URL ~sizeBytes byte (base64 dài ≈ sizeBytes * 4/3). */
function makeDataUrl(sizeBytes: number): string {
  const b64 = 'A'.repeat(Math.ceil((sizeBytes * 4) / 3))
  return `data:image/png;base64,${b64}`
}

function validEntry(overrides: Partial<Entry> = {}): Partial<Entry> {
  return {
    form_type: FormType.GENERAL, // yêu cầu: word + meaning
    title: 'hello',
    content: 'xin chào',
    anki_deck: 'Test',
    ...overrides,
  }
}

describe('dataUrlBytes', () => {
  it('URL http/không data → 0', () => {
    expect(dataUrlBytes('https://x.com/a.png')).toBe(0)
    expect(dataUrlBytes(undefined)).toBe(0)
    expect(dataUrlBytes('')).toBe(0)
  })

  it('ước lượng byte gần đúng từ base64', () => {
    const bytes = dataUrlBytes(makeDataUrl(1000))
    expect(bytes).toBeGreaterThan(900)
    expect(bytes).toBeLessThan(1100)
  })
})

describe('validateCardEntry — image size', () => {
  it('ảnh data URL > 800KB → có lỗi image', () => {
    const errors = validateCardEntry(validEntry({ image_url: makeDataUrl(MAX_IMAGE_BYTES + 100_000) }), ['ct'])
    expect(errors.some(e => e.field === 'image')).toBe(true)
  })

  it('ảnh data URL nhỏ → không lỗi image', () => {
    const errors = validateCardEntry(validEntry({ image_url: makeDataUrl(100_000) }), ['ct'])
    expect(errors.some(e => e.field === 'image')).toBe(false)
  })

  it('ảnh URL http (Unsplash) dù dài → không lỗi image', () => {
    const errors = validateCardEntry(validEntry({ image_url: 'https://images.unsplash.com/photo-x' }), ['ct'])
    expect(errors.some(e => e.field === 'image')).toBe(false)
  })
})
