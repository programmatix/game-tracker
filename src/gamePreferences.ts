import { createSignal } from 'solid-js'
import { GAME_DEFINITIONS, getGameDefinition, isGameTab, type GameTab } from './gameCatalog'

export const GAME_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'waitingOnShipping', label: 'Waiting on shipping' },
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

export type StoredGamePreferencesById = Partial<Record<GameTab, StoredGamePreferences>>

export type ResolvedGamePreferencesById = Record<GameTab, GamePreferences>

const [storedGamePreferencesById, setStoredGamePreferencesById] =
  createSignal<StoredGamePreferencesById>({})

export function isGameStatus(value: unknown): value is GameStatus {
  return GAME_STATUS_OPTIONS.some((option) => option.value === value)
}

export function gameStatusLabel(status: GameStatus): string {
  return GAME_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Active'
}

export function defaultGamePreferencesFor(gameId: GameTab): GamePreferences {
  const game = getGameDefinition(gameId)
  return {
    showInMonthlyChecklist: game.supportsMonthlyChecklist,
    showAsSeparateTab: true,
    showInCostsTable: game.supportsCostsTable,
    calculateAchievements: game.supportsAchievements,
    status: 'active',
  }
}

export function resolveGamePreferences(
  gameId: GameTab,
  stored: StoredGamePreferencesById = {},
): GamePreferences {
  const defaults = defaultGamePreferencesFor(gameId)
  const game = getGameDefinition(gameId)
  const raw = stored[gameId]

  return {
    showInMonthlyChecklist:
      game.supportsMonthlyChecklist && typeof raw?.showInMonthlyChecklist === 'boolean'
        ? raw.showInMonthlyChecklist
        : defaults.showInMonthlyChecklist,
    showAsSeparateTab:
      typeof raw?.showAsSeparateTab === 'boolean'
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
    GAME_DEFINITIONS.map((game) => [game.id, resolveGamePreferences(game.id, stored)]),
  ) as ResolvedGamePreferencesById
}

export function normalizeStoredGamePreferencesById(input: unknown): StoredGamePreferencesById {
  if (!input || typeof input !== 'object') return {}

  const source = input as Record<string, unknown>
  const normalized: StoredGamePreferencesById = {}

  for (const game of GAME_DEFINITIONS) {
    const raw = source[game.id]
    if (!raw || typeof raw !== 'object') continue

    const rawRecord = raw as Record<string, unknown>
    const next: StoredGamePreferences = {}

    if (typeof rawRecord.showInMonthlyChecklist === 'boolean') {
      next.showInMonthlyChecklist = rawRecord.showInMonthlyChecklist
    }
    if (typeof rawRecord.showAsSeparateTab === 'boolean') {
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

export function gamePreferencesFor(gameId: GameTab): GamePreferences {
  return resolveGamePreferences(gameId, storedGamePreferencesById())
}

export function shouldShowGameTab(gameId: GameTab): boolean {
  return gamePreferencesFor(gameId).showAsSeparateTab
}

export function shouldShowGameInMonthlyChecklist(gameId: string): boolean {
  if (!isGameTab(gameId)) return true
  return gamePreferencesFor(gameId).showInMonthlyChecklist
}

export function shouldShowGameInCostsTable(gameId: string): boolean {
  if (!isGameTab(gameId)) return true
  return gamePreferencesFor(gameId).showInCostsTable
}

export function shouldCalculateAchievementsForGame(gameId: string): boolean {
  if (!isGameTab(gameId)) return false
  return gamePreferencesFor(gameId).calculateAchievements
}
