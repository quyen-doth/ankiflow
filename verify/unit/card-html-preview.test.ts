import { beforeEach, describe, expect, it, vi } from 'vitest'
import { measureCardDocumentHeight } from '@/components/preview/CardHtmlPreview'

function cardRect(height: number): DOMRect {
  return {
    bottom: height,
    height,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}

function viewWithPadding(top: string, bottom: string) {
  return {
    getComputedStyle: () => ({
      paddingTop: top,
      paddingBottom: bottom,
    }) as CSSStyleDeclaration,
  }
}

describe('measureCardDocumentHeight', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="card">Preview</div>'
  })

  it('カード本体と body の上下 padding から必要な高さを算出する', () => {
    const card = document.querySelector<HTMLElement>('.card')
    vi.spyOn(card!, 'getBoundingClientRect').mockReturnValue(cardRect(248.2))

    expect(measureCardDocumentHeight(
      document,
      viewWithPadding('12.5px', '19.5px'),
    )).toBe(281)
  })

  it('内容が短くなった場合は以前の viewport 高に影響されず縮小する', () => {
    const card = document.querySelector<HTMLElement>('.card')
    let contentHeight = 320
    vi.spyOn(card!, 'getBoundingClientRect').mockImplementation(() => cardRect(contentHeight))
    const view = viewWithPadding('16px', '16px')

    expect(measureCardDocumentHeight(document, view)).toBe(352)

    contentHeight = 180
    expect(measureCardDocumentHeight(document, view)).toBe(212)
  })

  it('短い内容には最低高さを適用する', () => {
    const card = document.querySelector<HTMLElement>('.card')
    vi.spyOn(card!, 'getBoundingClientRect').mockReturnValue(cardRect(80))

    expect(measureCardDocumentHeight(
      document,
      viewWithPadding('16px', '16px'),
    )).toBe(160)
  })

  it('カード要素がない document は計測不能として扱う', () => {
    document.body.innerHTML = ''

    expect(measureCardDocumentHeight(document)).toBeNull()
  })
})
