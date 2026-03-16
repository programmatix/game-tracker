import contentText from './content.yaml?raw'
import { parseBoxCostConfig } from '../../contentCosts'
import { isRecord, parseYamlValue } from '../../yaml'

type DeckersYamlItem =
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
  groupsInOrder: string[]
}

export type DeckersContent = {
  deckers: string[]
  smcs: string[]
  deckersById: Map<string, string>
  smcsById: Map<string, string>
  deckerGroupByName: Map<string, string>
  deckerBoxByName: Map<string, string>
  smcBoxByName: Map<string, string>
  deckerGroups: string[]
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: DeckersYamlItem[]): ParsedList {
  const labels: string[] = []
  const byId = new Map<string, string>()
  const groupByLabel = new Map<string, string>()
  const boxByLabel = new Map<string, string>()
  const groupsInOrder: string[] = []
  const seenGroups = new Set<string>()

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
    if (group) {
      groupByLabel.set(display, group)
      if (!seenGroups.has(group)) {
        seenGroups.add(group)
        groupsInOrder.push(group)
      }
    }
    if (box) boxByLabel.set(display, box)
  }

  return { labels, byId, groupByLabel, boxByLabel, groupsInOrder }
}

export function parseDeckersContent(text: string): DeckersContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.deckers) || !Array.isArray(yaml.smcs)) {
    throw new Error(
      'Failed to parse Deckers content (expected YAML with `deckers` and `smcs` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const deckers = parseNamedList(yaml.deckers as DeckersYamlItem[])
  const smcs = parseNamedList(yaml.smcs as DeckersYamlItem[])

  return {
    deckers: deckers.labels,
    smcs: smcs.labels,
    deckersById: deckers.byId,
    smcsById: smcs.byId,
    deckerGroupByName: deckers.groupByLabel,
    deckerBoxByName: deckers.boxByLabel,
    smcBoxByName: smcs.boxByLabel,
    deckerGroups: deckers.groupsInOrder,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const deckersContent = parseDeckersContent(contentText)
