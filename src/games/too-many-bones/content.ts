import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'

export type TooManyBonesContent = {
  difficulties: string[]
  gearlocs: string[]
  tyrants: string[]
  difficultiesById: Map<string, string>
  gearlocsById: Map<string, string>
  tyrantsById: Map<string, string>
  gearlocGroupByName: Map<string, string>
  tyrantGroupByName: Map<string, string>
}

type TooManyBonesYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      group?: string
    }

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function parseTooManyBonesContent(text: string): TooManyBonesContent {
  const yaml = parseYamlValue(text)
  if (
    isRecord(yaml) &&
    Array.isArray(yaml.difficulties) &&
    Array.isArray(yaml.gearlocs) &&
    Array.isArray(yaml.tyrants)
  ) {
    const difficulties: string[] = []
    const gearlocs: string[] = []
    const tyrants: string[] = []
    const difficultiesById = new Map<string, string>()
    const gearlocsById = new Map<string, string>()
    const tyrantsById = new Map<string, string>()
    const gearlocGroupByName = new Map<string, string>()
    const tyrantGroupByName = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (
      item: TooManyBonesYamlItem,
      list: string[],
      map: Map<string, string>,
      groupByName: Map<string, string>,
    ) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        list.push(display)
        applyAliases(map, display, [display])
        return
      }

      if (!isRecord(item)) return
      const display =
        (typeof item.display === 'string' ? item.display : typeof item.id === 'string' ? item.id : '')
          .trim()
      if (!display) return
      list.push(display)
      const group = typeof item.group === 'string' ? item.group.trim() : ''
      if (group) groupByName.set(display, group)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    for (const item of yaml.difficulties as TooManyBonesYamlItem[])
      applyItem(item, difficulties, difficultiesById, new Map<string, string>())
    for (const item of yaml.gearlocs as TooManyBonesYamlItem[])
      applyItem(item, gearlocs, gearlocsById, gearlocGroupByName)
    for (const item of yaml.tyrants as TooManyBonesYamlItem[])
      applyItem(item, tyrants, tyrantsById, tyrantGroupByName)

    return {
      difficulties,
      gearlocs,
      tyrants,
      difficultiesById,
      gearlocsById,
      tyrantsById,
      gearlocGroupByName,
      tyrantGroupByName,
    }
  }

  throw new Error(
    'Failed to parse Too Many Bones content (expected YAML with `difficulties`, `gearlocs`, and `tyrants` arrays).',
  )
}

export const tooManyBonesContent = parseTooManyBonesContent(contentText)
