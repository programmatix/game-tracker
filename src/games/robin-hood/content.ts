import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type RobinHoodYamlItem =
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

export type RobinHoodContent = {
  adventures: string[]
  characters: string[]
  adventuresById: Map<string, string>
  charactersById: Map<string, string>
  adventureGroupByName: Map<string, string>
  characterGroupByName: Map<string, string>
  adventureBoxByName: Map<string, string>
  characterBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: RobinHoodYamlItem[]): ParsedList {
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
    const id = typeof item.id === 'string' ? item.id.trim() : undefined
    applyAliases(display, [display, ...(id ? [id] : []), ...aliases])

    const group = typeof item.group === 'string' ? item.group.trim() : ''
    const box = typeof item.box === 'string' ? item.box.trim() : ''
    if (group) groupByLabel.set(display, group)
    if (box) boxByLabel.set(display, box)
  }

  return { labels, byId, groupByLabel, boxByLabel }
}

function addAdventureAliases(adventures: string[], byId: Map<string, string>) {
  for (const adventure of adventures) {
    const match = adventure.match(/adventure\s*([0-9]+)$/i)
    if (!match?.[1]) continue
    const n = match[1]
    for (const alias of [n, `a${n}`, `adventure${n}`]) {
      const normalized = normalizeId(alias)
      if (!normalized) continue
      byId.set(normalized, adventure)
    }
  }
}

export function parseRobinHoodContent(text: string): RobinHoodContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.adventures) || !Array.isArray(yaml.characters)) {
    throw new Error(
      'Failed to parse The Adventures of Robin Hood content (expected YAML with `adventures` and `characters` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const adventures = parseNamedList(yaml.adventures as RobinHoodYamlItem[])
  const characters = parseNamedList(yaml.characters as RobinHoodYamlItem[])
  addAdventureAliases(adventures.labels, adventures.byId)

  return {
    adventures: adventures.labels,
    characters: characters.labels,
    adventuresById: adventures.byId,
    charactersById: characters.byId,
    adventureGroupByName: adventures.groupByLabel,
    characterGroupByName: characters.groupByLabel,
    adventureBoxByName: adventures.boxByLabel,
    characterBoxByName: characters.boxByLabel,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const robinHoodContent = parseRobinHoodContent(contentText)
