import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type BurncycleContent = {
  bots: string[]
  corporations: string[]
  captains: string[]
  botsById: Map<string, string>
  corporationsById: Map<string, string>
  captainsById: Map<string, string>
  botGroupByName: Map<string, string>
  corporationGroupByName: Map<string, string>
  captainGroupByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type BurncycleYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
    }

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function parseBurncycleContent(text: string): BurncycleContent {
  const yaml = parseYamlValue(text)
  if (
    isRecord(yaml) &&
    Array.isArray(yaml.bots) &&
    Array.isArray(yaml.corporations) &&
    Array.isArray(yaml.captains)
  ) {
    const costs = parseBoxCostConfig(yaml)
    const bots: string[] = []
    const corporations: string[] = []
    const captains: string[] = []
    const botsById = new Map<string, string>()
    const corporationsById = new Map<string, string>()
    const captainsById = new Map<string, string>()
    const botGroupByName = new Map<string, string>()
    const corporationGroupByName = new Map<string, string>()
    const captainGroupByName = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (
      item: BurncycleYamlItem,
      list: string[],
      map: Map<string, string>,
      groupByName: Map<string, string>,
    ) => {
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
      const group = typeof item.group === 'string' ? item.group.trim() : ''
      if (group) groupByName.set(display, group)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    for (const item of yaml.bots as BurncycleYamlItem[])
      applyItem(item, bots, botsById, botGroupByName)
    for (const item of yaml.corporations as BurncycleYamlItem[])
      applyItem(item, corporations, corporationsById, corporationGroupByName)
    for (const item of yaml.captains as BurncycleYamlItem[])
      applyItem(item, captains, captainsById, captainGroupByName)

    return {
      bots,
      corporations,
      captains,
      botsById,
      corporationsById,
      captainsById,
      botGroupByName,
      corporationGroupByName,
      captainGroupByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Burncycle content (expected YAML with `bots`, `corporations`, and `captains` arrays).',
  )
}

export const burncycleContent = parseBurncycleContent(contentText)
