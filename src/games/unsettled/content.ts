import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type UnsettledContent = {
  planets: string[]
  tasks: string[]
  planetsById: Map<string, string>
  tasksById: Map<string, string>
  planetBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type UnsettledYamlItem =
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

function normalizeTaskId(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

export function parseUnsettledContent(text: string): UnsettledContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.planets)) {
    throw new Error('Failed to parse Unsettled content (expected YAML with a `planets` array).')
  }
  const costs = parseBoxCostConfig(yaml)

  const tasksRaw = Array.isArray(yaml.tasks) ? (yaml.tasks as unknown[]) : ['A', 'B', 'C']
  const tasks: string[] = []
  const tasksById = new Map<string, string>()
  for (const task of tasksRaw) {
    if (typeof task !== 'string') continue
    const display = task.trim().toUpperCase()
    if (!display) continue
    tasks.push(display)
    tasksById.set(normalizeTaskId(display), display)
  }

  const planets: string[] = []
  const planetsById = new Map<string, string>()
  const planetBoxByName = new Map<string, string>()

  const applyAliases = (display: string, tokens: string[]) => {
    for (const token of tokens) {
      const normalized = normalizeId(token)
      if (!normalized) continue
      planetsById.set(normalized, display)
    }
  }

  const applyItem = (item: UnsettledYamlItem) => {
    if (typeof item === 'string') {
      const display = item.trim()
      if (!display) return
      planets.push(display)
      applyAliases(display, [display])
      return
    }

    if (!isRecord(item)) return
    const display =
      (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
        .trim()
    if (!display) return
    planets.push(display)
    const box = typeof item.box === 'string' ? item.box.trim() : ''
    if (box) planetBoxByName.set(display, box)

    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    applyAliases(display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
  }

  for (const item of yaml.planets as UnsettledYamlItem[]) applyItem(item)

  return {
    planets,
    tasks,
    planetsById,
    tasksById,
    planetBoxByName,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const unsettledContent = parseUnsettledContent(contentText)
