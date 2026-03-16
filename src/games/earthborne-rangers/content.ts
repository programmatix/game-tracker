import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type EarthborneRangersContent = {
  days: string[]
  daysById: Map<string, string>
  dayBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type EarthborneRangersYamlItem =
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

export function parseEarthborneRangersContent(text: string): EarthborneRangersContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.days)) {
    const costs = parseBoxCostConfig(yaml)
    const days: string[] = []
    const daysById = new Map<string, string>()
    const dayBoxByName = new Map<string, string>()

    for (const item of yaml.days as EarthborneRangersYamlItem[]) {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) continue
        days.push(display)
        applyAliases(daysById, display, [display])
        continue
      }

      if (!isRecord(item)) continue
      const display =
        (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
          .trim()
      if (!display) continue

      days.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(daysById, display, [
        display,
        ...(typeof item.id === 'string' ? [item.id] : []),
        ...aliases,
      ])

      const box = (typeof item.box === 'string' ? item.box : '').trim()
      if (box) dayBoxByName.set(display, box)
    }

    return {
      days,
      daysById,
      dayBoxByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Earthborne Rangers content (expected YAML with a `days` array).',
  )
}

export const earthborneRangersContent = parseEarthborneRangersContent(contentText)
