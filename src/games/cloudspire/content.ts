import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type CloudspireContent = {
  factions: string[]
  modes: string[]
  factionsById: Map<string, string>
  modesById: Map<string, string>
  factionGroupByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type CloudspireYamlItem =
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

export function parseCloudspireContent(text: string): CloudspireContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.factions) && Array.isArray(yaml.modes)) {
    const costs = parseBoxCostConfig(yaml)
    const factions: string[] = []
    const modes: string[] = []
    const factionsById = new Map<string, string>()
    const modesById = new Map<string, string>()
    const factionGroupByName = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (
      item: CloudspireYamlItem,
      list: string[],
      map: Map<string, string>,
      groupByName?: Map<string, string>,
    ) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        list.push(display)
        applyAliases(map, display, [display])
        return
      }

      if (!isRecord(item)) return
      const display = (
        typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : ''
      ).trim()
      if (!display) return

      list.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])

      if (!groupByName) return
      const group = typeof item.group === 'string' ? item.group.trim() : ''
      if (!group) return
      groupByName.set(display, group)
    }

    for (const item of yaml.factions as CloudspireYamlItem[]) {
      applyItem(item, factions, factionsById, factionGroupByName)
    }

    for (const item of yaml.modes as CloudspireYamlItem[]) {
      applyItem(item, modes, modesById)
    }

    return {
      factions,
      modes,
      factionsById,
      modesById,
      factionGroupByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Cloudspire content (expected YAML with `factions` and `modes` arrays).',
  )
}

export const cloudspireContent = parseCloudspireContent(contentText)
