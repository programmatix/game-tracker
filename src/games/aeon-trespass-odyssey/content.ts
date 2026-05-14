import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type AeonTrespassOdysseyContent = {
  cycles: string[]
  cyclesById: Map<string, string>
  cycleGroupByName: Map<string, string>
  cycleBoxByName: Map<string, string>
  dayNamesByCycleName: Map<string, string[]>
  dayLookupByCycleName: Map<string, Map<string, string>>
  days: string[]
  daysById: Map<string, string>
  dayShortLabelByName: Map<string, string>
  dayCycleByName: Map<string, string>
  dayGroupByName: Map<string, string>
  dayBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type AeonTrespassOdysseyYamlDay =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      box?: string
    }

type AeonTrespassOdysseyYamlCycle =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      box?: string
      days?: AeonTrespassOdysseyYamlDay[]
    }

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function compactLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function applyAliases(map: Map<string, string>, display: string, tokens: string[]) {
  for (const token of tokens) {
    const normalized = normalizeId(token)
    if (!normalized) continue
    if (!map.has(normalized)) map.set(normalized, display)
  }
}

function displayFromItem(item: Record<string, unknown>): string {
  return (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
    .trim()
    .replace(/\s+/g, ' ')
}

function dayAliasesWithinCycle(shortLabel: string, extra: string[]): string[] {
  const aliases = [shortLabel, ...extra]
  const match = shortLabel.match(/\b([0-9]+)$/)
  if (match?.[1]) {
    const dayNumber = String(Number(match[1]))
    aliases.push(dayNumber, `d${dayNumber}`, `day${dayNumber}`, `day ${dayNumber}`)
  }
  return aliases
}

export function parseAeonTrespassOdysseyContent(text: string): AeonTrespassOdysseyContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.cycles)) {
    throw new Error('Failed to parse Aeon Trespass: Odyssey content (expected YAML with a `cycles` array).')
  }

  const costs = parseBoxCostConfig(yaml)
  const cycles: string[] = []
  const cyclesById = new Map<string, string>()
  const cycleGroupByName = new Map<string, string>()
  const cycleBoxByName = new Map<string, string>()
  const dayNamesByCycleName = new Map<string, string[]>()
  const dayLookupByCycleName = new Map<string, Map<string, string>>()
  const days: string[] = []
  const daysById = new Map<string, string>()
  const dayShortLabelByName = new Map<string, string>()
  const dayCycleByName = new Map<string, string>()
  const dayGroupByName = new Map<string, string>()
  const dayBoxByName = new Map<string, string>()

  for (const cycleItem of yaml.cycles as AeonTrespassOdysseyYamlCycle[]) {
    if (!isRecord(cycleItem)) continue

    const cycleDisplay = displayFromItem(cycleItem)
    if (!cycleDisplay) continue

    const cycleAliases = Array.isArray(cycleItem.aliases)
      ? cycleItem.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    const cycleId = typeof cycleItem.id === 'string' ? cycleItem.id.trim() : ''
    const cycleAliasTokens = [cycleDisplay, cycleId, ...cycleAliases].filter(Boolean)
    const cycleGroup = (typeof cycleItem.group === 'string' ? cycleItem.group : '').trim()
    const cycleBox = (typeof cycleItem.box === 'string' ? cycleItem.box : '').trim()

    cycles.push(cycleDisplay)
    applyAliases(cyclesById, cycleDisplay, cycleAliasTokens)
    if (cycleGroup) cycleGroupByName.set(cycleDisplay, cycleGroup)
    if (cycleBox) cycleBoxByName.set(cycleDisplay, cycleBox)

    const cycleDays: string[] = []
    const cycleDayLookup = new Map<string, string>()
    const yamlDays = Array.isArray(cycleItem.days) ? cycleItem.days : []

    for (const dayItem of yamlDays as AeonTrespassOdysseyYamlDay[]) {
      let shortLabel = ''
      let dayId = ''
      let dayAliases: string[] = []
      let dayGroup = cycleGroup
      let dayBox = cycleBox

      if (typeof dayItem === 'string') {
        shortLabel = compactLabel(dayItem)
      } else if (isRecord(dayItem)) {
        shortLabel = displayFromItem(dayItem)
        dayId = typeof dayItem.id === 'string' ? dayItem.id.trim() : ''
        dayAliases = Array.isArray(dayItem.aliases)
          ? dayItem.aliases.filter((alias): alias is string => typeof alias === 'string')
          : []
        dayGroup = (typeof dayItem.group === 'string' ? dayItem.group : dayGroup).trim()
        dayBox = (typeof dayItem.box === 'string' ? dayItem.box : dayBox).trim()
      }

      if (!shortLabel) continue
      const dayDisplay = `${cycleDisplay} • ${shortLabel}`
      const aliasesForDay = dayAliasesWithinCycle(shortLabel, [dayId, ...dayAliases].filter(Boolean))

      days.push(dayDisplay)
      cycleDays.push(dayDisplay)
      dayShortLabelByName.set(dayDisplay, shortLabel)
      dayCycleByName.set(dayDisplay, cycleDisplay)
      if (dayGroup) dayGroupByName.set(dayDisplay, dayGroup)
      if (dayBox) dayBoxByName.set(dayDisplay, dayBox)

      applyAliases(cycleDayLookup, dayDisplay, aliasesForDay)
      applyAliases(daysById, dayDisplay, [dayDisplay, `${cycleDisplay} ${shortLabel}`])

      for (const cycleAlias of cycleAliasTokens) {
        for (const dayAlias of aliasesForDay) {
          applyAliases(daysById, dayDisplay, [`${cycleAlias} ${dayAlias}`, `${cycleAlias}${dayAlias}`])
        }
      }
    }

    dayNamesByCycleName.set(cycleDisplay, cycleDays)
    dayLookupByCycleName.set(cycleDisplay, cycleDayLookup)
  }

  return {
    cycles,
    cyclesById,
    cycleGroupByName,
    cycleBoxByName,
    dayNamesByCycleName,
    dayLookupByCycleName,
    days,
    daysById,
    dayShortLabelByName,
    dayCycleByName,
    dayGroupByName,
    dayBoxByName,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const aeonTrespassOdysseyContent = parseAeonTrespassOdysseyContent(contentText)
