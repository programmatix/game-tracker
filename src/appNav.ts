import type { GameTab } from './gameCatalog'
import {
  SEPARATE_TAB_GAME_IDS,
  SEPARATE_TAB_GAME_OPTIONS,
  isSeparateTabGameId,
  normalizeConfigurableGameId,
} from './configurableGames'

export type MainTab =
  | GameTab
  | 'monthlyChecklist'
  | 'monthlySummary'
  | 'fulfilment'
  | 'options'
  | 'gameOptions'
  | 'achievements'
  | 'pinned'
  | 'costs'
  | 'time'
  | 'feedback'
  | 'plays'

export type PlaysView = 'plays' | 'byGame' | 'gameDetail' | 'drilldown'

export type AppNavState = {
  mainTab: MainTab
  playsView: PlaysView
  selectedGameKey: string | null
  selectedOptionsGameId: string | null
  selectedMonthKey: string | null
}

export type MainTabGroup = 'games' | 'other'
export type MainTabOption = { value: MainTab; label: string; group: MainTabGroup }

export const MAIN_TABS: ReadonlyArray<MainTab> = [
  'monthlyChecklist',
  'monthlySummary',
  'fulfilment',
  ...SEPARATE_TAB_GAME_IDS.map((gameId) => gameId as MainTab),
  'options',
  'gameOptions',
  'achievements',
  'pinned',
  'costs',
  'time',
  'feedback',
  'plays',
]

export const PLAYS_VIEWS: ReadonlyArray<PlaysView> = ['plays', 'byGame', 'gameDetail', 'drilldown']

export const MAIN_TAB_OPTIONS: ReadonlyArray<MainTabOption> = [
  ...SEPARATE_TAB_GAME_OPTIONS.map((game) => ({
    value: game.value as MainTab,
    label: game.label,
    group: 'games' as const,
  })),
  { value: 'achievements', label: 'Achievements', group: 'other' },
  { value: 'pinned', label: 'Pinned', group: 'other' },
  { value: 'costs', label: 'Costs', group: 'other' },
  { value: 'time', label: 'Time', group: 'other' },
  { value: 'fulfilment', label: 'Fulfilment', group: 'other' },
  { value: 'feedback', label: 'Feedback', group: 'other' },
  { value: 'options', label: 'Options', group: 'other' },
  { value: 'gameOptions', label: 'Game options', group: 'other' },
  { value: 'plays', label: 'Plays', group: 'other' },
  { value: 'monthlyChecklist', label: 'This month', group: 'other' },
  { value: 'monthlySummary', label: 'By month', group: 'other' },
]

export const MAIN_TAB_GROUPS: ReadonlyArray<{ id: MainTabGroup; label: string }> = [
  { id: 'games', label: 'Games' },
  { id: 'other', label: 'Other' },
]

export const PLAYS_VIEW_OPTIONS: ReadonlyArray<{
  value: Extract<PlaysView, 'plays' | 'byGame'>
  label: string
}> = [
  { value: 'plays', label: 'All plays' },
  { value: 'byGame', label: 'By game' },
]

export function isGameMainTab(value: string): boolean {
  return isSeparateTabGameId(value)
}

export function isMainTab(value: string): value is MainTab {
  return (MAIN_TABS as readonly string[]).includes(value)
}

export function isPlaysView(value: string): value is PlaysView {
  return (PLAYS_VIEWS as readonly string[]).includes(value)
}

export function hashForNavState(nav: AppNavState): string {
  if (nav.mainTab === 'gameOptions') {
    return nav.selectedOptionsGameId
      ? `#game-options/${encodeURIComponent(nav.selectedOptionsGameId)}`
      : '#game-options'
  }

  if (nav.mainTab === 'monthlyChecklist') {
    return nav.selectedMonthKey
      ? `#monthlyChecklist/${encodeURIComponent(nav.selectedMonthKey)}`
      : '#monthlyChecklist'
  }

  if (nav.mainTab !== 'plays') return `#${nav.mainTab}`

  if (nav.playsView === 'byGame') return '#plays/byGame'
  if (nav.playsView === 'gameDetail' && nav.selectedGameKey) {
    return `#plays/game/${encodeURIComponent(nav.selectedGameKey)}`
  }
  if (nav.playsView === 'drilldown') return '#plays/drilldown'
  return '#plays/plays'
}

export function parseNavStateFromHash(hash: string): Partial<AppNavState> | null {
  const trimmed = (hash || '').replace(/^#/, '').trim()
  if (!trimmed) return null

  const [head, ...rest] = trimmed.split('/').filter(Boolean)
  if (!head) return null

  if (head === 'plays') {
    const viewRaw = rest[0] || 'plays'
    if (viewRaw === 'game') {
      const encodedKey = rest[1]
      if (!encodedKey)
        return {
          mainTab: 'plays',
          playsView: 'byGame',
          selectedGameKey: null,
          selectedOptionsGameId: null,
          selectedMonthKey: null,
        }
      let decodedKey = ''
      try {
        decodedKey = decodeURIComponent(encodedKey)
      } catch {
        return {
          mainTab: 'plays',
          playsView: 'byGame',
          selectedGameKey: null,
          selectedOptionsGameId: null,
          selectedMonthKey: null,
        }
      }
      return {
        mainTab: 'plays',
        playsView: 'gameDetail',
        selectedGameKey: decodedKey,
        selectedOptionsGameId: null,
        selectedMonthKey: null,
      }
    }

    if (!isPlaysView(viewRaw) || viewRaw === 'drilldown') {
      return {
        mainTab: 'plays',
        playsView: 'plays',
        selectedGameKey: null,
        selectedOptionsGameId: null,
        selectedMonthKey: null,
      }
    }

    return {
      mainTab: 'plays',
      playsView: viewRaw,
      selectedGameKey: null,
      selectedOptionsGameId: null,
      selectedMonthKey: null,
    }
  }

  if (head === 'game-options') {
    const selectedOptionsGameId = normalizeConfigurableGameId(rest[0] || '')
    return {
      mainTab: 'gameOptions',
      selectedOptionsGameId,
      selectedGameKey: null,
      playsView: 'plays',
      selectedMonthKey: null,
    }
  }

  if (head === 'monthlyChecklist') {
    const selectedMonthKey = /^\d{4}-\d{2}$/.test(rest[0] || '') ? (rest[0] as string) : null
    return {
      mainTab: 'monthlyChecklist',
      playsView: 'plays',
      selectedGameKey: null,
      selectedOptionsGameId: null,
      selectedMonthKey,
    }
  }

  if (isMainTab(head)) return { mainTab: head as MainTab }

  return null
}
