export function totalPlayMinutes(
  attributes: Record<string, string>,
  quantity: number,
): number {
  const lengthMinutes = Number(attributes.length || '0')
  if (!Number.isFinite(lengthMinutes) || lengthMinutes <= 0) return 0
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  return lengthMinutes * qty
}

export function thingAssumedPlayTimeMinutes(raw: unknown): number | null {
  const record = raw as Record<string, unknown> | null
  const readMinutes = (key: string): number | null => {
    const node = record?.[key] as Record<string, unknown> | undefined
    const attrs = (node?.$ as Record<string, unknown> | undefined) || undefined
    const parsed = Number(attrs?.value)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  }

  const playingTime = readMinutes('playingtime')
  if (playingTime !== null) return playingTime

  const minPlayTime = readMinutes('minplaytime')
  const maxPlayTime = readMinutes('maxplaytime')
  if (minPlayTime !== null && maxPlayTime !== null) return (minPlayTime + maxPlayTime) / 2
  if (minPlayTime !== null) return minPlayTime
  if (maxPlayTime !== null) return maxPlayTime
  return null
}

export function totalPlayMinutesWithAssumption(input: {
  attributes: Record<string, string>
  quantity: number
  assumedMinutesPerPlay?: number
}): { minutes: number; assumed: boolean } {
  const actualMinutes = totalPlayMinutes(input.attributes, input.quantity)
  if (actualMinutes > 0) return { minutes: actualMinutes, assumed: false }

  const assumedMinutesPerPlay = input.assumedMinutesPerPlay
  if (!assumedMinutesPerPlay || assumedMinutesPerPlay <= 0) return { minutes: 0, assumed: false }

  const qty = Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 1
  return { minutes: assumedMinutesPerPlay * qty, assumed: true }
}
