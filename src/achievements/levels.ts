const BASE_LEVELS = [1, 3, 5, 8, 10, 13, 15, 18, 20]

export function defaultAchievementLevels(maxLevel = 200): number[] {
  const levels: number[] = []
  for (const level of BASE_LEVELS) {
    if (level > maxLevel) return levels
    levels.push(level)
  }

  let current = levels[levels.length - 1] ?? 0
  let addThreeNext = true
  while (current < maxLevel) {
    current += addThreeNext ? 3 : 2
    addThreeNext = !addThreeNext
    if (current > maxLevel) break
    levels.push(current)
  }

  return levels
}

