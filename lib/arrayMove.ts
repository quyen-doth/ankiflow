/**
 * `from` の要素を `to` の位置に移動した新しい配列を返す。
 * 元の配列は変更しない。範囲外の index は [0, length-1] にクランプされる。
 */
export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const result = [...list]
  const max = result.length - 1
  if (max < 0) return result
  const f = Math.max(0, Math.min(from, max))
  const t = Math.max(0, Math.min(to, max))
  if (f === t) return result
  const [item] = result.splice(f, 1)
  result.splice(t, 0, item)
  return result
}
