import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type SkytearHordeContent = {
  heroPrecons: string[]
  enemyPrecons: string[]
  heroPreconsById: Map<string, string>
  enemyPreconsById: Map<string, string>
  heroBoxByPrecon: Map<string, string>
  enemyBoxByPrecon: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type SkytearHordeYamlItem =
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

function parsePreconList(items: SkytearHordeYamlItem[]): {
  labels: string[]
  byId: Map<string, string>
  boxByLabel: Map<string, string>
} {
  const labels: string[] = []
  const byId = new Map<string, string>()
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
    if (!display) continue
    labels.push(display)

    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    const id = typeof item.id === 'string' ? item.id : undefined
    applyAliases(display, [display, ...(id ? [id] : []), ...aliases])

    const box = typeof item.box === 'string' ? item.box.trim() : ''
    if (box) boxByLabel.set(display, box)
  }

  return { labels, byId, boxByLabel }
}

export function parseSkytearHordeContent(text: string): SkytearHordeContent {
  const yaml = parseYamlValue(text)
  if (
    isRecord(yaml) &&
    Array.isArray(yaml.heroPrecons) &&
    Array.isArray(yaml.enemyPrecons)
  ) {
    const costs = parseBoxCostConfig(yaml)
    const heroes = parsePreconList(yaml.heroPrecons as SkytearHordeYamlItem[])
    const enemies = parsePreconList(yaml.enemyPrecons as SkytearHordeYamlItem[])

    return {
      heroPrecons: heroes.labels,
      enemyPrecons: enemies.labels,
      heroPreconsById: heroes.byId,
      enemyPreconsById: enemies.byId,
      heroBoxByPrecon: heroes.boxByLabel,
      enemyBoxByPrecon: enemies.boxByLabel,
      costCurrencySymbol: costs.currencySymbol,
      boxCostsByName: costs.boxCostsByName,
    }
  }

  throw new Error(
    'Failed to parse Skytear Horde content (expected YAML with `heroPrecons` and `enemyPrecons` arrays).',
  )
}

export const skytearHordeContent = parseSkytearHordeContent(contentText)
