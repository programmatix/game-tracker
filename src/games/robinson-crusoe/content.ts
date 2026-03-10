import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type RobinsonCrusoeContent = {
  scenarios: string[]
  scenariosById: Map<string, string>
  scenarioGroupByName: Map<string, string>
  scenarioBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type RobinsonCrusoeYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      box?: string
    }

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function applyAliases(map: Map<string, string>, display: string, tokens: string[]) {
  for (const token of tokens) {
    const normalized = normalizeId(token)
    if (!normalized) continue
    map.set(normalized, display)
  }
}

export function parseRobinsonCrusoeContent(text: string): RobinsonCrusoeContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.scenarios)) {
    const costs = parseBoxCostConfig(yaml)
    const scenarios: string[] = []
    const scenariosById = new Map<string, string>()
    const scenarioGroupByName = new Map<string, string>()
    const scenarioBoxByName = new Map<string, string>()

    for (const item of yaml.scenarios as RobinsonCrusoeYamlItem[]) {
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
      applyAliases(scenariosById, display, [
        display,
        ...(typeof item.id === 'string' ? [item.id] : []),
        ...aliases,
      ])

      const group =
        (typeof item.group === 'string' ? item.group : '').trim()
      if (group) scenarioGroupByName.set(display, group)
      const box = (typeof item.box === 'string' ? item.box : '').trim()
      if (box) scenarioBoxByName.set(display, box)
    }

    return {
      scenarios,
      scenariosById,
      scenarioGroupByName,
      scenarioBoxByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Robinson Crusoe content (expected YAML with a `scenarios` array).',
  )
}

export const robinsonCrusoeContent = parseRobinsonCrusoeContent(contentText)
