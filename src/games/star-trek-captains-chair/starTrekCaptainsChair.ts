import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { starTrekCaptainsChairContent } from './content'

export type StarTrekCaptainsChairPlayerTags = {
  captain?: string
  scenario?: string
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

function resolveCaptain(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return starTrekCaptainsChairContent.captainsById.get(normalizeId(token))
}

function resolveScenario(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return starTrekCaptainsChairContent.scenariosById.get(normalizeId(token))
}

export function parseStarTrekCaptainsChairPlayerColor(color: string): StarTrekCaptainsChairPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const captainKv = getBgStatsValue(parsedKv, ['C', 'Captain', 'Char', 'Character'])
  const scenarioKv = getBgStatsValue(parsedKv, ['S', 'Scenario', 'Mode', 'Difficulty', 'D'])

  const captainFromKv = captainKv ? resolveCaptain(captainKv) : undefined
  const scenarioFromKv = scenarioKv ? resolveScenario(scenarioKv) : undefined

  let captainFromTags: string | undefined
  let scenarioFromTags: string | undefined
  const extraTags: string[] = []

  for (const tag of tags) {
    const captain = resolveCaptain(tag)
    if (!captainFromTags && captain) {
      captainFromTags = captain
      continue
    }

    const scenario = resolveScenario(tag)
    if (!scenarioFromTags && scenario) {
      scenarioFromTags = scenario
      continue
    }

    extraTags.push(normalizeToken(tag))
  }

  return {
    captain: captainFromKv ?? captainFromTags,
    scenario: scenarioFromKv ?? scenarioFromTags,
    extraTags,
  }
}
