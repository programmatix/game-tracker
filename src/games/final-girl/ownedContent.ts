import { isRecord, parseYamlValue } from '../../yaml'

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

type FinalGirlYamlItem =
  | string
  | {
      display: string
      id?: string
      aliases?: string[]
    }

type FinalGirlYamlSet = {
  box?: string
  location?: FinalGirlYamlItem
  villains?: FinalGirlYamlItem[]
  finalGirls?: FinalGirlYamlItem[]
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

  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.sets)) {
    const applyAliases = <T>(
      map: Map<string, T>,
      normalizer: (value: string) => string,
      value: T,
      tokens: string[],
    ) => {
      for (const token of tokens) {
        const normalized = normalizer(token)
        if (!normalized) continue
        map.set(normalized, value)
      }
    }

    const coerceItem = (item: unknown): { display: string; id?: string; aliases: string[] } | null => {
      if (typeof item === 'string') {
        const display = item.trim().replace(/\s+/g, ' ')
        if (!display) return null
        return { display, aliases: [] }
      }

      if (!isRecord(item) || typeof item.display !== 'string') return null
      const display = item.display.trim().replace(/\s+/g, ' ')
      if (!display) return null
      const id = typeof item.id === 'string' ? item.id.trim() : undefined
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string').map((a) => a.trim()).filter(Boolean)
        : []
      return { display, id: id || undefined, aliases }
    }

    for (const rawSet of yaml.sets as unknown[]) {
      if (!isRecord(rawSet)) continue
      const set = rawSet as FinalGirlYamlSet

      const box = typeof set.box === 'string' ? set.box.trim() : undefined

      const locationItem = coerceItem(set.location)
      const location = locationItem?.display

      if (location) {
        const normalized = normalizeFinalGirlName(location)
        ownedLocations.set(normalized, location)
        applyAliases(
          locationsById,
          normalizeFinalGirlId,
          location,
          [location, ...(locationItem?.id ? [locationItem.id] : []), ...(locationItem?.aliases ?? [])],
        )
        if (box) locationBoxesByName.set(normalizeFinalGirlName(location), box)
      }

      const villains = Array.isArray(set.villains) ? set.villains : []
      for (const rawVillain of villains) {
        const villainItem = coerceItem(rawVillain)
        if (!villainItem) continue
        ownedVillains.set(normalizeFinalGirlName(villainItem.display), villainItem.display)
        applyAliases(
          villainsById,
          normalizeFinalGirlId,
          { display: villainItem.display, location },
          [villainItem.display, ...(villainItem.id ? [villainItem.id] : []), ...villainItem.aliases],
        )
      }

      const finalGirls = Array.isArray(set.finalGirls) ? set.finalGirls : []
      for (const rawFinalGirl of finalGirls) {
        const finalGirlItem = coerceItem(rawFinalGirl)
        if (!finalGirlItem) continue
        ownedFinalGirls.set(normalizeFinalGirlName(finalGirlItem.display), finalGirlItem.display)
        if (location) finalGirlLocationsByName.set(normalizeFinalGirlName(finalGirlItem.display), location)
        applyAliases(
          finalGirlsById,
          normalizeFinalGirlId,
          finalGirlItem.display,
          [finalGirlItem.display, ...(finalGirlItem.id ? [finalGirlItem.id] : []), ...finalGirlItem.aliases],
        )
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

	  throw new Error('Failed to parse Final Girl content (expected YAML with a `sets` array).')
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
