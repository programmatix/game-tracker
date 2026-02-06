import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'

export type BulletContent = {
  heroines: string[]
  bosses: string[]
  heroinesById: Map<string, string>
  bossesById: Map<string, string>
}

type BulletYamlItem =
  | string
  | {
      display: string
      id?: string
      aliases?: string[]
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

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (item: BulletYamlItem, list: string[], map: Map<string, string>) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        list.push(display)
        applyAliases(map, display, [display])
        return
      }

      if (!isRecord(item) || typeof item.display !== 'string') return
      const display = item.display.trim()
      if (!display) return
      list.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    for (const item of yaml.heroines as BulletYamlItem[]) applyItem(item, heroines, heroinesById)
    for (const item of yaml.bosses as BulletYamlItem[]) applyItem(item, bosses, bossesById)

    return { heroines, bosses, heroinesById, bossesById }
  }

  throw new Error(
    'Failed to parse Bullet content (expected YAML with `heroines` and `bosses` arrays).',
  )
}

export const bulletContent = parseBulletContent(contentText)
