import { createSignal } from 'solid-js'
import { isGameTab } from './gameCatalog'
import {
  CONFIGURABLE_GAME_DEFINITIONS,
  getConfigurableGameDefinition,
  isConfigurableGameId,
  normalizeConfigurableGameId,
} from './configurableGames'

export const GAME_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'waitingOnShipping', label: 'Waiting on shipping' },
  { value: 'returned', label: 'Returned' },
  { value: 'selling', label: 'Selling' },
  { value: 'sold', label: 'Sold' },
] as const

export type GameStatus = (typeof GAME_STATUS_OPTIONS)[number]['value']

export type GamePreferences = {
  showInMonthlyChecklist: boolean
  showAsSeparateTab: boolean
  showInCostsTable: boolean
  calculateAchievements: boolean
  status: GameStatus
}

export type StoredGamePreferences = Partial<GamePreferences>

export type StoredGamePreferencesById = Partial<Record<string, StoredGamePreferences>>

export type ResolvedGamePreferencesById = Record<string, GamePreferences>

const [storedGamePreferencesById, setStoredGamePreferencesById] =
  createSignal<StoredGamePreferencesById>({})

export function isGameStatus(value: unknown): value is GameStatus {
  return GAME_STATUS_OPTIONS.some((option) => option.value === value)
}

export function gameStatusLabel(status: GameStatus): string {
  return GAME_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Active'
}

export function defaultGamePreferencesFor(gameId: string): GamePreferences {
  const game = getConfigurableGameDefinition(gameId)
  return {
    showInMonthlyChecklist: game.defaultShowInMonthlyChecklist,
    showAsSeparateTab: game.defaultShowAsSeparateTab,
    showInCostsTable: game.supportsCostsTable,
    calculateAchievements: game.supportsAchievements,
    status: 'active',
  }
}

export function resolveGamePreferences(
  gameId: string,
  stored: StoredGamePreferencesById = {},
): GamePreferences {
  const defaults = defaultGamePreferencesFor(gameId)
  const game = getConfigurableGameDefinition(gameId)
  const raw = stored[gameId]

  return {
    showInMonthlyChecklist:
      game.supportsMonthlyChecklist && typeof raw?.showInMonthlyChecklist === 'boolean'
        ? raw.showInMonthlyChecklist
        : defaults.showInMonthlyChecklist,
    showAsSeparateTab:
      game.supportsSeparateTab && typeof raw?.showAsSeparateTab === 'boolean'
        ? raw.showAsSeparateTab
        : defaults.showAsSeparateTab,
    showInCostsTable:
      game.supportsCostsTable && typeof raw?.showInCostsTable === 'boolean'
        ? raw.showInCostsTable
        : defaults.showInCostsTable,
    calculateAchievements:
      game.supportsAchievements && typeof raw?.calculateAchievements === 'boolean'
        ? raw.calculateAchievements
        : defaults.calculateAchievements,
    status: isGameStatus(raw?.status) ? raw.status : defaults.status,
  }
}

export function buildResolvedGamePreferencesById(
  stored: StoredGamePreferencesById = {},
): ResolvedGamePreferencesById {
  return Object.fromEntries(
    CONFIGURABLE_GAME_DEFINITIONS.map((game) => [game.id, resolveGamePreferences(game.id, stored)]),
  ) as ResolvedGamePreferencesById
}

export function normalizeStoredGamePreferencesById(input: unknown): StoredGamePreferencesById {
  if (!input || typeof input !== 'object') return {}

  const source = input as Record<string, unknown>
  const normalized: StoredGamePreferencesById = {}

  for (const [rawGameId, raw] of Object.entries(source)) {
    const gameId = normalizeConfigurableGameId(rawGameId)
    if (!gameId) continue
    const game = getConfigurableGameDefinition(gameId)
    if (!raw || typeof raw !== 'object') continue

    const rawRecord = raw as Record<string, unknown>
    const next: StoredGamePreferences = { ...(normalized[game.id] || {}) }

    if (typeof rawRecord.showInMonthlyChecklist === 'boolean') {
      next.showInMonthlyChecklist = rawRecord.showInMonthlyChecklist
    }
    if (game.supportsSeparateTab && typeof rawRecord.showAsSeparateTab === 'boolean') {
      next.showAsSeparateTab = rawRecord.showAsSeparateTab
    }
    if (typeof rawRecord.showInCostsTable === 'boolean') {
      next.showInCostsTable = rawRecord.showInCostsTable
    }
    if (typeof rawRecord.calculateAchievements === 'boolean') {
      next.calculateAchievements = rawRecord.calculateAchievements
    }
    if (isGameStatus(rawRecord.status)) {
      next.status = rawRecord.status
    }

    if (Object.keys(next).length > 0) normalized[game.id] = next
  }

  return normalized
}

export function gamePreferencesStore() {
  return storedGamePreferencesById()
}

export function setGamePreferencesStore(next: StoredGamePreferencesById) {
  setStoredGamePreferencesById(normalizeStoredGamePreferencesById(next))
}

export function gamePreferencesFor(gameId: string): GamePreferences {
  return resolveGamePreferences(gameId, storedGamePreferencesById())
}

export function shouldShowGameTab(gameId: string): boolean {
  if (!isConfigurableGameId(gameId)) return false
  return gamePreferencesFor(gameId).showAsSeparateTab
}

export function shouldShowGameInMonthlyChecklist(gameId: string): boolean {
  if (!isConfigurableGameId(gameId)) return true
  return gamePreferencesFor(gameId).showInMonthlyChecklist
}

export function shouldShowGameInCostsTable(gameId: string): boolean {
  if (!isConfigurableGameId(gameId)) return true
  return gamePreferencesFor(gameId).showInCostsTable
}

export function shouldCalculateAchievementsForGame(gameId: string): boolean {
  if (!isGameTab(gameId)) return false
  return gamePreferencesFor(gameId).calculateAchievements
}
