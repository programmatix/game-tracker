import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type ArkhamHorrorLcgContent = {
  campaigns: string[]
  campaignsById: Map<string, string>
  campaignGroupByName: Map<string, string>
  campaignBoxByName: Map<string, string>
  scenarioNamesByCampaignName: Map<string, string[]>
  difficulties: string[]
  difficultiesById: Map<string, string>
  scenarios: string[]
  scenariosById: Map<string, string>
  scenarioCampaignByName: Map<string, string>
  scenarioBoxByName: Map<string, string>
  investigators: string[]
  investigatorsById: Map<string, string>
  investigatorClassByName: Map<string, string>
  investigatorBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type ArkhamYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      class?: string
      campaign?: string
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

function applyList(
  items: unknown,
  onItem: (item: Record<string, unknown>, display: string) => void,
  values: string[],
  lookup: Map<string, string>,
) {
  if (!Array.isArray(items)) return
  for (const item of items as ArkhamYamlItem[]) {
    if (typeof item === 'string') {
      const display = item.trim()
      if (!display) continue
      values.push(display)
      applyAliases(lookup, display, [display])
      continue
    }
    if (!isRecord(item)) continue
    const display =
      (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!display) continue
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    values.push(display)
    applyAliases(lookup, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    onItem(item, display)
  }
}

export function parseArkhamHorrorLcgContent(text: string): ArkhamHorrorLcgContent {
  const yaml = parseYamlValue(text)
  if (
    !isRecord(yaml) ||
    !Array.isArray(yaml.campaigns) ||
    !Array.isArray(yaml.difficulties) ||
    !Array.isArray(yaml.scenarios) ||
    !Array.isArray(yaml.investigators)
  ) {
    throw new Error(
      'Failed to parse Arkham Horror LCG content (expected YAML with `campaigns`, `difficulties`, `scenarios`, and `investigators` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)

  const campaigns: string[] = []
  const campaignsById = new Map<string, string>()
  const campaignGroupByName = new Map<string, string>()
  const campaignBoxByName = new Map<string, string>()
  const scenarioNamesByCampaignName = new Map<string, string[]>()
  const difficulties: string[] = []
  const difficultiesById = new Map<string, string>()
  const scenarios: string[] = []
  const scenariosById = new Map<string, string>()
  const scenarioCampaignByName = new Map<string, string>()
  const scenarioBoxByName = new Map<string, string>()
  const investigators: string[] = []
  const investigatorsById = new Map<string, string>()
  const investigatorClassByName = new Map<string, string>()
  const investigatorBoxByName = new Map<string, string>()

  applyList(
    yaml.campaigns,
    (item, display) => {
      const group = typeof item.group === 'string' ? item.group.trim() : ''
      if (group) campaignGroupByName.set(display, group)
      const box = typeof item.box === 'string' ? item.box.trim() : ''
      if (box) campaignBoxByName.set(display, box)
    },
    campaigns,
    campaignsById,
  )

  applyList(yaml.difficulties, () => {}, difficulties, difficultiesById)

  applyList(
    yaml.scenarios,
    (item, display) => {
      const campaign = typeof item.campaign === 'string' ? item.campaign.trim() : ''
      if (campaign) {
        scenarioCampaignByName.set(display, campaign)
        const existing = scenarioNamesByCampaignName.get(campaign)
        if (existing) existing.push(display)
        else scenarioNamesByCampaignName.set(campaign, [display])
      }
      const box = typeof item.box === 'string' ? item.box.trim() : ''
      if (box) scenarioBoxByName.set(display, box)
    },
    scenarios,
    scenariosById,
  )

  applyList(
    yaml.investigators,
    (item, display) => {
      const investigatorClass = typeof item.class === 'string' ? item.class.trim() : ''
      if (investigatorClass) investigatorClassByName.set(display, investigatorClass)
      const box = typeof item.box === 'string' ? item.box.trim() : ''
      if (box) investigatorBoxByName.set(display, box)
    },
    investigators,
    investigatorsById,
  )

  return {
    campaigns,
    campaignsById,
    campaignGroupByName,
    campaignBoxByName,
    scenarioNamesByCampaignName,
    difficulties,
    difficultiesById,
    scenarios,
    scenariosById,
    scenarioCampaignByName,
    scenarioBoxByName,
    investigators,
    investigatorsById,
    investigatorClassByName,
    investigatorBoxByName,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const arkhamHorrorLcgContent = parseArkhamHorrorLcgContent(contentText)
