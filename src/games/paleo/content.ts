import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type PaleoContent = {
  modules: string[]
  scenarios: string[]
  modulesById: Map<string, string>
  scenariosById: Map<string, string>
  moduleGroupByName: Map<string, string>
  scenarioGroupByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type PaleoYamlItem =
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

function applyItem(
  item: PaleoYamlItem,
  list: string[],
  map: Map<string, string>,
  groupByName: Map<string, string>,
) {
  if (typeof item === 'string') {
    const display = item.trim()
    if (!display) return
    list.push(display)
    applyAliases(map, display, [display])
    return
  }

  if (!isRecord(item)) return
  const display =
    (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
      .trim()
  if (!display) return

  list.push(display)
  const aliases = Array.isArray(item.aliases)
    ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
    : []

  applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
  const group =
    (typeof item.group === 'string' ? item.group : typeof item.box === 'string' ? item.box : '').trim()
  if (group) groupByName.set(display, group)
}

export function parsePaleoContent(text: string): PaleoContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.modules) && Array.isArray(yaml.scenarios)) {
    const costs = parseBoxCostConfig(yaml)
    const modules: string[] = []
    const scenarios: string[] = []
    const modulesById = new Map<string, string>()
    const scenariosById = new Map<string, string>()
    const moduleGroupByName = new Map<string, string>()
    const scenarioGroupByName = new Map<string, string>()

    for (const item of yaml.modules as PaleoYamlItem[]) {
      applyItem(item, modules, modulesById, moduleGroupByName)
    }
    for (const item of yaml.scenarios as PaleoYamlItem[]) {
      applyItem(item, scenarios, scenariosById, scenarioGroupByName)
    }

    return {
      modules,
      scenarios,
      modulesById,
      scenariosById,
      moduleGroupByName,
      scenarioGroupByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Paleo content (expected YAML with `modules` and `scenarios` arrays).',
  )
}

export const paleoContent = parsePaleoContent(contentText)
