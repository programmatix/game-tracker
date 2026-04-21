import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type BurncycleContent = {
  missions: string[]
  bots: string[]
  corporations: string[]
  captains: string[]
  missionsById: Map<string, string>
  botsById: Map<string, string>
  corporationsById: Map<string, string>
  captainsById: Map<string, string>
  missionCorpByName: Map<string, string>
  missionComplexityByName: Map<string, number>
  missionFloorsByName: Map<string, number>
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
      corp?: string
      complexity?: number
      floors?: number
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
    Array.isArray(yaml.missions) &&
    Array.isArray(yaml.bots) &&
    Array.isArray(yaml.corporations) &&
    Array.isArray(yaml.captains)
  ) {
    const costs = parseBoxCostConfig(yaml)
    const missions: string[] = []
    const bots: string[] = []
    const corporations: string[] = []
    const captains: string[] = []
    const missionsById = new Map<string, string>()
    const botsById = new Map<string, string>()
    const corporationsById = new Map<string, string>()
    const captainsById = new Map<string, string>()
    const missionCorpByName = new Map<string, string>()
    const missionComplexityByName = new Map<string, number>()
    const missionFloorsByName = new Map<string, number>()
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

    const applyMission = (item: BurncycleYamlItem) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        missions.push(display)
        applyAliases(missionsById, display, [display])
        return
      }

      if (!isRecord(item)) return
      const display =
        (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
          .trim()
      if (!display) return

      missions.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(missionsById, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])

      const corp = typeof item.corp === 'string' ? item.corp.trim() : ''
      if (corp) missionCorpByName.set(display, corp)
      if (typeof item.complexity === 'number' && Number.isFinite(item.complexity))
        missionComplexityByName.set(display, item.complexity)
      if (typeof item.floors === 'number' && Number.isFinite(item.floors))
        missionFloorsByName.set(display, item.floors)
    }

    for (const item of yaml.missions as BurncycleYamlItem[]) applyMission(item)
    for (const item of yaml.bots as BurncycleYamlItem[])
      applyItem(item, bots, botsById, botGroupByName)
    for (const item of yaml.corporations as BurncycleYamlItem[])
      applyItem(item, corporations, corporationsById, corporationGroupByName)
    for (const item of yaml.captains as BurncycleYamlItem[])
      applyItem(item, captains, captainsById, captainGroupByName)
    for (const [mission, corp] of missionCorpByName.entries()) {
      missionCorpByName.set(mission, corporationsById.get(normalizeId(corp)) ?? corp)
    }

    return {
      missions,
      bots,
      corporations,
      captains,
      missionsById,
      botsById,
      corporationsById,
      captainsById,
      missionCorpByName,
      missionComplexityByName,
      missionFloorsByName,
      botGroupByName,
      corporationGroupByName,
      captainGroupByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Burncycle content (expected YAML with `missions`, `bots`, `corporations`, and `captains` arrays).',
  )
}

export const burncycleContent = parseBurncycleContent(contentText)
