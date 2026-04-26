import type { GameTab } from './gameCatalog'

export const DEFAULT_CAMPAIGN_GAME_IDS = [
  'arkhamHorrorLcg',
  'earthborneRangers',
  'isofarianGuard',
  'kingdomsForlorn',
  'oathsworn',
  'robinHood',
  'taintedGrail',
] as const satisfies ReadonlyArray<GameTab>

export const DEFAULT_SCENARIO_GAME_IDS = [
  'robinsonCrusoe',
  'mageKnight',
  'undauntedNormandy',
  'paleo',
] as const satisfies ReadonlyArray<GameTab>

export type DefaultCampaignGameId = (typeof DEFAULT_CAMPAIGN_GAME_IDS)[number]
export type DefaultScenarioGameId = (typeof DEFAULT_SCENARIO_GAME_IDS)[number]
