import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type MageKnightContent = {
  heroes: string[]
  heroesById: Map<string, string>
  heroBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type MageKnightYamlItem =
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

export function parseMageKnightContent(text: string): MageKnightContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.heroes)) {
    const costs = parseBoxCostConfig(yaml)
    const heroes: string[] = []
    const heroesById = new Map<string, string>()
    const heroBoxByName = new Map<string, string>()

    const applyAliases = (display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        heroesById.set(normalized, display)
      }
    }

    const applyItem = (item: MageKnightYamlItem) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        heroes.push(display)
        applyAliases(display, [display])
        return
      }

      if (!isRecord(item)) return
      const display =
        (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
          .trim()
      if (!display) return

      heroes.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      const box = typeof item.box === 'string' ? item.box.trim() : ''
      if (box) heroBoxByName.set(display, box)

      applyAliases(display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    for (const item of yaml.heroes as MageKnightYamlItem[]) applyItem(item)

    return {
      heroes,
      heroesById,
      heroBoxByName,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error('Failed to parse Mage Knight content (expected YAML with a `heroes` array).')
}

export const mageKnightContent = parseMageKnightContent(contentText)
