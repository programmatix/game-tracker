import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { aeonTrespassOdysseyContent } from './content'

export type AeonTrespassOdysseyPlayerTags = {
  cycle?: string
  day?: string
  continuePrevious: boolean
  continueNext: boolean
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

function resolveCycle(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined

  const direct = aeonTrespassOdysseyContent.cyclesById.get(normalizeId(token))
  if (direct) return direct

  const cycleMatch = token.match(/(?:^|\b)c(?:ycle)?\s*0*([1-9]\d?)(?:\b|$)/i)
  if (cycleMatch?.[1]) {
    return aeonTrespassOdysseyContent.cyclesById.get(`c${Number(cycleMatch[1])}`)
  }

  return undefined
}

function defaultCycle(): string | undefined {
  return aeonTrespassOdysseyContent.cycles.length === 1
    ? aeonTrespassOdysseyContent.cycles[0]
    : undefined
}

function resolveDay(value: string, cycle?: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined

  const normalized = normalizeId(token)
  if (cycle) {
    const cycleLookup = aeonTrespassOdysseyContent.dayLookupByCycleName.get(cycle)
    const resolved = cycleLookup?.get(normalized)
    if (resolved) return resolved
  }

  const direct = aeonTrespassOdysseyContent.daysById.get(normalized)
  if (direct) return direct

  const fallbackCycle = cycle || defaultCycle()
  const dayMatch = token.match(/(?:^|\b)d(?:ay)?\s*0*([1-9]\d?)(?:\b|$)/i)
  if (dayMatch?.[1] && fallbackCycle) {
    return aeonTrespassOdysseyContent.dayLookupByCycleName
      .get(fallbackCycle)
      ?.get(`d${Number(dayMatch[1])}`)
  }

  const numericMatch = token.match(/^\s*0*([1-9]\d?)\s*$/)
  if (numericMatch?.[1] && fallbackCycle) {
    return aeonTrespassOdysseyContent.dayLookupByCycleName
      .get(fallbackCycle)
      ?.get(`d${Number(numericMatch[1])}`)
  }

  return undefined
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious' || normalized === 'continue'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

export function parseAeonTrespassOdysseyPlayerColor(color: string): AeonTrespassOdysseyPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const cycleKv = getBgStatsValue(parsedKv, ['C', 'Cycle', 'Campaign'])
  let cycle = cycleKv ? resolveCycle(cycleKv) : undefined
  const dayKv = getBgStatsValue(parsedKv, ['D', 'Day'])
  let day = dayKv ? resolveDay(dayKv, cycle) : undefined
  let continuePrevious = false
  let continueNext = false

  const used = new Set<string>()
  if (!cycle) {
    for (const tag of tags) {
      const normalized = normalizeToken(tag)
      if (!normalized) continue
      const resolvedCycle = resolveCycle(normalized)
      if (!resolvedCycle) continue
      cycle = resolvedCycle
      used.add(normalized)
      if (dayKv && !day) day = resolveDay(dayKv, cycle)
      break
    }
  }

  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (isContinuePreviousToken(normalized)) {
      continuePrevious = true
      used.add(normalized)
      continue
    }

    if (isContinueNextToken(normalized)) {
      continueNext = true
      used.add(normalized)
      continue
    }

    if (!cycle) {
      const resolvedCycle = resolveCycle(normalized)
      if (resolvedCycle) {
        cycle = resolvedCycle
        used.add(normalized)
        if (dayKv && !day) day = resolveDay(dayKv, cycle)
        continue
      }
    }

    if (!day) {
      const resolvedDay = resolveDay(normalized, cycle)
      if (resolvedDay) {
        day = resolvedDay
        used.add(normalized)
      }
    }
  }

  if (!cycle && day) cycle = aeonTrespassOdysseyContent.dayCycleByName.get(day)
  if (!cycle) cycle = defaultCycle()

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { cycle, day, continuePrevious, continueNext, extraTags }
}
