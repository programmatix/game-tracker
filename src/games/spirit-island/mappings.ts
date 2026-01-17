export type SpiritIslandMappings = {
  spiritsById: Map<string, string>
  adversariesById: Map<string, string>
  adversaryLevelsById: Map<string, string>
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

export function parseSpiritIslandMappings(text: string): SpiritIslandMappings {
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

  return { spiritsById, adversariesById, adversaryLevelsById }
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

