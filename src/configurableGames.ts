import { GAME_DEFINITIONS } from './gameCatalog'
import { normalizePurchaseGameFamilyId, PURCHASE_GAME_FAMILIES } from './purchaseGameFamilies'

export type ConfigurableGameDefinition = {
  id: string
  label: string
  supportsMonthlyChecklist: boolean
  defaultShowInMonthlyChecklist: boolean
  supportsSeparateTab: boolean
  supportsCostsTable: boolean
  supportsAchievements: boolean
}

const configurableGameDefinitionsFromTabs: ReadonlyArray<ConfigurableGameDefinition> =
  GAME_DEFINITIONS.map((game) => ({
    id: game.id,
    label: game.label,
    supportsMonthlyChecklist: true,
    defaultShowInMonthlyChecklist: game.supportsMonthlyChecklist,
    supportsSeparateTab: true,
    supportsCostsTable: game.supportsCostsTable,
    supportsAchievements: game.supportsAchievements,
  }))

const configurableTabIds = new Set(configurableGameDefinitionsFromTabs.map((game) => game.id))

const configurablePurchaseOnlyDefinitions: ReadonlyArray<ConfigurableGameDefinition> =
  PURCHASE_GAME_FAMILIES.filter((family) => !configurableTabIds.has(family.id)).map((family) => ({
    id: family.id,
    label: family.label,
    supportsMonthlyChecklist: true,
    defaultShowInMonthlyChecklist: false,
    supportsSeparateTab: false,
    supportsCostsTable: true,
    supportsAchievements: false,
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

const configurableGameById = new Map(
  CONFIGURABLE_GAME_DEFINITIONS.map((game) => [game.id, game] as const),
)

export function isConfigurableGameId(value: string): boolean {
  return configurableGameById.has(value)
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
