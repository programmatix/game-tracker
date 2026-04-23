import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type LeviathanWildsContentItem = {
  display: string
  group?: string
}

export type LeviathanWildsContent = {
  leviathans: string[]
  characters: string[]
  classes: string[]
  leviathansById: Map<string, string>
  charactersById: Map<string, string>
  classesById: Map<string, string>
  groupByLeviathan: Map<string, string>
  groupByCharacter: Map<string, string>
  groupByClass: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type YamlItem =
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

function applyAliases(map: Map<string, string>, display: string, tokens: string[]) {
  for (const token of tokens) {
    const normalized = normalizeId(token)
    if (!normalized) continue
    map.set(normalized, display)
  }
}

function parseItems(raw: unknown): {
  items: string[]
  byId: Map<string, string>
  groupByName: Map<string, string>
} {
  const items: string[] = []
  const byId = new Map<string, string>()
  const groupByName = new Map<string, string>()

  if (!Array.isArray(raw)) return { items, byId, groupByName }

  for (const item of raw as YamlItem[]) {
    if (typeof item === 'string') {
      const display = item.trim()
      if (!display) continue
      items.push(display)
      applyAliases(byId, display, [display])
      continue
    }

    if (!isRecord(item)) continue
    const display =
      (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!display) continue

    items.push(display)
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    applyAliases(byId, display, [
      display,
      ...(typeof item.id === 'string' ? [item.id] : []),
      ...aliases,
    ])

    const group = typeof item.group === 'string' ? item.group.trim() : ''
    if (group) groupByName.set(display, group)
  }

  return { items, byId, groupByName }
}

export function parseLeviathanWildsContent(text: string): LeviathanWildsContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml)) {
    throw new Error('Failed to parse Leviathan Wilds content.')
  }

  const costs = parseBoxCostConfig(yaml)
  const leviathans = parseItems(yaml.leviathans)
  const characters = parseItems(yaml.characters)
  const classes = parseItems(yaml.classes)

  return {
    leviathans: leviathans.items,
    characters: characters.items,
    classes: classes.items,
    leviathansById: leviathans.byId,
    charactersById: characters.byId,
    classesById: classes.byId,
    groupByLeviathan: leviathans.groupByName,
    groupByCharacter: characters.groupByName,
    groupByClass: classes.groupByName,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const leviathanWildsContent = parseLeviathanWildsContent(contentText)
