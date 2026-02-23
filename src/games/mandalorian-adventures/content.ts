import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type MandalorianYamlItem =
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

export type MandalorianAdventuresContent = {
  missions: string[]
  characters: string[]
  encounters: string[]
  missionsById: Map<string, string>
  charactersById: Map<string, string>
  encountersById: Map<string, string>
  missionGroupByName: Map<string, string>
  characterGroupByName: Map<string, string>
  encounterGroupByName: Map<string, string>
  missionBoxByName: Map<string, string>
  characterBoxByName: Map<string, string>
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

function parseNamedList(items: MandalorianYamlItem[]): ParsedList {
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

function addMissionAliases(missions: string[], byId: Map<string, string>) {
  for (const mission of missions) {
    const match = mission.match(/mission\s*([0-9]+)$/i)
    if (!match?.[1]) continue
    const n = match[1]
    const aliases = [n, `m${n}`, `mission${n}`]
    for (const alias of aliases) {
      const normalized = normalizeId(alias)
      if (!normalized) continue
      byId.set(normalized, mission)
    }
  }
}

export function parseMandalorianAdventuresContent(text: string): MandalorianAdventuresContent {
  const yaml = parseYamlValue(text)
  if (
    !isRecord(yaml) ||
    !Array.isArray(yaml.missions) ||
    !Array.isArray(yaml.characters) ||
    !Array.isArray(yaml.encounters)
  ) {
    throw new Error(
      'Failed to parse The Mandalorian: Adventures content (expected YAML with `missions`, `characters`, and `encounters` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const missions = parseNamedList(yaml.missions as MandalorianYamlItem[])
  const characters = parseNamedList(yaml.characters as MandalorianYamlItem[])
  const encounters = parseNamedList(yaml.encounters as MandalorianYamlItem[])
  addMissionAliases(missions.labels, missions.byId)

  return {
    missions: missions.labels,
    characters: characters.labels,
    encounters: encounters.labels,
    missionsById: missions.byId,
    charactersById: characters.byId,
    encountersById: encounters.byId,
    missionGroupByName: missions.groupByLabel,
    characterGroupByName: characters.groupByLabel,
    encounterGroupByName: encounters.groupByLabel,
    missionBoxByName: missions.boxByLabel,
    characterBoxByName: characters.boxByLabel,
    encounterBoxByName: encounters.boxByLabel,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const mandalorianAdventuresContent = parseMandalorianAdventuresContent(contentText)
