import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'
import { parseBoxCostConfig } from '../../contentCosts'

export type TaintedGrailContent = {
  chapters: string[]
  chaptersById: Map<string, string>
  chapterGroupByName: Map<string, string>
  chapterBoxByName: Map<string, string>
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}

type TaintedGrailYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
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

function addChapterAliases(chapters: string[], chaptersById: Map<string, string>) {
  for (const chapter of chapters) {
    const match = chapter.match(/\b([0-9]+)$/)
    if (!match?.[1]) continue
    const n = match[1]
    applyAliases(chaptersById, chapter, [n, `c${n}`, `chapter${n}`, `chapter ${n}`])
  }
}

export function parseTaintedGrailContent(text: string): TaintedGrailContent {
  const yaml = parseYamlValue(text)
  if (!isRecord(yaml) || !Array.isArray(yaml.chapters)) {
    throw new Error(
      'Failed to parse Tainted Grail content (expected YAML with a `chapters` array).',
    )
  }

  const costs = parseBoxCostConfig(yaml)
  const chapters: string[] = []
  const chaptersById = new Map<string, string>()
  const chapterGroupByName = new Map<string, string>()
  const chapterBoxByName = new Map<string, string>()

  for (const item of yaml.chapters as TaintedGrailYamlItem[]) {
    if (typeof item === 'string') {
      const display = item.trim()
      if (!display) continue
      chapters.push(display)
      applyAliases(chaptersById, display, [display])
      continue
    }

    if (!isRecord(item)) continue
    const display =
      (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!display) continue

    chapters.push(display)
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
      : []
    applyAliases(chaptersById, display, [
      display,
      ...(typeof item.id === 'string' ? [item.id] : []),
      ...aliases,
    ])

    const group = (typeof item.group === 'string' ? item.group : '').trim()
    if (group) chapterGroupByName.set(display, group)

    const box = (typeof item.box === 'string' ? item.box : '').trim()
    if (box) chapterBoxByName.set(display, box)
  }

  addChapterAliases(chapters, chaptersById)

  return {
    chapters,
    chaptersById,
    chapterGroupByName,
    chapterBoxByName,
    costCurrencySymbol: costs.currencySymbol,
    boxCostsByName: costs.boxCostsByName,
  }
}

export const taintedGrailContent = parseTaintedGrailContent(contentText)
