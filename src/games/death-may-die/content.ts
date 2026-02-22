import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type DeathMayDieContent = {
  elderOnes: string[]
  scenarios: string[]
  investigators: string[]
  investigatorsById: Map<string, string>
  elderOneBoxByName: Map<string, string>
  scenarioBoxByName: Map<string, string>
  investigatorBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type DeathMayDieYamlItem =
  | string
  | number
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

export function parseDeathMayDieContent(text: string): DeathMayDieContent {
  const yaml = parseYamlValue(text)
  if (
    isRecord(yaml) &&
    Array.isArray(yaml.elderOnes) &&
    Array.isArray(yaml.scenarios) &&
    Array.isArray(yaml.investigators)
  ) {
    const costs = parseBoxCostConfig(yaml)
    const elderOnes: string[] = []
    const scenarios: string[] = []
    const investigators: string[] = []
    const investigatorsById = new Map<string, string>()
    const elderOneBoxByName = new Map<string, string>()
    const scenarioBoxByName = new Map<string, string>()
    const investigatorBoxByName = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    for (const item of yaml.elderOnes as DeathMayDieYamlItem[]) {
      const display =
        typeof item === 'string'
          ? item.trim()
          : isRecord(item)
            ? (
                typeof item.display === 'string'
                  ? item.display
                  : typeof item.id === 'string'
                    ? item.id
                    : ''
              ).trim()
            : ''
      if (!display) continue
      elderOnes.push(display)
      if (isRecord(item)) {
        const box = typeof item.box === 'string' ? item.box.trim() : ''
        if (box) elderOneBoxByName.set(display, box)
      }
    }

    for (const item of yaml.scenarios as DeathMayDieYamlItem[]) {
      const raw =
        typeof item === 'number'
          ? String(item)
          : typeof item === 'string'
            ? item
            : isRecord(item)
              ? typeof item.display === 'string'
                ? item.display
                : typeof item.id === 'string'
                  ? item.id
                  : ''
              : ''
      const trimmed = raw.trim()
      if (!trimmed) continue
      const normalized =
        /^scenario\b/i.test(trimmed)
          ? trimmed
          : /^\\d+$/.test(trimmed)
            ? `Scenario ${trimmed}`
            : trimmed
      scenarios.push(normalized)
      if (isRecord(item)) {
        const box = typeof item.box === 'string' ? item.box.trim() : ''
        if (box) scenarioBoxByName.set(normalized, box)
      }
    }

    for (const item of yaml.investigators as DeathMayDieYamlItem[]) {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) continue
        investigators.push(display)
        applyAliases(investigatorsById, display, [display])
        continue
      }

      if (!isRecord(item)) continue
      const display =
        (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
          .trim()
      if (!display) continue
      investigators.push(display)
      const box = typeof item.box === 'string' ? item.box.trim() : ''
      if (box) investigatorBoxByName.set(display, box)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(investigatorsById, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    return {
      elderOnes,
      scenarios,
      investigators,
      investigatorsById,
      elderOneBoxByName,
      scenarioBoxByName,
      investigatorBoxByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Cthulhu: Death May Die content (expected YAML with `elderOnes`, `scenarios`, and `investigators` arrays).',
  )
}

export const deathMayDieContent = parseDeathMayDieContent(contentText)
