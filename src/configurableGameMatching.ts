import { GAME_DEFINITIONS } from './gameCatalog'
import { PURCHASE_GAME_FAMILIES, purchaseGameFamilyById } from './purchaseGameFamilies'

type ConfigurableGameMatchOverrides = {
  aliases?: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
  useArkhamSpecialMatcher?: boolean
}

export type ConfigurableGameMatchDefinition = {
  id: string
  label: string
  aliases: ReadonlyArray<string>
  objectIds: ReadonlyArray<string>
  useArkhamSpecialMatcher: boolean
}

function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue

    const normalized = trimmed.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(trimmed)
  }

  return result
}

export function normalizeConfigurableGameMatchName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesNormalizedAlias(normalizedName: string, normalizedAlias: string): boolean {
  if (!normalizedName || !normalizedAlias) return false
  return normalizedName === normalizedAlias || normalizedName.startsWith(`${normalizedAlias} `)
}

const MATCH_OVERRIDES: Readonly<Record<string, ConfigurableGameMatchOverrides>> = {
  arkhamHorrorLcg: {
    aliases: [
      'Arkham Horror LCG',
      'Arkham Horror: The Card Game',
      'Arkham Horror The Card Game',
      'Arkham Horror Card Game',
    ],
    objectIds: ['205637'],
    useArkhamSpecialMatcher: true,
  },
  bullet: {
    aliases: ['Bullet', 'Bullet Heart', 'Bullet Star', 'Bullet♥︎'],
  },
  burncycle: {
    aliases: ['burncycle'],
    objectIds: ['322656'],
  },
  cloudspire: {
    objectIds: ['262211'],
  },
  deathMayDie: {
    aliases: ['Death May Die', 'Cthulhu Death May Die', 'Cthulhu: Death May Die'],
  },
  earthborneRangers: {
    objectIds: ['342900'],
  },
  elderScrolls: {
    aliases: ['Elder Scrolls', 'The Elder Scrolls: Betrayal of the Second Era'],
    objectIds: ['356080'],
  },
  finalGirl: {
    objectIds: ['277659'],
  },
  isofarianGuard: {
    aliases: ['Isofarian Guard', 'The Isofarian Guard'],
    objectIds: ['281526'],
  },
  kingdomsForlorn: {
    aliases: ['Kingdoms Forlorn', 'Kingdoms Forlorn: Dragons, Devils and Kings'],
    objectIds: ['297510'],
  },
  mageKnight: {
    aliases: ['Mage Knight', 'Mage Knight Board Game', 'Mage Knight: Ultimate Edition'],
  },
  mandalorianAdventures: {
    aliases: ['Mandalorian Adventures', 'The Mandalorian: Adventures', 'The Mandalorian Adventures'],
  },
  nanolith: {
    aliases: ['Nanolith'],
    objectIds: ['338164'],
  },
  mistfall: {
    aliases: ['Mistfall', 'Mistfall: Heart of the Mists', 'Mistfall Heart of the Mists'],
  },
  oathsworn: {
    aliases: ['Oathsworn', 'Oathsworn: Into the Deepwood', 'Oathsworn Into the Deepwood'],
    objectIds: ['251661'],
  },
  paleo: {
    objectIds: ['300531'],
  },
  robinHood: {
    aliases: ['Robin Hood', 'The Adventures of Robin Hood', 'Adventures of Robin Hood'],
    objectIds: ['326494'],
  },
  robinsonCrusoe: {
    aliases: ['Robinson Crusoe', 'Robinson Crusoe: Adventures on the Cursed Island'],
    objectIds: ['121921'],
  },
  skytearHorde: {
    aliases: ['Skytear Horde', 'Sky Tear Horde'],
  },
  spiritIsland: {
    aliases: ['Spirit Island'],
  },
  starTrekCaptainsChair: {
    aliases: ["Star Trek: Captain's Chair", "Star Trek Captain's Chair"],
    objectIds: ['422541'],
  },
  taintedGrail: {
    aliases: ['Tainted Grail', 'Tainted Grail: The Fall of Avalon'],
    objectIds: ['264220'],
  },
  tooManyBones: {
    aliases: ['Too Many Bones'],
    objectIds: ['192135'],
  },
  undauntedNormandy: {
    aliases: ['Undaunted Normandy', 'Undaunted: Normandy'],
  },
  unsettled: {
    objectIds: ['290484'],
  },
}

const allConfigurableGameIds = uniqueStrings([
  ...GAME_DEFINITIONS.map((game) => game.id),
  ...PURCHASE_GAME_FAMILIES.map((family) => family.id),
])

export const CONFIGURABLE_GAME_MATCH_DEFINITIONS: ReadonlyArray<ConfigurableGameMatchDefinition> =
  allConfigurableGameIds.map((gameId) => {
    const game = GAME_DEFINITIONS.find((entry) => entry.id === gameId)
    const family = purchaseGameFamilyById.get(gameId)
    const overrides = MATCH_OVERRIDES[gameId]
    const label = family?.label || game?.label || gameId

    return {
      id: gameId,
      label,
      aliases: uniqueStrings([
        label,
        family?.spreadsheetFamily || '',
        ...(family?.aliases || []),
        ...(overrides?.aliases || []),
      ]),
      objectIds: uniqueStrings(overrides?.objectIds || []),
      useArkhamSpecialMatcher: overrides?.useArkhamSpecialMatcher === true,
    }
  }).sort((left, right) => left.label.localeCompare(right.label))

const configurableGameMatchById = new Map(
  CONFIGURABLE_GAME_MATCH_DEFINITIONS.map((game) => [game.id, game] as const),
)

const gameIdByName = new Map<string, string>()
const gameIdByObjectId = new Map<string, string>()

for (const game of CONFIGURABLE_GAME_MATCH_DEFINITIONS) {
  for (const alias of game.aliases) {
    const normalized = normalizeConfigurableGameMatchName(alias)
    if (!normalized || gameIdByName.has(normalized)) continue
    gameIdByName.set(normalized, game.id)
  }

  for (const objectId of game.objectIds) {
    const normalized = objectId.trim()
    if (!normalized || gameIdByObjectId.has(normalized)) continue
    gameIdByObjectId.set(normalized, game.id)
  }
}

export function getConfigurableGameMatchDefinition(
  gameId: string,
): ConfigurableGameMatchDefinition | null {
  return configurableGameMatchById.get(gameId) || null
}

export function findConfigurableGameIdForOptions(input: {
  gameId?: string | null
  name?: string | null
  objectId?: string | null
}): string | null {
  if (input.gameId && configurableGameMatchById.has(input.gameId)) return input.gameId

  const normalizedObjectId = input.objectId?.trim()
  if (normalizedObjectId) {
    const matchedByObjectId = gameIdByObjectId.get(normalizedObjectId)
    if (matchedByObjectId) return matchedByObjectId
  }

  const normalizedName = normalizeConfigurableGameMatchName(input.name || '')
  if (!normalizedName) return null
  const matchedByName = gameIdByName.get(normalizedName)
  if (matchedByName) return matchedByName

  let bestPrefixMatch: { gameId: string; aliasLength: number } | null = null

  for (const game of CONFIGURABLE_GAME_MATCH_DEFINITIONS) {
    for (const alias of game.aliases) {
      const normalizedAlias = normalizeConfigurableGameMatchName(alias)
      if (!matchesNormalizedAlias(normalizedName, normalizedAlias)) continue

      if (!bestPrefixMatch || normalizedAlias.length > bestPrefixMatch.aliasLength) {
        bestPrefixMatch = { gameId: game.id, aliasLength: normalizedAlias.length }
      }
    }
  }

  return bestPrefixMatch?.gameId || null
}
