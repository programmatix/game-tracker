import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type OathswornYamlItem =
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

export type OathswornContent = {
  characters: string[]
  stories: string[]
  encounters: string[]
  charactersById: Map<string, string>
  storiesById: Map<string, string>
  encountersById: Map<string, string>
  characterGroupByName: Map<string, string>
  storyGroupByName: Map<string, string>
  encounterGroupByName: Map<string, string>
  characterBoxByName: Map<string, string>
  storyBoxByName: Map<string, string>
  encounterBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: OathswornYamlItem[]): ParsedList {
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

function addChapterAliases(
  labels: string[],
  byId: Map<string, string>,
  prefix: 'story' | 'encounter',
  shortPrefix: 's' | 'e',
) {
  for (const label of labels) {
    const match = label.match(/\b([0-9]+)$/)
    if (!match?.[1]) continue
    const n = match[1]
    const aliases = [n, `${shortPrefix}${n}`, `${prefix}${n}`, `${prefix} ${n}`, `chapter${n}`, `chapter ${n}`]
    for (const alias of aliases) {
      const normalized = normalizeId(alias)
      if (!normalized) continue
      byId.set(normalized, label)
    }
  }
}

export function parseOathswornContent(text: string): OathswornContent {
  const yaml = parseYamlValue(text)
  if (
    !isRecord(yaml) ||
    !Array.isArray(yaml.characters) ||
    !Array.isArray(yaml.stories) ||
    !Array.isArray(yaml.encounters)
  ) {
    throw new Error(
      'Failed to parse Oathsworn content (expected YAML with `characters`, `stories`, and `encounters` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const characters = parseNamedList(yaml.characters as OathswornYamlItem[])
  const stories = parseNamedList(yaml.stories as OathswornYamlItem[])
  const encounters = parseNamedList(yaml.encounters as OathswornYamlItem[])
  addChapterAliases(stories.labels, stories.byId, 'story', 's')
  addChapterAliases(encounters.labels, encounters.byId, 'encounter', 'e')

  return {
    characters: characters.labels,
    stories: stories.labels,
    encounters: encounters.labels,
    charactersById: characters.byId,
    storiesById: stories.byId,
    encountersById: encounters.byId,
    characterGroupByName: characters.groupByLabel,
    storyGroupByName: stories.groupByLabel,
    encounterGroupByName: encounters.groupByLabel,
    characterBoxByName: characters.boxByLabel,
    storyBoxByName: stories.boxByLabel,
    encounterBoxByName: encounters.boxByLabel,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const oathswornContent = parseOathswornContent(contentText)
