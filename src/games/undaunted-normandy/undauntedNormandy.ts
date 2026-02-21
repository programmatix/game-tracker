import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { undauntedNormandyContent } from './content'

export type UndauntedNormandyPlayerTags = {
  scenario?: string
  side?: string
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

function resolveScenario(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined

  const fromContent = undauntedNormandyContent.scenariosById.get(normalizeId(token))
  if (fromContent) return fromContent

  const numberMatch = token.match(/(?:scenario|sc|s)?\s*([0-9]{1,2})$/i)
  if (numberMatch?.[1]) {
    const normalized = undauntedNormandyContent.scenariosById.get(normalizeId(`s${numberMatch[1]}`))
    if (normalized) return normalized
    return `Normandy Scenario ${numberMatch[1]}`
  }

  return undefined
}

function resolveSide(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return undauntedNormandyContent.sidesById.get(normalizeId(token))
}

export function parseUndauntedNormandyPlayerColor(color: string): UndauntedNormandyPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const scenarioKv = getBgStatsValue(parsedKv, ['S', 'Sc', 'Scenario'])
  const sideKv = getBgStatsValue(parsedKv, ['F', 'Side', 'Faction', 'Team'])

  const scenarioFromKv = scenarioKv ? resolveScenario(scenarioKv) : undefined
  const sideFromKv = sideKv ? resolveSide(sideKv) : undefined

  const scenarioFromTags = tags.map(resolveScenario).find(Boolean)
  const sideFromTags = tags.map(resolveSide).find(Boolean)

  return {
    scenario: scenarioFromKv ?? scenarioFromTags,
    side: sideFromKv ?? sideFromTags,
  }
}
