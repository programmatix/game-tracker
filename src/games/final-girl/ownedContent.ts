export type OwnedFinalGirlContent = {
  ownedVillains: Map<string, string>
  ownedLocations: Map<string, string>
}

export function normalizeFinalGirlName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function parseOwnedFinalGirlContent(text: string): OwnedFinalGirlContent {
  const ownedVillains = new Map<string, string>()
  const ownedLocations = new Map<string, string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const match = /^(?<key>V|Villain|L|Location)\s*:\s*(?<value>.+)$/i.exec(line)
    const key = match?.groups?.key?.toLowerCase()
    const value = match?.groups?.value ?? ''
    if (!key) continue

    const display = value.trim().replace(/\s+/g, ' ')
    const normalized = normalizeFinalGirlName(display)
    if (!normalized) continue

    if (key === 'v' || key === 'villain') ownedVillains.set(normalized, display)
    if (key === 'l' || key === 'location') ownedLocations.set(normalized, display)
  }

  return { ownedVillains, ownedLocations }
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
