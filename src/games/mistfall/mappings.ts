export type MistfallMappings = {
  heroesById: Map<string, string>
  questsById: Map<string, string>
  allHeroes: string[]
  allQuests: string[]
}

export function normalizeMistfallId(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

export function normalizeMistfallName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function parseDisplayAndId(raw: string): { display: string; id?: string } {
  const match = /^(?<display>.*?)(?:\s*\[(?<id>[^\]]+)\])?\s*$/i.exec(raw.trim())
  const display = (match?.groups?.display ?? raw).trim().replace(/\s+/g, ' ')
  const id = match?.groups?.id?.trim()
  return { display, id: id || undefined }
}

export function parseMistfallMappings(text: string): MistfallMappings {
  const heroesById = new Map<string, string>()
  const questsById = new Map<string, string>()
  const allHeroes: string[] = []
  const allQuests: string[] = []
  const seenHeroNames = new Set<string>()
  const seenQuestNames = new Set<string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const match = /^(?<key>H|Hero|Q|Quest)\s*:\s*(?<value>.+)$/i.exec(line)
    const key = match?.groups?.key?.toLowerCase()
    const value = match?.groups?.value ?? ''
    if (!key) continue

    const { display, id } = parseDisplayAndId(value)
    const normalizedId = normalizeMistfallId(id ?? display)
    if (!normalizedId) continue

    if (key === 'h' || key === 'hero') {
      heroesById.set(normalizedId, display)
      const normalizedName = normalizeMistfallName(display)
      if (normalizedName && !seenHeroNames.has(normalizedName)) {
        seenHeroNames.add(normalizedName)
        allHeroes.push(display)
      }
      continue
    }

    if (key === 'q' || key === 'quest') {
      questsById.set(normalizedId, display)
      const normalizedName = normalizeMistfallName(display)
      if (normalizedName && !seenQuestNames.has(normalizedName)) {
        seenQuestNames.add(normalizedName)
        allQuests.push(display)
      }
    }
  }

  return { heroesById, questsById, allHeroes, allQuests }
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

