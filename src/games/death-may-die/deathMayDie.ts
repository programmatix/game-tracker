import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'

export type DeathMayDiePlayerTags = {
  investigator?: string
  elderOne?: string
  scenario?: string
  extraTags: string[]
}

function normalizeToken(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
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

  const elderOne = kvElderOne
    ? normalizeDeathMayDieElderOne(kvElderOne)
    : nonScenarioTags[0]
      ? normalizeDeathMayDieElderOne(nonScenarioTags[0])
      : undefined

  const extraTags = nonScenarioTags
    .slice(elderOne ? 1 : 0)
    .map(normalizeToken)
    .filter(Boolean)

  return {
    investigator: normalizeToken(investigator),
    elderOne,
    scenario,
    extraTags,
  }
}
