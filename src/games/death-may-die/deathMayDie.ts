import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { deathMayDieContent } from './content'

export type DeathMayDiePlayerTags = {
  investigator?: string
  elderOne?: string
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

export function normalizeDeathMayDieInvestigator(input: string): string | undefined {
  const token = normalizeToken(input)
  if (!token) return undefined

  const lowered = token.toLowerCase()
  const explicitAliases: Record<string, string> = {
    kid: 'The Kid',
    'the kid': 'The Kid',
    nun: 'Sister Beth',
    beth: 'Sister Beth',
    eliz: 'Elizabeth Ives',
    elizabeth: 'Elizabeth Ives',
    ahmed: 'Ahmed Yasin',
  }

  const aliased = explicitAliases[lowered]
  if (aliased) return aliased

  const fromContent = deathMayDieContent.investigatorsById.get(normalizeId(token))
  if (fromContent) return fromContent

  return token
}

export function isDeathMayDieInvestigatorToken(input: string): boolean {
  const normalized = normalizeDeathMayDieInvestigator(input)
  if (!normalized) return false
  return deathMayDieContent.investigatorsById.has(normalizeId(normalized))
}

export function normalizeDeathMayDieElderOne(input: string): string {
  const token = normalizeToken(input)
  const lowered = token.toLowerCase()

  if (lowered === 'cthulu' || lowered === 'cthulhu') return 'Cthulhu'

  return token
}

export function normalizeDeathMayDieScenario(input: string): string | undefined {
  const token = normalizeToken(input)
  if (!token) return undefined

  const lowered = token.toLowerCase()
  const match =
    lowered.match(/^s(?:cenario)?\s*([0-9]+)$/) ||
    lowered.match(/^(?:episode|ep)\s*([0-9]+)$/) ||
    lowered.match(/^([0-9]+)$/)

  if (match?.[1]) return `Scenario ${match[1]}`
  return /^scenario\b/i.test(token) ? token : undefined
}

export function parseDeathMayDiePlayerColor(color: string): DeathMayDiePlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const investigator =
    getBgStatsValue(parsedKv, ['I', 'Inv', 'Investigator', 'C', 'Char', 'Character']) ||
    normalizeToken(tags[0] || '')
  const normalizedInvestigator = normalizeDeathMayDieInvestigator(investigator)

  const kvScenario = getBgStatsValue(parsedKv, ['S', 'Scenario', 'Sc', 'E', 'Ep', 'Episode'])
  const scenarioFromTags = tags.map(normalizeDeathMayDieScenario).find((value) => value != null)
  const scenario = kvScenario ? normalizeDeathMayDieScenario(kvScenario) : scenarioFromTags

  const kvElderOne = getBgStatsValue(parsedKv, [
    'EO',
    'ElderOne',
    'Elder One',
    'OldOne',
    'Old One',
    'GOO',
    'GreatOldOne',
    'Great Old One',
  ])

  const nonScenarioTags = tags.filter((tag, idx) => {
    if (idx === 0) return false
    if (normalizeDeathMayDieScenario(tag)) return false
    return true
  })

  const nonInvestigatorTags = nonScenarioTags.filter((tag) => !isDeathMayDieInvestigatorToken(tag))

  const elderOneToken = kvElderOne ? undefined : nonInvestigatorTags[0]
  const elderOne = kvElderOne
    ? normalizeDeathMayDieElderOne(kvElderOne)
    : elderOneToken
      ? normalizeDeathMayDieElderOne(elderOneToken)
      : undefined

  const extraTags = nonScenarioTags
    .filter((tag) => (elderOneToken ? tag !== elderOneToken : true))
    .map(normalizeToken)
    .filter(Boolean)

  return {
    investigator: normalizedInvestigator ? normalizeToken(normalizedInvestigator) : undefined,
    elderOne,
    scenario,
    extraTags,
  }
}
