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

function parseDisplayAndId(raw: string): { display: string; id?: string } {
  const match = /^(?<display>.*?)(?:\s*\[(?<id>[^\]]+)\])?\s*$/i.exec(raw.trim())
  const display = (match?.groups?.display ?? raw).trim().replace(/\s+/g, ' ')
  const id = match?.groups?.id?.trim()
  return { display, id: id || undefined }
}

type SpiritIslandMappingsJson = {
  spirits?: SpiritIslandSpirit[]
  adversaries?: SpiritIslandAdversary[]
  adversaryLevels?: SpiritIslandAdversaryLevel[]
}

function parseSpiritIslandMappingsJson(text: string): SpiritIslandMappingsJson | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as SpiritIslandMappingsJson
  } catch {
    return null
  }
}

function pushAliases(map: Map<string, string>, display: string, aliases: string[]) {
  for (const alias of aliases) {
    const normalized = normalizeSpiritIslandId(alias)
    if (!normalized) continue
    map.set(normalized, display)
  }
}

export function parseSpiritIslandMappings(text: string): SpiritIslandMappings {
  const json = parseSpiritIslandMappingsJson(text)
  if (json) {
    const spirits = (json.spirits ?? []).filter(
      (spirit): spirit is SpiritIslandSpirit =>
        Boolean(
          spirit &&
            typeof spirit === 'object' &&
            typeof spirit.id === 'string' &&
            typeof spirit.display === 'string' &&
            typeof spirit.group === 'string' &&
            typeof spirit.complexity === 'string',
        ),
    )

    const adversaries = (json.adversaries ?? []).filter(
      (adversary): adversary is SpiritIslandAdversary =>
        Boolean(
          adversary &&
            typeof adversary === 'object' &&
            typeof adversary.id === 'string' &&
            typeof adversary.display === 'string',
        ),
    )

    const adversaryLevels = (json.adversaryLevels ?? []).filter(
      (entry): entry is SpiritIslandAdversaryLevel =>
        Boolean(entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.display === 'string'),
    )

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

  const spiritsById = new Map<string, string>()
  const adversariesById = new Map<string, string>()
  const adversaryLevelsById = new Map<string, string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const match =
      /^(?<key>S|Spirit|A|Adv|Adversary|AL|AdversaryLevel)\s*:\s*(?<value>.+)$/i.exec(
        line,
      )
    const key = match?.groups?.key?.toLowerCase()
    const value = match?.groups?.value ?? ''
    if (!key) continue

    const { display, id } = parseDisplayAndId(value)
    const normalizedId = normalizeSpiritIslandId(id ?? display)
    if (!normalizedId) continue

    if (key === 's' || key === 'spirit') spiritsById.set(normalizedId, display)
    if (key === 'a' || key === 'adv' || key === 'adversary')
      adversariesById.set(normalizedId, display)
    if (key === 'al' || key === 'adversarylevel')
      adversaryLevelsById.set(normalizedId, display)
  }

  return {
    spirits: [],
    adversaries: [],
    adversaryLevels: [],
    spiritsById,
    adversariesById,
    adversaryLevelsById,
  }
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
