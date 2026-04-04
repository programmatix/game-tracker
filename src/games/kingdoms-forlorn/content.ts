import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type KingdomsForlornYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      box?: string
    }

type ParsedList = {
  labels: string[]
  byId: Map<string, string>
  groupByLabel: Map<string, string>
  boxByLabel: Map<string, string>
}

export type KingdomsForlornContent = {
  knights: string[]
  kingdoms: string[]
  knightsById: Map<string, string>
  kingdomsById: Map<string, string>
  knightGroupByName: Map<string, string>
  kingdomGroupByName: Map<string, string>
  knightBoxByName: Map<string, string>
  kingdomBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: KingdomsForlornYamlItem[]): ParsedList {
  const labels: string[] = []
  const byId = new Map<string, string>()
  const groupByLabel = new Map<string, string>()
  const boxByLabel = new Map<string, string>()

  const applyAliases = (display: string, tokens: string[]) => {
    for (const token of tokens) {
      const normalized = normalizeId(token)
      if (!normalized) continue
      byId.set(normalized, display)
    }
  }

  for (const item of items) {
    if (typeof item === 'string') {
      const display = item.trim()
      if (!display) continue
      labels.push(display)
      applyAliases(display, [display])
      continue
    }

    if (!isRecord(item)) continue
    const display =
      (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!display) continue

    labels.push(display)
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    applyAliases(display, [display, id, ...aliases])

    const group = typeof item.group === 'string' ? item.group.trim() : ''
    const box = typeof item.box === 'string' ? item.box.trim() : ''
    if (group) groupByLabel.set(display, group)
    if (box) boxByLabel.set(display, box)
  }

  return { labels, byId, groupByLabel, boxByLabel }
}

export function parseKingdomsForlornContent(text: string): KingdomsForlornContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.knights) || !Array.isArray(yaml.kingdoms)) {
    throw new Error(
      'Failed to parse Kingdoms Forlorn content (expected YAML with `knights` and `kingdoms` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const knights = parseNamedList(yaml.knights as KingdomsForlornYamlItem[])
  const kingdoms = parseNamedList(yaml.kingdoms as KingdomsForlornYamlItem[])

  return {
    knights: knights.labels,
    kingdoms: kingdoms.labels,
    knightsById: knights.byId,
    kingdomsById: kingdoms.byId,
    knightGroupByName: knights.groupByLabel,
    kingdomGroupByName: kingdoms.groupByLabel,
    knightBoxByName: knights.boxByLabel,
    kingdomBoxByName: kingdoms.boxByLabel,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const kingdomsForlornContent = parseKingdomsForlornContent(contentText)
