interface DiscardBatchEntryResult<T> {
  entries: T[]
  nextActiveIndex: number
}

/**
 * batch から指定された entry を除外し、次に表示する有効な index を返す。
 * `activeIndex` (省略時は `index`) が現在表示中のカード — 表示中でないカードを
 * 除外した場合、表示中のカードが変わらないよう index を補正する。
 */
export function discardBatchEntry<T>(
  entries: T[],
  index: number,
  activeIndex: number = index,
): DiscardBatchEntryResult<T> {
  if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
    const boundedIndex = Number.isInteger(activeIndex)
      ? Math.min(Math.max(activeIndex, 0), Math.max(entries.length - 1, 0))
      : 0
    return {
      entries,
      nextActiveIndex: boundedIndex,
    }
  }

  const nextEntries = entries.filter((_, entryIndex) => entryIndex !== index)
  if (nextEntries.length === 0) {
    return { entries: nextEntries, nextActiveIndex: 0 }
  }

  // 表示中カードより前を除外 → 1 つ繰り上がる。表示中そのものを除外 → 同じ位置の次カード。
  const shifted = activeIndex > index
    ? activeIndex - 1
    : activeIndex === index
      ? index
      : activeIndex
  return {
    entries: nextEntries,
    nextActiveIndex: Math.min(Math.max(shifted, 0), nextEntries.length - 1),
  }
}
