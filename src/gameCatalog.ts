export type GameDefinition = {
  id: string
  label: string
  supportsMonthlyChecklist: boolean
  supportsCostsTable: boolean
  supportsAchievements: boolean
}

export const GAME_DEFINITIONS = [
  {
    id: 'arkhamHorrorLcg',
    label: 'Arkham Horror LCG',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'bullet',
    label: 'Bullet',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'burncycle',
    label: 'burncycle',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'cloudspire',
    label: 'Cloudspire',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'deathMayDie',
    label: 'Death May Die',
    supportsMonthlyChecklist: false,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'earthborneRangers',
    label: 'Earthborne Rangers',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'deckers',
    label: 'Deckers',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'finalGirl',
    label: 'Final Girl',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'isofarianGuard',
    label: 'Isofarian Guard',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'kingdomsForlorn',
    label: 'Kingdoms Forlorn',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'mageKnight',
    label: 'Mage Knight',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'mandalorianAdventures',
    label: 'Mandalorian Adventures',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'mistfall',
    label: 'Mistfall',
    supportsMonthlyChecklist: false,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'oathsworn',
    label: 'Oathsworn',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'elderScrolls',
    label: 'Elder Scrolls',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'paleo',
    label: 'Paleo',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'robinHood',
    label: 'Robin Hood',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'robinsonCrusoe',
    label: 'Robinson Crusoe',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'skytearHorde',
    label: 'Skytear Horde',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'spiritIsland',
    label: 'Spirit Island',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'starTrekCaptainsChair',
    label: "Star Trek: Captain's Chair",
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'taintedGrail',
    label: 'Tainted Grail',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'tooManyBones',
    label: 'Too Many Bones',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
  {
    id: 'undauntedNormandy',
    label: 'Undaunted: Normandy',
    supportsMonthlyChecklist: false,
    supportsCostsTable: true,
    supportsAchievements: false,
  },
  {
    id: 'unsettled',
    label: 'Unsettled',
    supportsMonthlyChecklist: true,
    supportsCostsTable: true,
    supportsAchievements: true,
  },
] as const satisfies ReadonlyArray<GameDefinition>

export type GameTab = (typeof GAME_DEFINITIONS)[number]['id']

export type GameTabOption = {
  value: GameTab
  label: string
  group: 'games'
}

export const GAME_TAB_IDS = GAME_DEFINITIONS.map((game) => game.id) as ReadonlyArray<GameTab>

export const GAME_TAB_OPTIONS: ReadonlyArray<GameTabOption> = GAME_DEFINITIONS.map((game) => ({
  value: game.id,
  label: game.label,
  group: 'games',
}))

export function isGameTab(value: string): value is GameTab {
  return (GAME_TAB_IDS as readonly string[]).includes(value)
}

export function getGameDefinition(gameId: GameTab): (typeof GAME_DEFINITIONS)[number] {
  const match = GAME_DEFINITIONS.find((game) => game.id === gameId)
  if (!match) throw new Error(`Unknown game: ${gameId}`)
  return match
}
