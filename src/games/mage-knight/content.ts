import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'

export type MageKnightContent = {
  heroes: string[]
  heroesById: Map<string, string>
}

type MageKnightYamlItem =
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

export function parseMageKnightContent(text: string): MageKnightContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.heroes)) {
    const heroes: string[] = []
    const heroesById = new Map<string, string>()

    const applyAliases = (display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        heroesById.set(normalized, display)
      }
    }

    const applyItem = (item: MageKnightYamlItem) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        heroes.push(display)
        applyAliases(display, [display])
        return
      }

      if (!isRecord(item) || typeof item.display !== 'string') return
      const display = item.display.trim()
      if (!display) return

      heroes.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []

      applyAliases(display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    for (const item of yaml.heroes as MageKnightYamlItem[]) applyItem(item)

    return { heroes, heroesById }
  }

  throw new Error('Failed to parse Mage Knight content (expected YAML with a `heroes` array).')
}

export const mageKnightContent = parseMageKnightContent(contentText)
