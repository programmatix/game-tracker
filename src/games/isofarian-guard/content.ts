import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

type IsofarianYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
      box?: string
    }

type IsofarianCampaignYamlItem = {
  display?: string
  id?: string
  aliases?: string[]
  group?: string
  box?: string
  chapterCounts?: unknown
}

type ParsedNamedList = {
  labels: string[]
  byId: Map<string, string>
  groupByLabel: Map<string, string>
  boxByLabel: Map<string, string>
}

export type IsofarianGuardContent = {
  campaigns: string[]
  chapters: string[]
  guards: string[]
  campaignsById: Map<string, string>
  chaptersById: Map<string, string>
  guardsById: Map<string, string>
  campaignGroupByName: Map<string, string>
  chapterGroupByName: Map<string, string>
  guardGroupByName: Map<string, string>
  campaignBoxByName: Map<string, string>
  chapterBoxByName: Map<string, string>
  guardBoxByName: Map<string, string>
  chapterCampaignByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseNamedList(items: IsofarianYamlItem[]): ParsedNamedList {
  const labels: string[] = []
  const byId = new Map<string, string>()
  const groupByLabel = new Map<string, string>()
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
        .replace(/\s+/g, ' ')
    if (!display) continue

    labels.push(display)
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    applyAliases(display, [display, id, ...aliases])

    const group = typeof item.group === 'string' ? item.group.trim() : ''
    const box = typeof item.box === 'string' ? item.box.trim() : ''
    if (group) groupByLabel.set(display, group)
    if (box) boxByLabel.set(display, box)
  }

  return { labels, byId, groupByLabel, boxByLabel }
}

function parseChapterCounts(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => Number(entry))
    .filter((count) => Number.isInteger(count) && count > 0)
}

export function parseIsofarianGuardContent(text: string): IsofarianGuardContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.campaigns) || !Array.isArray(yaml.guards)) {
    throw new Error(
      'Failed to parse Isofarian Guard content (expected YAML with `campaigns` and `guards` arrays).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const parsedGuards = parseNamedList(yaml.guards as IsofarianYamlItem[])

  const campaigns: string[] = []
  const chapters: string[] = []
  const campaignsById = new Map<string, string>()
  const chaptersById = new Map<string, string>()
  const campaignGroupByName = new Map<string, string>()
  const chapterGroupByName = new Map<string, string>()
  const campaignBoxByName = new Map<string, string>()
  const chapterBoxByName = new Map<string, string>()
  const chapterCampaignByName = new Map<string, string>()

  for (const rawItem of yaml.campaigns as IsofarianCampaignYamlItem[]) {
    if (!isRecord(rawItem)) continue
    const display =
      (typeof rawItem.display === 'string' ? rawItem.display : typeof rawItem.id === 'string' ? rawItem.id : '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!display) continue

    campaigns.push(display)
    const id = typeof rawItem.id === 'string' ? rawItem.id.trim() : ''
    const aliases = Array.isArray(rawItem.aliases)
      ? rawItem.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    for (const token of [display, id, ...aliases]) {
      const normalized = normalizeId(token)
      if (!normalized) continue
      campaignsById.set(normalized, display)
    }

    const group = typeof rawItem.group === 'string' ? rawItem.group.trim() : ''
    const box = typeof rawItem.box === 'string' ? rawItem.box.trim() : ''
    if (group) campaignGroupByName.set(display, group)
    if (box) campaignBoxByName.set(display, box)

    const chapterCounts = parseChapterCounts(rawItem.chapterCounts)
    for (let actIndex = 0; actIndex < chapterCounts.length; actIndex += 1) {
      const count = chapterCounts[actIndex]!
      const act = actIndex + 1
      for (let chapter = 1; chapter <= count; chapter += 1) {
        const chapterCode = `${act}:${chapter}`
        const chapterDisplay = `${display} • ${chapterCode}`
        chapters.push(chapterDisplay)
        chapterGroupByName.set(chapterDisplay, display)
        chapterCampaignByName.set(chapterDisplay, display)
        if (box) chapterBoxByName.set(chapterDisplay, box)

        const tokens = [
          chapterDisplay,
          `${display} ${chapterCode}`,
          `${id}${chapterCode}`,
          `${id}-${chapterCode}`,
          `${id} ${chapterCode}`,
          `${display.replace(/\s+/g, '')}${chapterCode}`,
          `${display.toLowerCase().replace(/\s+/g, '')}${chapterCode}`,
          `campaign${id.replace(/^c/i, '')}${chapterCode}`,
          `c${id.replace(/^c/i, '')}${chapterCode}`,
        ]

        for (const token of tokens) {
          const normalized = normalizeId(token)
          if (!normalized) continue
          chaptersById.set(normalized, chapterDisplay)
        }
      }
    }
  }

  return {
    campaigns,
    chapters,
    guards: parsedGuards.labels,
    campaignsById,
    chaptersById,
    guardsById: parsedGuards.byId,
    campaignGroupByName,
    chapterGroupByName,
    guardGroupByName: parsedGuards.groupByLabel,
    campaignBoxByName,
    chapterBoxByName,
    guardBoxByName: parsedGuards.boxByLabel,
    chapterCampaignByName,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const isofarianGuardContent = parseIsofarianGuardContent(contentText)
