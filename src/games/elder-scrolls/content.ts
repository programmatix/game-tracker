import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type ElderScrollsYamlItem =
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

export type ElderScrollsContent = {
  provinces: string[]
  races: string[]
  classes: string[]
  provincesById: Map<string, string>
  racesById: Map<string, string>
  classesById: Map<string, string>
  raceGroupByName: Map<string, string>
  provinceBoxByName: Map<string, string>
  raceBoxByName: Map<string, string>
  classBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: ElderScrollsYamlItem[]): ParsedList {
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

export function parseElderScrollsContent(text: string): ElderScrollsContent {
  const yaml = parseYamlValue(text)
  if (
    !isRecord(yaml) ||
    !Array.isArray(yaml.provinces) ||
    !Array.isArray(yaml.races) ||
    !Array.isArray(yaml.classes)
  ) {
    throw new Error(
      'Failed to parse Elder Scrolls content (expected YAML with `provinces`, `races`, and `classes` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const provinces = parseNamedList(yaml.provinces as ElderScrollsYamlItem[])
  const races = parseNamedList(yaml.races as ElderScrollsYamlItem[])
  const classes = parseNamedList(yaml.classes as ElderScrollsYamlItem[])

  return {
    provinces: provinces.labels,
    races: races.labels,
    classes: classes.labels,
    provincesById: provinces.byId,
    racesById: races.byId,
    classesById: classes.byId,
    raceGroupByName: races.groupByLabel,
    provinceBoxByName: provinces.boxByLabel,
    raceBoxByName: races.boxByLabel,
    classBoxByName: classes.boxByLabel,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const elderScrollsContent = parseElderScrollsContent(contentText)
