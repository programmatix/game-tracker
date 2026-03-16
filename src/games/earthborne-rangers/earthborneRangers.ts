import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { earthborneRangersContent } from './content'

export type EarthborneRangersPlayerTags = {
  day?: string
  extraTags: string[]
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function resolveDay(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined

  const direct = earthborneRangersContent.daysById.get(normalizeId(token))
  if (direct) return direct

  const dayMatch = token.match(/(?:^|\b)d(?:ay)?\s*0*([1-9]\d?)(?:\b|$)/i)
  if (dayMatch?.[1]) {
    return earthborneRangersContent.daysById.get(`d${Number(dayMatch[1])}`) ?? `Day ${Number(dayMatch[1])}`
  }

  const numericMatch = token.match(/^\s*0*([1-9]\d?)\s*$/)
  if (numericMatch?.[1]) {
    return earthborneRangersContent.daysById.get(`d${Number(numericMatch[1])}`) ?? `Day ${Number(numericMatch[1])}`
  }

  return undefined
}

function isKnownDayToken(value: string): boolean {
  return resolveDay(value) !== undefined
}

export function parseEarthborneRangersPlayerColor(color: string): EarthborneRangersPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const dayKv = getBgStatsValue(parsedKv, ['D', 'Day'])
  let day = dayKv ? resolveDay(dayKv) : undefined

  const used = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue
    if (!day && isKnownDayToken(normalized)) {
      day = resolveDay(normalized)
      used.add(normalized)
      break
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { day, extraTags }
}
