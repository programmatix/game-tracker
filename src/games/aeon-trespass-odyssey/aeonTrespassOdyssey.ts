import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { aeonTrespassOdysseyContent } from './content'

export type AeonTrespassOdysseyPlayerTags = {
  cycle?: string
  startDay?: string
  endDay?: string
  days: string[]
  learnToPlay: boolean
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

function dayNumber(day: string | undefined): number | undefined {
  if (!day) return undefined
  return aeonTrespassOdysseyContent.dayNumberByName.get(day)
}

function orderDays(days: readonly string[]): string[] {
  return days
    .filter(Boolean)
    .slice()
    .sort((left, right) => (dayNumber(left) ?? 0) - (dayNumber(right) ?? 0))
}

function addUniqueDay(days: string[], day: string | undefined): void {
  if (!day || days.includes(day)) return
  days.push(day)
}

function isCycleKey(key: string): boolean {
  return ['c', 'cycle', 'campaign'].includes(normalizeId(key))
}

function isDayKey(key: string): boolean {
  return ['d', 'day'].includes(normalizeId(key))
}

function isStartDayKey(key: string): boolean {
  return ['start', 'from', 'startday', 'daystart'].includes(normalizeId(key))
}

function isEndDayKey(key: string): boolean {
  return ['end', 'to', 'endday', 'dayend'].includes(normalizeId(key))
}

function isLearnToPlayKey(key: string): boolean {
  return ['ltp', 'learntoplay', 'learningtoplay', 'mode', 'type', 'session', 'kind'].includes(normalizeId(key))
}

function isLearnToPlayToken(value: string): boolean {
  return ['ltp', 'learntoplay', 'learningtoplay', 'tutorial', 'teach', 'teaching'].includes(normalizeId(value))
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
  const segments = splitBgStatsSegments(color)
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const cycleKv = getBgStatsValue(parsedKv, ['C', 'Cycle', 'Campaign'])
  let cycle = cycleKv ? resolveCycle(cycleKv) : undefined
  const days: string[] = []
  let explicitStartDay: string | undefined
  let explicitEndDay: string | undefined
  let learnToPlay = false
  let continuePrevious = false
  let continueNext = false

  const used = new Set<string>()
  for (const segment of segments) {
    const normalized = normalizeToken(segment)
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

    if (isLearnToPlayToken(normalized)) {
      learnToPlay = true
      used.add(normalized)
      continue
    }

    const match = segment.match(/[:：]/)
    if (match?.index != null && match.index > 0) {
      const key = normalizeToken(segment.slice(0, match.index))
      const value = normalizeToken(segment.slice(match.index + match[0].length))
      if (!key || !value) continue

      if ((isLearnToPlayKey(key) && isLearnToPlayToken(value)) || isLearnToPlayToken(key)) {
        learnToPlay = true
        used.add(normalized)
        continue
      }

      if (isCycleKey(key)) {
        const resolvedCycle = resolveCycle(value)
        if (resolvedCycle) {
          cycle = resolvedCycle
          used.add(normalized)
        }
        continue
      }

      if (isStartDayKey(key)) {
        explicitStartDay = resolveDay(value, cycle)
        addUniqueDay(days, explicitStartDay)
        if (explicitStartDay) used.add(normalized)
        continue
      }

      if (isEndDayKey(key)) {
        explicitEndDay = resolveDay(value, cycle)
        addUniqueDay(days, explicitEndDay)
        if (explicitEndDay) used.add(normalized)
        continue
      }

      if (isDayKey(key)) {
        const resolvedDay = resolveDay(value, cycle)
        addUniqueDay(days, resolvedDay)
        if (resolvedDay) used.add(normalized)
        continue
      }
    }

    const resolvedCycle = resolveCycle(normalized)
    if (!cycle && resolvedCycle) {
      cycle = resolvedCycle
      used.add(normalized)
      continue
    }

    const resolvedDay = resolveDay(normalized, cycle)
    if (resolvedDay) {
      addUniqueDay(days, resolvedDay)
      used.add(normalized)
    }
  }

  const orderedDays = orderDays(days)
  const startDay = explicitStartDay || orderedDays[0]
  const endDay = explicitEndDay || orderedDays[orderedDays.length - 1] || startDay

  if (!cycle && endDay) cycle = aeonTrespassOdysseyContent.dayCycleByName.get(endDay)
  if (!cycle && startDay) cycle = aeonTrespassOdysseyContent.dayCycleByName.get(startDay)
  if (!cycle) cycle = defaultCycle()

  const extraTags = segments
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return {
    cycle,
    startDay,
    endDay,
    days: orderedDays,
    learnToPlay,
    continuePrevious,
    continueNext,
    extraTags,
  }
}
