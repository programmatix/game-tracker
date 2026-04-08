import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type MageKnightContent = {
  heroes: string[]
  heroesById: Map<string, string>
  heroBoxByName: Map<string, string>
  scenarios: string[]
  scenariosById: Map<string, string>
  scenarioShortByName: Map<string, string>
  scenarioRoundsByName: Map<string, number>
  scenarioGroupByName: Map<string, string>
  scenarioExpansionByName: Map<string, string>
  scenarioRecommendedByName: Map<string, boolean>
  scenarioBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type MageKnightYamlItem =
  | string
  | {
      display?: string
      id?: string
      short?: string
      aliases?: string[]
      box?: string
      rounds?: number
      expansion?: string
      recommended?: boolean
    }

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function parseMageKnightContent(text: string): MageKnightContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.heroes) && Array.isArray(yaml.scenarios)) {
    const costs = parseBoxCostConfig(yaml)
    const heroes: string[] = []
    const heroesById = new Map<string, string>()
    const heroBoxByName = new Map<string, string>()
    const scenarios: string[] = []
    const scenariosById = new Map<string, string>()
    const scenarioShortByName = new Map<string, string>()
    const scenarioRoundsByName = new Map<string, number>()
    const scenarioGroupByName = new Map<string, string>()
    const scenarioExpansionByName = new Map<string, string>()
    const scenarioRecommendedByName = new Map<string, boolean>()
    const scenarioBoxByName = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (item: MageKnightYamlItem) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        heroes.push(display)
        applyAliases(heroesById, display, [display])
        return
      }

      if (!isRecord(item)) return
      const display =
        (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
          .trim()
      if (!display) return

      heroes.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      const box = typeof item.box === 'string' ? item.box.trim() : ''
      if (box) heroBoxByName.set(display, box)

      applyAliases(heroesById, display, [
        display,
        ...(typeof item.id === 'string' ? [item.id] : []),
        ...aliases,
      ])
    }

    for (const item of yaml.heroes as MageKnightYamlItem[]) applyItem(item)

    for (const item of yaml.scenarios as MageKnightYamlItem[]) {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) continue
        scenarios.push(display)
        applyAliases(scenariosById, display, [display])
        continue
      }

      if (!isRecord(item)) continue
      const display =
        (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
          .trim()
      if (!display) continue

      scenarios.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      const short = typeof item.short === 'string' ? item.short.trim() : ''
      applyAliases(scenariosById, display, [
        display,
        ...(typeof item.id === 'string' ? [item.id] : []),
        ...(short ? [short] : []),
        ...aliases,
      ])
      if (short) scenarioShortByName.set(display, short)

      const box = typeof item.box === 'string' ? item.box.trim() : ''
      if (box) scenarioBoxByName.set(display, box)

      const rounds = typeof item.rounds === 'number' && Number.isFinite(item.rounds) ? item.rounds : undefined
      if (rounds !== undefined) {
        scenarioRoundsByName.set(display, rounds)
        scenarioGroupByName.set(display, rounds === 1 ? '1 round' : `${rounds} rounds`)
      }

      const expansion = typeof item.expansion === 'string' ? item.expansion.trim() : ''
      if (expansion) scenarioExpansionByName.set(display, expansion)
      if (item.recommended === true) scenarioRecommendedByName.set(display, true)
    }

    return {
      heroes,
      heroesById,
      heroBoxByName,
      scenarios,
      scenariosById,
      scenarioShortByName,
      scenarioRoundsByName,
      scenarioGroupByName,
      scenarioExpansionByName,
      scenarioRecommendedByName,
      scenarioBoxByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Mage Knight content (expected YAML with `heroes` and `scenarios` arrays).',
  )
}

export const mageKnightContent = parseMageKnightContent(contentText)

export function formatMageKnightScenarioLabel(scenario: string): string {
  const short = mageKnightContent.scenarioShortByName.get(scenario)?.trim()
  return short ? `${scenario} [${short}]` : scenario
}
