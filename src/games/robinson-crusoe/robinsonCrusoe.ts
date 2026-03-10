import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { robinsonCrusoeContent } from './content'

export type RobinsonCrusoePlayerTags = {
  scenario?: string
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

function resolveScenario(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return robinsonCrusoeContent.scenariosById.get(normalizeId(token)) ?? token
}

function isKnownScenarioToken(value: string): boolean {
  return robinsonCrusoeContent.scenariosById.has(normalizeId(value))
}

export function parseRobinsonCrusoePlayerColor(color: string): RobinsonCrusoePlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const scenarioKv = getBgStatsValue(parsedKv, ['S', 'Scen', 'Scenario'])
  let scenario = scenarioKv ? resolveScenario(scenarioKv) : undefined

  const used = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue
    if (!scenario && isKnownScenarioToken(normalized)) {
      scenario = resolveScenario(normalized)
      used.add(normalized)
      break
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { scenario, extraTags }
}
