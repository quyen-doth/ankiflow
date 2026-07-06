/**
 * Trả về một mảng mới với phần tử ở `from` được chuyển tới vị trí `to`.
 * Không thay đổi mảng gốc. Index ngoài biên được kẹp về [0, length-1].
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
