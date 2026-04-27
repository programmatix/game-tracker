import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type TaintedGrailContent = {
  campaigns: string[]
  campaignsById: Map<string, string>
  campaignGroupByName: Map<string, string>
  campaignBoxByName: Map<string, string>
  chapterNamesByCampaignName: Map<string, string[]>
  chapterLookupByCampaignName: Map<string, Map<string, string>>
  chapters: string[]
  chaptersById: Map<string, string>
  chapterShortLabelByName: Map<string, string>
  chapterCampaignByName: Map<string, string>
  chapterGroupByName: Map<string, string>
  chapterBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type TaintedGrailYamlChapter =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      box?: string
    }

type TaintedGrailYamlCampaign =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      box?: string
      chapters?: TaintedGrailYamlChapter[]
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

function chapterAliases(display: string, extra: string[]): string[] {
  return [display, ...extra]
}

function chapterAliasesWithinCampaign(display: string, extra: string[]): string[] {
  const aliases = chapterAliases(display, extra)
  const match = display.match(/\b([0-9]+)$/)
  if (match?.[1]) {
    aliases.push(match[1], `c${match[1]}`, `chapter${match[1]}`, `chapter ${match[1]}`)
  }
  return aliases
}

function defaultCampaignDisplay(item: Record<string, unknown>): string {
  return (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
    .trim()
    .replace(/\s+/g, ' ')
}

function defaultChapterDisplay(item: Record<string, unknown>): string {
  return (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function parseTaintedGrailContent(text: string): TaintedGrailContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml)) {
    throw new Error('Failed to parse Tainted Grail content (expected YAML object).')
  }

  const costs = parseBoxCostConfig(yaml)
  const campaigns: string[] = []
  const campaignsById = new Map<string, string>()
  const campaignGroupByName = new Map<string, string>()
  const campaignBoxByName = new Map<string, string>()
  const chapterNamesByCampaignName = new Map<string, string[]>()
  const chapterLookupByCampaignName = new Map<string, Map<string, string>>()
  const chapters: string[] = []
  const chaptersById = new Map<string, string>()
  const chapterShortLabelByName = new Map<string, string>()
  const chapterCampaignByName = new Map<string, string>()
  const chapterGroupByName = new Map<string, string>()
  const chapterBoxByName = new Map<string, string>()

  const addCampaign = (
    campaignDisplay: string,
    aliases: string[],
    group: string,
    box: string,
    yamlChapters: TaintedGrailYamlChapter[],
  ) => {
    campaigns.push(campaignDisplay)
    applyAliases(campaignsById, campaignDisplay, [campaignDisplay, ...aliases])
    if (group) campaignGroupByName.set(campaignDisplay, group)
    if (box) campaignBoxByName.set(campaignDisplay, box)

    const campaignChapterNames: string[] = []
    const campaignChapterLookup = new Map<string, string>()

    for (const item of yamlChapters) {
      if (typeof item === 'string') {
        const shortLabel = item.trim().replace(/\s+/g, ' ')
        if (!shortLabel) continue
        const chapterDisplay = `${campaignDisplay} • ${shortLabel}`
        chapters.push(chapterDisplay)
        campaignChapterNames.push(chapterDisplay)
        chapterShortLabelByName.set(chapterDisplay, shortLabel)
        chapterCampaignByName.set(chapterDisplay, campaignDisplay)
        if (group) chapterGroupByName.set(chapterDisplay, group)
        if (box) chapterBoxByName.set(chapterDisplay, box)
        const aliasesForChapter = chapterAliases(shortLabel, [])
        const campaignAliasesForChapter = chapterAliasesWithinCampaign(shortLabel, [])
        applyAliases(chaptersById, chapterDisplay, aliasesForChapter)
        applyAliases(campaignChapterLookup, chapterDisplay, campaignAliasesForChapter)
        continue
      }

      if (!isRecord(item)) continue
      const shortLabel = defaultChapterDisplay(item)
      if (!shortLabel) continue
      const chapterDisplay = `${campaignDisplay} • ${shortLabel}`
      chapters.push(chapterDisplay)
      campaignChapterNames.push(chapterDisplay)
      chapterShortLabelByName.set(chapterDisplay, shortLabel)
      chapterCampaignByName.set(chapterDisplay, campaignDisplay)

      const itemAliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      const aliasesForChapter = chapterAliases(
        shortLabel,
        [...(typeof item.id === 'string' ? [item.id] : []), ...itemAliases],
      )
      const campaignAliasesForChapter = chapterAliasesWithinCampaign(
        shortLabel,
        [...(typeof item.id === 'string' ? [item.id] : []), ...itemAliases],
      )

      applyAliases(chaptersById, chapterDisplay, aliasesForChapter)
      applyAliases(campaignChapterLookup, chapterDisplay, campaignAliasesForChapter)

      const chapterGroup = (typeof item.group === 'string' ? item.group : group).trim()
      if (chapterGroup) chapterGroupByName.set(chapterDisplay, chapterGroup)

      const chapterBox = (typeof item.box === 'string' ? item.box : box).trim()
      if (chapterBox) chapterBoxByName.set(chapterDisplay, chapterBox)
    }

    chapterNamesByCampaignName.set(campaignDisplay, campaignChapterNames)
    chapterLookupByCampaignName.set(campaignDisplay, campaignChapterLookup)
  }

  if (Array.isArray(yaml.campaigns)) {
    for (const campaignItem of yaml.campaigns as TaintedGrailYamlCampaign[]) {
      if (!isRecord(campaignItem)) continue
      const campaignDisplay = defaultCampaignDisplay(campaignItem)
      if (!campaignDisplay) continue
      const aliases = Array.isArray(campaignItem.aliases)
        ? campaignItem.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      const group = (typeof campaignItem.group === 'string' ? campaignItem.group : '').trim()
      const box = (typeof campaignItem.box === 'string' ? campaignItem.box : '').trim()
      const chaptersForCampaign = Array.isArray(campaignItem.chapters)
        ? campaignItem.chapters
        : []
      addCampaign(
        campaignDisplay,
        [...(typeof campaignItem.id === 'string' ? [campaignItem.id] : []), ...aliases],
        group,
        box,
        chaptersForCampaign,
      )
    }
  } else if (Array.isArray(yaml.chapters)) {
    addCampaign('The Fall of Avalon', ['FallOfAvalon', 'FoA'], 'Core', 'Core', yaml.chapters as TaintedGrailYamlChapter[])
  } else {
    throw new Error(
      'Failed to parse Tainted Grail content (expected YAML with `campaigns` or `chapters`).',
    )
  }

  return {
    campaigns,
    campaignsById,
    campaignGroupByName,
    campaignBoxByName,
    chapterNamesByCampaignName,
    chapterLookupByCampaignName,
    chapters,
    chaptersById,
    chapterShortLabelByName,
    chapterCampaignByName,
    chapterGroupByName,
    chapterBoxByName,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const taintedGrailContent = parseTaintedGrailContent(contentText)
