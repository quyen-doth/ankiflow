interface DiscardBatchEntryResult<T> {
  entries: T[]
  nextActiveIndex: number
}

/** batch から指定された entry を除外し、次に表示する有効な index を返す。 */
export function discardBatchEntry<T>(
  entries: T[],
  index: number,
): DiscardBatchEntryResult<T> {
  if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
    const boundedIndex = Number.isInteger(index)
      ? Math.min(Math.max(index, 0), Math.max(entries.length - 1, 0))
      : 0
    return {
      entries,
      nextActiveIndex: boundedIndex,
    }
  }

  const nextEntries = entries.filter((_, entryIndex) => entryIndex !== index)
  return {
    entries: nextEntries,
    nextActiveIndex: nextEntries.length === 0
      ? 0
      : Math.min(index, nextEntries.length - 1),
  }
}
