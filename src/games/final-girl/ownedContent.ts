export type OwnedFinalGirlContent = {
  ownedVillains: Map<string, string>
  ownedLocations: Map<string, string>
  ownedFinalGirls: Map<string, string>
  finalGirlLocationsByName: Map<string, string>
  locationBoxesByName: Map<string, string>
  villainsById: Map<string, { display: string; location?: string }>
  locationsById: Map<string, string>
  finalGirlsById: Map<string, string>
}

export function normalizeFinalGirlName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeFinalGirlId(value: string): string {
  return value.trim().toLowerCase()
}

function parseDisplayAndId(raw: string): { display: string; id?: string } {
  const match = /^(?<display>.*?)(?:\s*\[(?<id>[^\]]+)\])?\s*$/i.exec(raw.trim())
  const display = (match?.groups?.display ?? raw).trim().replace(/\s+/g, ' ')
  const id = match?.groups?.id?.trim()
  return { display, id: id || undefined }
}

export function parseOwnedFinalGirlContent(text: string): OwnedFinalGirlContent {
  const ownedVillains = new Map<string, string>()
  const ownedLocations = new Map<string, string>()
  const ownedFinalGirls = new Map<string, string>()
  const finalGirlLocationsByName = new Map<string, string>()
  const locationBoxesByName = new Map<string, string>()
  const villainsById = new Map<string, { display: string; location?: string }>()
  const locationsById = new Map<string, string>()
  const finalGirlsById = new Map<string, string>()

  let lastLocationDisplay: string | undefined

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const match =
      /^(?<key>V|Villain|L|Location|FG|Final Girl|FinalGirl|B|Box|Game Box|GameBox)\s*:\s*(?<value>.+)$/i.exec(
        line,
      )
    const key = match?.groups?.key?.toLowerCase()
    const value = match?.groups?.value ?? ''
    if (!key) continue

    const { display, id } = parseDisplayAndId(value)
    const normalized = normalizeFinalGirlName(display)
    if (!normalized) continue

    if (key === 'v' || key === 'villain') {
      ownedVillains.set(normalized, display)
      const normalizedId = normalizeFinalGirlId(id ?? display)
      villainsById.set(normalizedId, { display, location: lastLocationDisplay })
    }

    if (key === 'l' || key === 'location') {
      ownedLocations.set(normalized, display)
      lastLocationDisplay = display
      const normalizedId = normalizeFinalGirlId(id ?? display)
      locationsById.set(normalizedId, display)
    }

    if (
      key === 'b' ||
      key === 'box' ||
      key === 'game box' ||
      key === 'gamebox'
    ) {
      if (!lastLocationDisplay) continue
      locationBoxesByName.set(normalizeFinalGirlName(lastLocationDisplay), display)
    }

    if (key === 'fg' || key === 'final girl' || key === 'finalgirl') {
      ownedFinalGirls.set(normalized, display)
      if (lastLocationDisplay) finalGirlLocationsByName.set(normalized, lastLocationDisplay)
      const normalizedId = normalizeFinalGirlId(id ?? display)
      finalGirlsById.set(normalizedId, display)
    }
  }

  return {
    ownedVillains,
    ownedLocations,
    ownedFinalGirls,
    finalGirlLocationsByName,
    locationBoxesByName,
    villainsById,
    locationsById,
    finalGirlsById,
  }
}

export function isOwnedFinalGirlVillain(content: OwnedFinalGirlContent, villain: string): boolean {
  if (content.ownedVillains.size === 0) return true
  return content.ownedVillains.has(normalizeFinalGirlName(villain))
}

export function isOwnedFinalGirlLocation(
  content: OwnedFinalGirlContent,
  location: string,
): boolean {
  if (content.ownedLocations.size === 0) return true
  return content.ownedLocations.has(normalizeFinalGirlName(location))
}

export function getOwnedFinalGirlVillains(content: OwnedFinalGirlContent): string[] {
  return [...content.ownedVillains.values()]
}

export function getOwnedFinalGirlLocations(content: OwnedFinalGirlContent): string[] {
  return [...content.ownedLocations.values()]
}

export function getOwnedFinalGirlFinalGirls(content: OwnedFinalGirlContent): string[] {
  return [...content.ownedFinalGirls.values()]
}

export function resolveFinalGirlBgStatsTags(
  tags: string[],
  content: OwnedFinalGirlContent,
): { villain?: string; location?: string; finalGirl?: string } {
  let location: string | undefined
  const villains: string[] = []
  const finalGirls: string[] = []

  for (const rawTag of tags) {
    const tag = rawTag.trim()
    if (!tag) continue

    const normalizedId = normalizeFinalGirlId(tag)

    const villainInfo = content.villainsById.get(normalizedId)
    if (villainInfo) {
      villains.push(villainInfo.display)
      location ||= villainInfo.location
      continue
    }

    const locationDisplay = content.locationsById.get(normalizedId)
    if (locationDisplay) {
      location = locationDisplay
      continue
    }

    const finalGirlDisplay = content.finalGirlsById.get(normalizedId)
    if (finalGirlDisplay) {
      finalGirls.push(finalGirlDisplay)
      continue
    }

    finalGirls.push(tag)
  }

  const villain =
    villains.length > 0 ? [...new Set(villains)].sort().join(' + ') : undefined
  const finalGirl =
    finalGirls.length > 0 ? [...new Set(finalGirls)].sort().join(' + ') : undefined
  return { villain, location, finalGirl }
}
