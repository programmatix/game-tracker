import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type NanolithContent = {
  heroes: string[]
  encounters: string[]
  heroesById: Map<string, string>
  encountersById: Map<string, string>
  heroBoxByName: Map<string, string>
  encounterBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type NanolithYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      box?: string
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

function parseHeroes(yaml: Record<string, unknown>) {
  const heroes: string[] = []
  const heroesById = new Map<string, string>()
  const heroBoxByName = new Map<string, string>()
  const raw = Array.isArray(yaml.heroes) ? (yaml.heroes as NanolithYamlItem[]) : []

  for (const item of raw) {
    if (typeof item === 'string') {
      const display = item.trim()
      if (!display) continue
      heroes.push(display)
      applyAliases(heroesById, display, [display])
      continue
    }

    if (!isRecord(item)) continue
    const display =
      (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!display) continue

    heroes.push(display)
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    applyAliases(heroesById, display, [
      display,
      ...(typeof item.id === 'string' ? [item.id] : []),
      ...aliases,
    ])

    const box = (typeof item.box === 'string' ? item.box : '').trim()
    if (box) heroBoxByName.set(display, box)
  }

  return { heroes, heroesById, heroBoxByName }
}

function parseEncounters(yaml: Record<string, unknown>) {
  const encounters: string[] = []
  const encountersById = new Map<string, string>()
  const encounterBoxByName = new Map<string, string>()

  const encounterCount =
    typeof yaml.encounterCount === 'number' && Number.isFinite(yaml.encounterCount)
      ? Math.max(0, Math.floor(yaml.encounterCount))
      : 0

  for (let index = 1; index <= encounterCount; index += 1) {
    const display = `Encounter ${index}`
    encounters.push(display)
    encounterBoxByName.set(display, 'Core')
    applyAliases(encountersById, display, [
      String(index),
      `s${index}`,
      `e${index}`,
      `encounter${index}`,
      `encounter ${index}`,
      `scenario${index}`,
      `scenario ${index}`,
    ])
  }

  return { encounters, encountersById, encounterBoxByName }
}

export function parseNanolithContent(text: string): NanolithContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml)) {
    throw new Error('Failed to parse Nanolith content.')
  }

  const costs = parseBoxCostConfig(yaml)
  const heroes = parseHeroes(yaml)
  const encounters = parseEncounters(yaml)

  return {
    ...heroes,
    ...encounters,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const nanolithContent = parseNanolithContent(contentText)
