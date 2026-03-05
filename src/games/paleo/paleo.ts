import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { paleoContent } from './content'

export type PaleoPlayerTags = {
  moduleA?: string
  scenario?: string
  moduleB?: string
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

function resolveModule(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return paleoContent.modulesById.get(normalizeId(token)) ?? token
}

function resolveScenario(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return paleoContent.scenariosById.get(normalizeId(token)) ?? token
}

function isKnownModuleToken(value: string): boolean {
  return paleoContent.modulesById.has(normalizeId(value))
}

function isKnownScenarioToken(value: string): boolean {
  return paleoContent.scenariosById.has(normalizeId(value))
}

export function parsePaleoPlayerColor(color: string): PaleoPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const moduleAKv = getBgStatsValue(parsedKv, ['M1', 'Mod1', 'Module1', 'A', 'Module A'])
  const scenarioKv = getBgStatsValue(parsedKv, ['S', 'Scen', 'Scenario'])
  const moduleBKv = getBgStatsValue(parsedKv, ['M2', 'Mod2', 'Module2', 'B', 'Module B'])

  let moduleA = moduleAKv ? resolveModule(moduleAKv) : undefined
  let scenario = scenarioKv ? resolveScenario(scenarioKv) : undefined
  let moduleB = moduleBKv ? resolveModule(moduleBKv) : undefined

  const used = new Set<string>()

  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (!scenario && isKnownScenarioToken(normalized)) {
      scenario = resolveScenario(normalized)
      used.add(normalized)
      continue
    }

    if (isKnownModuleToken(normalized)) {
      if (!moduleA) {
        moduleA = resolveModule(normalized)
        used.add(normalized)
        continue
      }
      if (!moduleB) {
        moduleB = resolveModule(normalized)
        used.add(normalized)
        continue
      }
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { moduleA, scenario, moduleB, extraTags }
}
