import { isRecord, parseYamlValue } from '../../yaml'

export type SpiritIslandMappings = {
  spirits: SpiritIslandSpirit[]
  adversaries: SpiritIslandAdversary[]
  adversaryLevels: SpiritIslandAdversaryLevel[]
  spiritsById: Map<string, string>
  adversariesById: Map<string, string>
  adversaryLevelsById: Map<string, string>
}

export type SpiritIslandComplexity = 'Low' | 'Moderate' | 'High' | 'Very High'

export type SpiritIslandSpirit = {
  id: string
  display: string
  group: string
  complexity: SpiritIslandComplexity
  aliases?: string[]
}

export type SpiritIslandAdversary = {
  id: string
  display: string
  aliases?: string[]
}

export type SpiritIslandAdversaryLevel = {
  id: string
  display: string
  aliases?: string[]
}

function normalizeSpiritIslandId(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function pushAliases(map: Map<string, string>, display: string, aliases: string[]) {
  for (const alias of aliases) {
    const normalized = normalizeSpiritIslandId(alias)
    if (!normalized) continue
    map.set(normalized, display)
  }
}

export function parseSpiritIslandMappings(text: string): SpiritIslandMappings {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml)) {
    const spirits = Array.isArray(yaml.spirits)
      ? (yaml.spirits as unknown[])
          .map((spirit) => {
            if (!isRecord(spirit) || typeof spirit.id !== 'string') return null
            const id = spirit.id.trim()
            const display = (typeof spirit.display === 'string' ? spirit.display : spirit.id).trim()
            const group = typeof spirit.group === 'string' ? spirit.group.trim() : ''
            const complexity =
              typeof spirit.complexity === 'string' ? spirit.complexity.trim() : ''
            if (!id || !display || !group || !complexity) return null
            const aliases = Array.isArray(spirit.aliases)
              ? spirit.aliases.filter((alias): alias is string => typeof alias === 'string')
              : undefined
            return { id, display, group, complexity, ...(aliases ? { aliases } : {}) }
          })
          .filter((spirit): spirit is SpiritIslandSpirit => spirit !== null)
      : null

    const adversaries = Array.isArray(yaml.adversaries)
      ? (yaml.adversaries as unknown[])
          .map((adversary) => {
            if (!isRecord(adversary) || typeof adversary.id !== 'string') return null
            const id = adversary.id.trim()
            const display =
              (typeof adversary.display === 'string' ? adversary.display : adversary.id).trim()
            if (!id || !display) return null
            const aliases = Array.isArray(adversary.aliases)
              ? adversary.aliases.filter((alias): alias is string => typeof alias === 'string')
              : undefined
            return { id, display, ...(aliases ? { aliases } : {}) }
          })
          .filter((adversary): adversary is SpiritIslandAdversary => adversary !== null)
      : null

    const adversaryLevels = Array.isArray(yaml.adversaryLevels)
      ? (yaml.adversaryLevels as unknown[])
          .map((entry) => {
            if (!isRecord(entry) || typeof entry.id !== 'string') return null
            const id = entry.id.trim()
            const display = (typeof entry.display === 'string' ? entry.display : entry.id).trim()
            if (!id || !display) return null
            const aliases = Array.isArray(entry.aliases)
              ? entry.aliases.filter((alias): alias is string => typeof alias === 'string')
              : undefined
            return { id, display, ...(aliases ? { aliases } : {}) }
          })
          .filter((entry): entry is SpiritIslandAdversaryLevel => entry !== null)
      : null

    if (spirits && adversaries && adversaryLevels) {
      const spiritsById = new Map<string, string>()
      const adversariesById = new Map<string, string>()
      const adversaryLevelsById = new Map<string, string>()

      for (const spirit of spirits) {
        pushAliases(spiritsById, spirit.display, [spirit.id, spirit.display, ...(spirit.aliases ?? [])])
      }

      for (const adversary of adversaries) {
        pushAliases(adversariesById, adversary.display, [
          adversary.id,
          adversary.display,
          ...(adversary.aliases ?? []),
        ])
      }

      for (const level of adversaryLevels) {
        pushAliases(adversaryLevelsById, level.display, [level.id, level.display, ...(level.aliases ?? [])])
      }

      return { spirits, adversaries, adversaryLevels, spiritsById, adversariesById, adversaryLevelsById }
    }
  }

  throw new Error(
    'Failed to parse Spirit Island content (expected YAML with `spirits`, `adversaries`, and `adversaryLevels` arrays).',
  )
}

export function resolveSpiritIslandSpirit(
  token: string,
  mappings: SpiritIslandMappings,
): string | undefined {
  const normalized = normalizeSpiritIslandId(token)
  if (!normalized) return undefined
  return mappings.spiritsById.get(normalized)
}

function parseAdversaryLevelToken(
  token: string,
): { adversaryId: string; level: string } | undefined {
  const match =
    /^(?<adversary>.*?)(?:(?:\s|-|_)?(?:lvl|level|l))(?<level>\d+)\s*$/i.exec(
      token.trim(),
    )
  if (!match?.groups?.adversary || !match?.groups?.level) return undefined
  return { adversaryId: match.groups.adversary, level: match.groups.level }
}

export function resolveSpiritIslandAdversary(
  token: string,
  mappings: SpiritIslandMappings,
): { adversary: string; level?: string } | undefined {
  const normalized = normalizeSpiritIslandId(token)
  if (!normalized) return undefined

  const explicit = mappings.adversaryLevelsById.get(normalized)
  if (explicit) return { adversary: explicit }

  const parsed = parseAdversaryLevelToken(token)
  if (parsed) {
    const adversaryDisplay =
      mappings.adversariesById.get(normalizeSpiritIslandId(parsed.adversaryId)) ||
      parsed.adversaryId.trim()
    return { adversary: adversaryDisplay, level: parsed.level }
  }

  const base = mappings.adversariesById.get(normalized)
  if (base) return { adversary: base }

  return undefined
}

export function formatSpiritIslandAdversaryLabel(input: {
  adversary: string
  level?: string
}): string {
  const level = input.level?.trim()
  if (!level) return input.adversary
  return `${input.adversary} L${level}`
}
