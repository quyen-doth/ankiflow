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
  it('http URL/data でない → 0', () => {
    expect(dataUrlBytes('https://x.com/a.png')).toBe(0)
    expect(dataUrlBytes(undefined)).toBe(0)
    expect(dataUrlBytes('')).toBe(0)
  })

  it('base64 からバイト数を概算', () => {
    const bytes = dataUrlBytes(makeDataUrl(1000))
    expect(bytes).toBeGreaterThan(900)
    expect(bytes).toBeLessThan(1100)
  })
})

describe('validateCardEntry — image size', () => {
  it('画像 data URL が 800KB 超 → image エラーあり', () => {
    const errors = validateCardEntry(validEntry({ image_url: makeDataUrl(MAX_IMAGE_BYTES + 100_000) }), ['ct'])
    expect(errors.some(e => e.field === 'image')).toBe(true)
  })

  it('画像 data URL が小さい → image エラーなし', () => {
    const errors = validateCardEntry(validEntry({ image_url: makeDataUrl(100_000) }), ['ct'])
    expect(errors.some(e => e.field === 'image')).toBe(false)
  })

  it('画像 http URL (Unsplash) は長くても → image エラーなし', () => {
    const errors = validateCardEntry(validEntry({ image_url: 'https://images.unsplash.com/photo-x' }), ['ct'])
    expect(errors.some(e => e.field === 'image')).toBe(false)
  })
})
