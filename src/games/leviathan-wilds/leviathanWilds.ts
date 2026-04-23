import { parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { leviathanWildsContent } from './content'

export type LeviathanWildsPlayerTags = {
  character?: string
  className?: string
}

export type LeviathanWildsPlayTags = {
  leviathan?: string
  difficulty?: string
}

function normalizeToken(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function resolveFromMap(value: string, map: Map<string, string>): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return map.get(normalizeId(token)) ?? token
}

export function parseLeviathanWildsPlayerColor(color: string): LeviathanWildsPlayerTags {
  const segments = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))
  let character: string | undefined
  let className: string | undefined

  for (const segment of segments) {
    const token = normalizeToken(segment)
    if (!token) continue

    if (!character && leviathanWildsContent.charactersById.has(normalizeId(token))) {
      character = resolveFromMap(token, leviathanWildsContent.charactersById)
      continue
    }

    if (!className && leviathanWildsContent.classesById.has(normalizeId(token))) {
      className = resolveFromMap(token, leviathanWildsContent.classesById)
      continue
    }
  }

  if (!character && segments[0]) character = resolveFromMap(segments[0], leviathanWildsContent.charactersById)
  if (!className && segments[1]) className = resolveFromMap(segments[1], leviathanWildsContent.classesById)

  return { character, className }
}

export function parseLeviathanWildsPlayTags(input: string): LeviathanWildsPlayTags {
  const kv = parseBgStatsKeyValueSegments(input)
  const leviathanValue = kv.L || kv.Leviathan || kv.Scenario
  const difficultyValue = kv.Difficulty || kv.Diff || kv.D
  let leviathan = leviathanValue
    ? resolveFromMap(leviathanValue, leviathanWildsContent.leviathansById)
    : undefined
  let difficulty = difficultyValue ? normalizeToken(difficultyValue) : undefined

  for (const segment of splitBgStatsSegments(input)) {
    const token = normalizeToken(segment)
    if (!token) continue

    if (!leviathan && leviathanWildsContent.leviathansById.has(normalizeId(token))) {
      leviathan = resolveFromMap(token, leviathanWildsContent.leviathansById)
      continue
    }

    const difficultyMatch = token.match(/^difficulty\s+(.+)$/i)
    if (!difficulty && difficultyMatch) {
      difficulty = normalizeToken(difficultyMatch[1] || '')
    }
  }

  return { leviathan, difficulty }
}
