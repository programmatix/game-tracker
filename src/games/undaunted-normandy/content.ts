import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type UndauntedYamlItem =
  | string
  | {
      display: string
      id?: string
      aliases?: string[]
      box?: string
    }

export type UndauntedNormandyContent = {
  scenarios: string[]
  sides: string[]
  scenariosById: Map<string, string>
  sidesById: Map<string, string>
  scenarioBoxByName: Map<string, string>
  sideBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: UndauntedYamlItem[]): {
  labels: string[]
  byId: Map<string, string>
  boxByLabel: Map<string, string>
} {
  const labels: string[] = []
  const byId = new Map<string, string>()
  const boxByLabel = new Map<string, string>()

  const addAliases = (display: string, tokens: string[]) => {
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
      addAliases(display, [display])
      continue
    }

    if (!isRecord(item) || typeof item.display !== 'string') continue
    const display = item.display.trim()
    if (!display) continue
    labels.push(display)

    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    const box = typeof item.box === 'string' ? item.box.trim() : ''
    if (box) boxByLabel.set(display, box)

    addAliases(display, [display, ...(id ? [id] : []), ...aliases])
  }

  return { labels, byId, boxByLabel }
}

function addScenarioDerivedAliases(scenarios: string[], byId: Map<string, string>) {
  for (const scenario of scenarios) {
    const match = scenario.match(/([0-9]+)\s*$/)
    if (!match?.[1]) continue
    const n = match[1]
    const aliases = [n, `s${n}`, `sc${n}`, `scenario${n}`, `normandyscenario${n}`]
    for (const alias of aliases) {
      const normalized = normalizeId(alias)
      if (!normalized) continue
      byId.set(normalized, scenario)
    }
  }
}

export function parseUndauntedNormandyContent(text: string): UndauntedNormandyContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.scenarios) || !Array.isArray(yaml.sides)) {
    throw new Error(
      'Failed to parse Undaunted: Normandy content (expected YAML with `scenarios` and `sides` arrays).',
    )
  }
  const costs = parseBoxCostConfig(yaml)

  const parsedScenarios = parseNamedList(yaml.scenarios as UndauntedYamlItem[])
  const parsedSides = parseNamedList(yaml.sides as UndauntedYamlItem[])
  addScenarioDerivedAliases(parsedScenarios.labels, parsedScenarios.byId)

  return {
    scenarios: parsedScenarios.labels,
    sides: parsedSides.labels,
    scenariosById: parsedScenarios.byId,
    sidesById: parsedSides.byId,
    scenarioBoxByName: parsedScenarios.boxByLabel,
    sideBoxByName: parsedSides.boxByLabel,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const undauntedNormandyContent = parseUndauntedNormandyContent(contentText)
