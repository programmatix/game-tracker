import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { mageKnightContent } from './content'

export type MageKnightPlayerTags = {
  hero?: string
  scenario?: string
  continuePrevious: boolean
  continueNext: boolean
  extraTags: string[]
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

function stripDecorations(input: string): string {
  let value = normalizeToken(input)
  value = value.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  return normalizeToken(value)
}

export function normalizeMageKnightHero(input: string): string | undefined {
  const token = stripDecorations(input)
  if (!token) return undefined
  return mageKnightContent.heroesById.get(normalizeId(token)) ?? token
}

export function normalizeMageKnightScenario(input: string): string | undefined {
  const token = stripDecorations(input)
  if (!token) return undefined
  return mageKnightContent.scenariosById.get(normalizeId(token)) ?? token
}

export function isMageKnightHeroToken(input: string): boolean {
  const normalized = normalizeMageKnightHero(input)
  if (!normalized) return false
  return mageKnightContent.heroesById.has(normalizeId(normalized))
}

export function isMageKnightScenarioToken(input: string): boolean {
  const normalized = normalizeMageKnightScenario(input)
  if (!normalized) return false
  return mageKnightContent.scenariosById.has(normalizeId(normalized))
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious' || normalized === 'continue'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

export function parseMageKnightPlayerColor(color: string): MageKnightPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const tagValues = tags.map(stripDecorations).filter(Boolean)

  const kvHero = getBgStatsValue(parsedKv, ['H', 'Hero', 'Character', 'C', 'Char'])
  const kvScenario = getBgStatsValue(parsedKv, ['S', 'Scen', 'Scenario'])
  const heroFromKv = kvHero ? normalizeMageKnightHero(kvHero) : undefined
  const scenarioFromKv = kvScenario ? normalizeMageKnightScenario(kvScenario) : undefined

  let continuePrevious = false
  let continueNext = false
  const remainingTagValues: string[] = []

  for (const tag of tagValues) {
    if (isContinuePreviousToken(tag)) {
      continuePrevious = true
      continue
    }
    if (isContinueNextToken(tag)) {
      continueNext = true
      continue
    }
    remainingTagValues.push(tag)
  }

  const heroFromTags = remainingTagValues.find((tag) => isMageKnightHeroToken(tag))
  const scenarioFromTags = remainingTagValues.find((tag) => isMageKnightScenarioToken(tag))
  const hero = heroFromKv || (heroFromTags ? normalizeMageKnightHero(heroFromTags) : undefined)
  const scenario =
    scenarioFromKv ||
    (scenarioFromTags ? normalizeMageKnightScenario(scenarioFromTags) : undefined)

  const extraTags = remainingTagValues.filter((tag) => {
    const tagId = normalizeId(tag)
    if (hero && tagId === normalizeId(hero)) return false
    if (scenario && tagId === normalizeId(scenario)) return false
    return true
  })

  return { hero, scenario, continuePrevious, continueNext, extraTags }
}
