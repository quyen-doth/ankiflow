import { describe, expect, it } from 'vitest'
import { arrayMove } from '@/lib/arrayMove'

describe('arrayMove', () => {
  it('chuyển phần tử lên đầu', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('chuyển phần tử xuống cuối', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('chuyển xuống 1 vị trí', () => {
    expect(arrayMove(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('from === to → giữ nguyên', () => {
    expect(arrayMove(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('không thay đổi mảng gốc', () => {
    const orig = ['a', 'b', 'c']
    arrayMove(orig, 0, 2)
    expect(orig).toEqual(['a', 'b', 'c'])
  })

  it('index ngoài biên được kẹp', () => {
    expect(arrayMove(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a'])
    expect(arrayMove(['a', 'b', 'c'], -5, 2)).toEqual(['b', 'c', 'a'])
  })

  it('mảng rỗng', () => {
    expect(arrayMove([], 0, 1)).toEqual([])
  })
})
