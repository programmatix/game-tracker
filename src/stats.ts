export function incrementCount(
  record: Record<string, number>,
  key: string,
  amount = 1,
): void {
  record[key] = (record[key] ?? 0) + amount
}

export function sortKeysByCountDesc(counts: Record<string, number>): string[] {
  return Object.keys(counts).sort((a, b) => {
    const delta = (counts[b] ?? 0) - (counts[a] ?? 0)
    if (delta !== 0) return delta
    return a.localeCompare(b)
  })
}

export function mergeCanonicalKeys(
  observedKeys: string[],
  canonicalKeys: string[],
  normalize: (value: string) => string = (value) => value.trim().toLowerCase(),
): string[] {
  const merged: string[] = []
  const seen = new Set<string>()

  for (const key of observedKeys) {
    const normalized = normalize(key)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    merged.push(key)
  }

  for (const key of canonicalKeys) {
    const normalized = normalize(key)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    merged.push(key)
  }

  return merged
}

export function sortKeysByGroupThenCountDesc(
  keys: string[],
  counts: Record<string, number>,
  groupBy: (key: string) => string | undefined,
  groupOrder?: string[],
): string[] {
  const groupOrderIndex = new Map<string, number>()
  if (groupOrder) {
    for (const group of groupOrder) {
      const normalized = group.trim()
      if (!normalized || groupOrderIndex.has(normalized)) continue
      groupOrderIndex.set(normalized, groupOrderIndex.size)
    }
  }

  const getGroupRank = (group: string): number =>
    groupOrderIndex.size > 0 ? (groupOrderIndex.get(group) ?? Number.MAX_SAFE_INTEGER) : 0

  return [...keys].sort((a, b) => {
    const groupA = (groupBy(a) ?? '').trim()
    const groupB = (groupBy(b) ?? '').trim()
    if (groupA !== groupB) {
      const groupRankDelta = getGroupRank(groupA) - getGroupRank(groupB)
      if (groupRankDelta !== 0) return groupRankDelta
      if (groupA.length === 0 || groupB.length === 0) return groupA.length === 0 ? 1 : -1
      return groupA.localeCompare(groupB)
    }

    const countDelta = (counts[b] ?? 0) - (counts[a] ?? 0)
    if (countDelta !== 0) return countDelta
    return a.localeCompare(b)
  })
}
