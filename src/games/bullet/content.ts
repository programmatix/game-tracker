import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'

export type BulletContent = {
  heroines: string[]
  bosses: string[]
  heroinesById: Map<string, string>
  bossesById: Map<string, string>
  heroineSetByName: Map<string, string>
  bossSetByName: Map<string, string>
}

type BulletYamlItem =
  | string
  | {
      display?: string
      id?: string
      aliases?: string[]
      set?: string
    }

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function parseBulletContent(text: string): BulletContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.heroines) && Array.isArray(yaml.bosses)) {
    const heroines: string[] = []
    const bosses: string[] = []
    const heroinesById = new Map<string, string>()
    const bossesById = new Map<string, string>()
    const heroineSetByName = new Map<string, string>()
    const bossSetByName = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (
      item: BulletYamlItem,
      list: string[],
      map: Map<string, string>,
      setByName: Map<string, string>,
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
      const set = typeof item.set === 'string' ? item.set.trim() : ''
      if (set) setByName.set(display, set)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    for (const item of yaml.heroines as BulletYamlItem[])
      applyItem(item, heroines, heroinesById, heroineSetByName)
    for (const item of yaml.bosses as BulletYamlItem[])
      applyItem(item, bosses, bossesById, bossSetByName)

    return { heroines, bosses, heroinesById, bossesById, heroineSetByName, bossSetByName }
  }

  throw new Error(
    'Failed to parse Bullet content (expected YAML with `heroines` and `bosses` arrays).',
  )
}

export const bulletContent = parseBulletContent(contentText)
