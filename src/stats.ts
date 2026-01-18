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
