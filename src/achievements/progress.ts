export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}

export function normalizeAchievementItemLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function isMeaningfulAchievementItem(value: string): boolean {
  const trimmed = normalizeAchievementItemLabel(value)
  if (!trimmed) return false
  const lowered = trimmed.toLowerCase()
  if (lowered === 'unknown') return false
  if (lowered.startsWith('unknown ')) return false
  if (lowered === 'no adversary') return false
  return true
}

export function computeCounterProgress(input: {
  current: number
  target: number
  unitSingular: string
}): {
  isComplete: boolean
  remainingPlays: number
  playsSoFar: number
  progressValue: number
  progressTarget: number
  progressLabel: string
} {
  const target = input.target > 0 ? input.target : 1
  const current = Math.max(0, input.current)
  const remainingPlays = Math.max(0, target - current)
  const progressValue = Math.min(current, target)
  const unit = pluralize(target, input.unitSingular)
  return {
    isComplete: current >= target,
    remainingPlays,
    playsSoFar: current,
    progressValue,
    progressTarget: target,
    progressLabel: `${progressValue}/${target} ${unit}`,
  }
}

export function computePerItemProgress(input: {
  items: string[]
  countsByItem: Record<string, number>
  targetPerItem: number
  unitSingular: string
}): {
  isComplete: boolean
  remainingPlays: number
  playsSoFar: number
  progressValue: number
  progressTarget: number
  progressLabel: string
} {
  const target = input.targetPerItem > 0 ? input.targetPerItem : 1
  const items = input.items
  const total = items.length
  if (total === 0) {
    return {
      isComplete: false,
      remainingPlays: 0,
      playsSoFar: 0,
      progressValue: 0,
      progressTarget: 0,
      progressLabel: '0/0',
    }
  }

  let met = 0
  let remainingPlays = 0
  let playsSoFar = 0
  for (const item of items) {
    const count = input.countsByItem[item] ?? 0
    if (count >= target) met += 1
    remainingPlays += Math.max(0, target - count)
    playsSoFar += Math.min(count, target)
  }

  const unit = pluralize(target, input.unitSingular)
  return {
    isComplete: met === total,
    remainingPlays,
    playsSoFar,
    progressValue: met,
    progressTarget: total,
    progressLabel: `${met}/${total} at ${target} ${unit} each`,
  }
}
