import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { nanolithContent } from './content'

export type NanolithPlayerTags = {
  hero?: string
  encounter?: string
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

function resolveHero(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return nanolithContent.heroesById.get(normalizeId(token)) ?? token
}

function resolveEncounter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return nanolithContent.encountersById.get(normalizeId(token)) ?? token
}

function isKnownHeroToken(value: string): boolean {
  return nanolithContent.heroesById.has(normalizeId(value))
}

function isKnownEncounterToken(value: string): boolean {
  return nanolithContent.encountersById.has(normalizeId(value))
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious' || normalized === 'continue'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

export function parseNanolithPlayerColor(color: string): NanolithPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  let hero = resolveHero(getBgStatsValue(parsedKv, ['H', 'Hero', 'C', 'Char', 'Character']) || '')
  let encounter = resolveEncounter(
    getBgStatsValue(parsedKv, ['S', 'Sc', 'Scenario', 'E', 'Enc', 'Encounter']) || '',
  )
  let continuePrevious = false
  let continueNext = false
  const used = new Set<string>()

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

    if (!encounter && isKnownEncounterToken(normalized)) {
      encounter = resolveEncounter(normalized)
      used.add(normalized)
      continue
    }

    if (!hero && isKnownHeroToken(normalized)) {
      hero = resolveHero(normalized)
      used.add(normalized)
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { hero, encounter, continuePrevious, continueNext, extraTags }
}
