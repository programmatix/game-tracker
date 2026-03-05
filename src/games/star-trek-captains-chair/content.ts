import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type StarTrekYamlItem =
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

export type StarTrekCaptainsChairContent = {
  scenarios: string[]
  captains: string[]
  scenariosById: Map<string, string>
  captainsById: Map<string, string>
  scenarioGroupByName: Map<string, string>
  captainGroupByName: Map<string, string>
  scenarioBoxByName: Map<string, string>
  captainBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: StarTrekYamlItem[]): ParsedList {
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

export function parseStarTrekCaptainsChairContent(text: string): StarTrekCaptainsChairContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.scenarios) || !Array.isArray(yaml.captains)) {
    throw new Error(
      "Failed to parse Star Trek: Captain's Chair content (expected YAML with `scenarios` and `captains` arrays).",
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const scenarios = parseNamedList(yaml.scenarios as StarTrekYamlItem[])
  const captains = parseNamedList(yaml.captains as StarTrekYamlItem[])

  return {
    scenarios: scenarios.labels,
    captains: captains.labels,
    scenariosById: scenarios.byId,
    captainsById: captains.byId,
    scenarioGroupByName: scenarios.groupByLabel,
    captainGroupByName: captains.groupByLabel,
    scenarioBoxByName: scenarios.boxByLabel,
    captainBoxByName: captains.boxByLabel,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const starTrekCaptainsChairContent = parseStarTrekCaptainsChairContent(contentText)
