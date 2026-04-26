import { GAME_DEFINITIONS } from './gameCatalog'
import {
  DEFAULT_CAMPAIGN_GAME_IDS,
  DEFAULT_SCENARIO_GAME_IDS,
} from './gameProgressCategories'
import { normalizePurchaseGameFamilyId, PURCHASE_GAME_FAMILIES } from './purchaseGameFamilies'

export type ConfigurableGameDefinition = {
  id: string
  label: string
  supportsMonthlyChecklist: boolean
  defaultShowInMonthlyChecklist: boolean
  supportsSeparateTab: boolean
  defaultShowAsSeparateTab: boolean
  supportsCostsTable: boolean
  supportsAchievements: boolean
  defaultIsCampaignGame: boolean
  defaultIsScenarioGame: boolean
}

const defaultCampaignGameIds = new Set<string>(DEFAULT_CAMPAIGN_GAME_IDS)
const defaultScenarioGameIds = new Set<string>(DEFAULT_SCENARIO_GAME_IDS)

const configurableGameDefinitionsFromTabs: ReadonlyArray<ConfigurableGameDefinition> =
  GAME_DEFINITIONS.map((game) => ({
    id: game.id,
    label: game.label,
    supportsMonthlyChecklist: true,
    defaultShowInMonthlyChecklist: game.supportsMonthlyChecklist,
    supportsSeparateTab: true,
    defaultShowAsSeparateTab: true,
    supportsCostsTable: game.supportsCostsTable,
    supportsAchievements: game.supportsAchievements,
    defaultIsCampaignGame: defaultCampaignGameIds.has(game.id),
    defaultIsScenarioGame: defaultScenarioGameIds.has(game.id),
  }))

const configurableTabIds = new Set(configurableGameDefinitionsFromTabs.map((game) => game.id))

const configurablePurchaseOnlyDefinitions: ReadonlyArray<ConfigurableGameDefinition> =
  PURCHASE_GAME_FAMILIES.filter((family) => !configurableTabIds.has(family.id)).map((family) => ({
    id: family.id,
    label: family.label,
    supportsMonthlyChecklist: true,
    defaultShowInMonthlyChecklist: false,
    supportsSeparateTab: true,
    defaultShowAsSeparateTab: false,
    supportsCostsTable: true,
    supportsAchievements: false,
    defaultIsCampaignGame: false,
    defaultIsScenarioGame: false,
  }))

export const CONFIGURABLE_GAME_DEFINITIONS: ReadonlyArray<ConfigurableGameDefinition> = [
  ...configurableGameDefinitionsFromTabs,
  ...configurablePurchaseOnlyDefinitions,
].sort((left, right) => left.label.localeCompare(right.label))

export const DEFAULT_CONFIGURABLE_GAME_ID = GAME_DEFINITIONS[0]?.id || null

export const CONFIGURABLE_GAME_OPTIONS: ReadonlyArray<{
  value: string
  label: string
}> = CONFIGURABLE_GAME_DEFINITIONS.map((game) => ({
  value: game.id,
  label: game.label,
}))

export const SEPARATE_TAB_GAME_DEFINITIONS: ReadonlyArray<ConfigurableGameDefinition> =
  CONFIGURABLE_GAME_DEFINITIONS.filter((game) => game.supportsSeparateTab)

export const SEPARATE_TAB_GAME_IDS: ReadonlyArray<string> = SEPARATE_TAB_GAME_DEFINITIONS.map(
  (game) => game.id,
)

export const SEPARATE_TAB_GAME_OPTIONS: ReadonlyArray<{
  value: string
  label: string
}> = SEPARATE_TAB_GAME_DEFINITIONS.map((game) => ({
  value: game.id,
  label: game.label,
}))

const configurableGameById = new Map(
  CONFIGURABLE_GAME_DEFINITIONS.map((game) => [game.id, game] as const),
)

export function isConfigurableGameId(value: string): boolean {
  return configurableGameById.has(value)
}

export function isSeparateTabGameId(value: string): boolean {
  return configurableGameById.get(value)?.supportsSeparateTab === true
}

export function normalizeConfigurableGameId(value: string): string | null {
  if (configurableGameById.has(value)) return value
  return normalizePurchaseGameFamilyId(value)
}

export function getConfigurableGameDefinition(gameId: string): ConfigurableGameDefinition {
  const match = configurableGameById.get(gameId)
  if (!match) throw new Error(`Unknown configurable game: ${gameId}`)
  return match
}
