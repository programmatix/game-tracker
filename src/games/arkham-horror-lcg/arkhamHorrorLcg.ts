import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { arkhamHorrorLcgContent } from './content'

export type ArkhamHorrorLcgPlayerTags = {
  campaign?: string
  scenario?: string
  difficulty?: string
  investigators: string[]
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

function resolveCampaign(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return arkhamHorrorLcgContent.campaignsById.get(normalizeId(token))
}

function resolveScenario(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return arkhamHorrorLcgContent.scenariosById.get(normalizeId(token))
}

function resolveDifficulty(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return arkhamHorrorLcgContent.difficultiesById.get(normalizeId(token))
}

function resolveInvestigator(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return arkhamHorrorLcgContent.investigatorsById.get(normalizeId(token))
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious' || normalized === 'continue'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

function pushUnique(values: string[], value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return
  if (values.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) return
  values.push(trimmed)
}

export function parseArkhamHorrorLcgPlayerColor(color: string): ArkhamHorrorLcgPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  let campaign = resolveCampaign(getBgStatsValue(parsedKv, ['C', 'Camp', 'Campaign']) || '')
  let scenario = resolveScenario(getBgStatsValue(parsedKv, ['S', 'Scen', 'Scenario']) || '')
  let difficulty = resolveDifficulty(getBgStatsValue(parsedKv, ['D', 'Diff', 'Difficulty']) || '')
  const investigators: string[] = []
  pushUnique(investigators, resolveInvestigator(getBgStatsValue(parsedKv, ['I', 'Inv', 'Investigator']) || ''))

  let continuePrevious = false
  let continueNext = false
  const used = new Set<string>()

  for (const rawTag of tags) {
    const tag = normalizeToken(rawTag)
    if (!tag) continue
    if (isContinuePreviousToken(tag)) {
      continuePrevious = true
      continue
    }
    if (isContinueNextToken(tag)) {
      continueNext = true
      continue
    }
    if (!campaign) {
      const resolved = resolveCampaign(tag)
      if (resolved) {
        campaign = resolved
        used.add(tag)
        continue
      }
    }
    if (!difficulty) {
      const resolved = resolveDifficulty(tag)
      if (resolved) {
        difficulty = resolved
        used.add(tag)
        continue
      }
    }
    if (!scenario) {
      const resolved = resolveScenario(tag)
      if (resolved) {
        scenario = resolved
        used.add(tag)
        continue
      }
    }
    const investigator = resolveInvestigator(tag)
    if (investigator) {
      pushUnique(investigators, investigator)
      used.add(tag)
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return {
    campaign,
    scenario,
    difficulty,
    investigators,
    continuePrevious,
    continueNext,
    extraTags,
  }
}
