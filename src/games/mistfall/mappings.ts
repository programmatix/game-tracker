import { isRecord, parseYamlValue } from '../../yaml'

export type MistfallMappings = {
  heroesById: Map<string, string>
  questsById: Map<string, string>
  allHeroes: string[]
  allQuests: string[]
  heroGroupByName: Map<string, string>
  questGroupByName: Map<string, string>
}

export function normalizeMistfallId(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

export function normalizeMistfallName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

type MistfallYamlItem =
  | string
  | {
      display: string
      id?: string
      aliases?: string[]
      group?: string
    }

export function parseMistfallMappings(text: string): MistfallMappings {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.heroes) && Array.isArray(yaml.quests)) {
    const heroesById = new Map<string, string>()
    const questsById = new Map<string, string>()
    const allHeroes: string[] = []
    const allQuests: string[] = []
    const heroGroupByName = new Map<string, string>()
    const questGroupByName = new Map<string, string>()
    const seenHeroNames = new Set<string>()
    const seenQuestNames = new Set<string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeMistfallId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (
      item: MistfallYamlItem,
      map: Map<string, string>,
      list: string[],
      seen: Set<string>,
      groupByName: Map<string, string>,
    ) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        applyAliases(map, display, [display])
        const normalizedName = normalizeMistfallName(display)
        if (normalizedName && !seen.has(normalizedName)) {
          seen.add(normalizedName)
          list.push(display)
        }
        return
      }

      if (!isRecord(item) || typeof item.display !== 'string') return
      const display = item.display.trim()
      if (!display) return
      const group = typeof item.group === 'string' ? item.group.trim() : ''
      if (group) groupByName.set(display, group)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
      const normalizedName = normalizeMistfallName(display)
      if (normalizedName && !seen.has(normalizedName)) {
        seen.add(normalizedName)
        list.push(display)
      }
    }

    for (const item of yaml.heroes as MistfallYamlItem[]) {
      applyItem(item, heroesById, allHeroes, seenHeroNames, heroGroupByName)
    }
    for (const item of yaml.quests as MistfallYamlItem[]) {
      applyItem(item, questsById, allQuests, seenQuestNames, questGroupByName)
    }

    return {
      heroesById,
      questsById,
      allHeroes,
      allQuests,
      heroGroupByName,
      questGroupByName,
    }
  }

  throw new Error(
    'Failed to parse Mistfall content (expected YAML with `heroes` and `quests` arrays).',
  )
}

export function resolveMistfallHero(
  token: string,
  mappings: MistfallMappings,
): string | undefined {
  const normalized = normalizeMistfallId(token)
  if (!normalized) return undefined
  return mappings.heroesById.get(normalized)
}

export function resolveMistfallQuest(
  token: string,
  mappings: MistfallMappings,
): string | undefined {
  const normalized = normalizeMistfallId(token)
  if (!normalized) return undefined
  return mappings.questsById.get(normalized)
}
