import { describe, expect, it } from 'vitest'
import { arrayMove } from '@/lib/arrayMove'

describe('arrayMove', () => {
  it('要素を先頭に移動', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('要素を末尾に移動', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('1 つ下の位置に移動', () => {
    expect(arrayMove(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('from === to → 変更なし', () => {
    expect(arrayMove(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('元の配列を変更しない', () => {
    const orig = ['a', 'b', 'c']
    arrayMove(orig, 0, 2)
    expect(orig).toEqual(['a', 'b', 'c'])
  })

  it('範囲外の index はクランプされる', () => {
    expect(arrayMove(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a'])
    expect(arrayMove(['a', 'b', 'c'], -5, 2)).toEqual(['b', 'c', 'a'])
  })

  it('空の配列', () => {
    expect(arrayMove([], 0, 1)).toEqual([])
  })
})
