import { isGameTab, type GameTab } from './gameCatalog'

type GameOptionsMatcher = {
  gameId: GameTab
  names: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
}

function normalizeGameName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const GAME_OPTIONS_MATCHERS: ReadonlyArray<GameOptionsMatcher> = [
  {
    gameId: 'arkhamHorrorLcg',
    names: [
      'Arkham Horror LCG',
      'Arkham Horror: The Card Game',
      'Arkham Horror The Card Game',
      'Arkham Horror Card Game',
    ],
    objectIds: ['205637'],
  },
  {
    gameId: 'bullet',
    names: ['Bullet', 'Bullet Heart', 'Bullet Star', 'Bullet♥︎'],
  },
  {
    gameId: 'burncycle',
    names: ['burncycle'],
    objectIds: ['322656'],
  },
  {
    gameId: 'cloudspire',
    names: ['Cloudspire'],
    objectIds: ['262211'],
  },
  {
    gameId: 'deathMayDie',
    names: ['Death May Die', 'Cthulhu Death May Die', 'Cthulhu: Death May Die'],
  },
  {
    gameId: 'deckers',
    names: ['Deckers'],
  },
  {
    gameId: 'earthborneRangers',
    names: ['Earthborne Rangers'],
    objectIds: ['342900'],
  },
  {
    gameId: 'elderScrolls',
    names: ['Elder Scrolls', 'The Elder Scrolls: Betrayal of the Second Era'],
    objectIds: ['356080'],
  },
  {
    gameId: 'finalGirl',
    names: ['Final Girl'],
    objectIds: ['277659'],
  },
  {
    gameId: 'isofarianGuard',
    names: ['Isofarian Guard', 'The Isofarian Guard'],
    objectIds: ['281526'],
  },
  {
    gameId: 'kingdomsForlorn',
    names: ['Kingdoms Forlorn', 'Kingdoms Forlorn: Dragons, Devils and Kings'],
    objectIds: ['297510'],
  },
  {
    gameId: 'mageKnight',
    names: ['Mage Knight', 'Mage Knight Board Game', 'Mage Knight: Ultimate Edition'],
  },
  {
    gameId: 'mandalorianAdventures',
    names: ['Mandalorian Adventures', 'The Mandalorian: Adventures', 'The Mandalorian Adventures'],
  },
  {
    gameId: 'mistfall',
    names: ['Mistfall', 'Mistfall: Heart of the Mists', 'Mistfall Heart of the Mists'],
  },
  {
    gameId: 'oathsworn',
    names: ['Oathsworn', 'Oathsworn: Into the Deepwood', 'Oathsworn Into the Deepwood'],
    objectIds: ['251661'],
  },
  {
    gameId: 'paleo',
    names: ['Paleo'],
    objectIds: ['300531'],
  },
  {
    gameId: 'robinHood',
    names: ['Robin Hood', 'The Adventures of Robin Hood', 'Adventures of Robin Hood'],
    objectIds: ['326494'],
  },
  {
    gameId: 'robinsonCrusoe',
    names: ['Robinson Crusoe', 'Robinson Crusoe: Adventures on the Cursed Island'],
    objectIds: ['121921'],
  },
  {
    gameId: 'skytearHorde',
    names: ['Skytear Horde', 'Sky Tear Horde'],
  },
  {
    gameId: 'spiritIsland',
    names: ['Spirit Island'],
  },
  {
    gameId: 'starTrekCaptainsChair',
    names: ["Star Trek: Captain's Chair", "Star Trek Captain's Chair"],
    objectIds: ['422541'],
  },
  {
    gameId: 'taintedGrail',
    names: ['Tainted Grail', 'Tainted Grail: The Fall of Avalon'],
    objectIds: ['264220'],
  },
  {
    gameId: 'tooManyBones',
    names: ['Too Many Bones'],
    objectIds: ['192135'],
  },
  {
    gameId: 'undauntedNormandy',
    names: ['Undaunted Normandy', 'Undaunted: Normandy'],
  },
  {
    gameId: 'unsettled',
    names: ['Unsettled'],
    objectIds: ['290484'],
  },
]

const gameIdByName = new Map<string, GameTab>()
const gameIdByObjectId = new Map<string, GameTab>()

for (const matcher of GAME_OPTIONS_MATCHERS) {
  for (const name of matcher.names) {
    const normalized = normalizeGameName(name)
    if (!normalized || gameIdByName.has(normalized)) continue
    gameIdByName.set(normalized, matcher.gameId)
  }

  for (const objectId of matcher.objectIds || []) {
    const normalized = objectId.trim()
    if (!normalized || gameIdByObjectId.has(normalized)) continue
    gameIdByObjectId.set(normalized, matcher.gameId)
  }
}

export function findGameTabForOptions(input: {
  gameId?: string | null
  name?: string | null
  objectId?: string | null
}): GameTab | null {
  if (input.gameId && isGameTab(input.gameId)) return input.gameId

  const normalizedObjectId = input.objectId?.trim()
  if (normalizedObjectId) {
    const matchedByObjectId = gameIdByObjectId.get(normalizedObjectId)
    if (matchedByObjectId) return matchedByObjectId
  }

  const normalizedName = normalizeGameName(input.name || '')
  if (!normalizedName) return null
  return gameIdByName.get(normalizedName) || null
}
