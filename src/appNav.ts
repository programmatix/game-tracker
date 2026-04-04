export type MainTab =
  | 'monthlyChecklist'
  | 'arkhamHorrorLcg'
  | 'kingdomsForlorn'
  | 'isofarianGuard'
  | 'taintedGrail'
  | 'finalGirl'
  | 'skytearHorde'
  | 'cloudspire'
  | 'burncycle'
  | 'paleo'
  | 'robinsonCrusoe'
  | 'robinHood'
  | 'earthborneRangers'
  | 'deckers'
  | 'oathsworn'
  | 'elderScrolls'
  | 'starTrekCaptainsChair'
  | 'unsettled'
  | 'spiritIsland'
  | 'mistfall'
  | 'deathMayDie'
  | 'bullet'
  | 'tooManyBones'
  | 'mageKnight'
  | 'mandalorianAdventures'
  | 'undauntedNormandy'
  | 'achievements'
  | 'costs'
  | 'feedback'
  | 'plays'

export type PlaysView = 'plays' | 'byGame' | 'gameDetail' | 'drilldown'

export type AppNavState = {
  mainTab: MainTab
  playsView: PlaysView
  selectedGameKey: string | null
}

export type MainTabGroup = 'games' | 'other'
export type MainTabOption = { value: MainTab; label: string; group: MainTabGroup }

export const MAIN_TABS: ReadonlyArray<MainTab> = [
  'monthlyChecklist',
  'arkhamHorrorLcg',
  'kingdomsForlorn',
  'isofarianGuard',
  'taintedGrail',
  'finalGirl',
  'skytearHorde',
  'cloudspire',
  'burncycle',
  'paleo',
  'robinsonCrusoe',
  'robinHood',
  'earthborneRangers',
  'deckers',
  'oathsworn',
  'elderScrolls',
  'starTrekCaptainsChair',
  'unsettled',
  'spiritIsland',
  'mistfall',
  'deathMayDie',
  'bullet',
  'tooManyBones',
  'mageKnight',
  'mandalorianAdventures',
  'undauntedNormandy',
  'achievements',
  'costs',
  'feedback',
  'plays',
]

export const PLAYS_VIEWS: ReadonlyArray<PlaysView> = ['plays', 'byGame', 'gameDetail', 'drilldown']

export const MAIN_TAB_OPTIONS: ReadonlyArray<MainTabOption> = [
  { value: 'arkhamHorrorLcg', label: 'Arkham Horror LCG', group: 'games' },
  { value: 'bullet', label: 'Bullet', group: 'games' },
  { value: 'burncycle', label: 'burncycle', group: 'games' },
  { value: 'cloudspire', label: 'Cloudspire', group: 'games' },
  { value: 'deathMayDie', label: 'Death May Die', group: 'games' },
  { value: 'earthborneRangers', label: 'Earthborne Rangers', group: 'games' },
  { value: 'deckers', label: 'Deckers', group: 'games' },
  { value: 'finalGirl', label: 'Final Girl', group: 'games' },
  { value: 'isofarianGuard', label: 'Isofarian Guard', group: 'games' },
  { value: 'kingdomsForlorn', label: 'Kingdoms Forlorn', group: 'games' },
  { value: 'mageKnight', label: 'Mage Knight', group: 'games' },
  { value: 'mandalorianAdventures', label: 'Mandalorian Adventures', group: 'games' },
  { value: 'mistfall', label: 'Mistfall', group: 'games' },
  { value: 'oathsworn', label: 'Oathsworn', group: 'games' },
  { value: 'elderScrolls', label: 'Elder Scrolls', group: 'games' },
  { value: 'paleo', label: 'Paleo', group: 'games' },
  { value: 'robinHood', label: 'Robin Hood', group: 'games' },
  { value: 'robinsonCrusoe', label: 'Robinson Crusoe', group: 'games' },
  { value: 'skytearHorde', label: 'Skytear Horde', group: 'games' },
  { value: 'spiritIsland', label: 'Spirit Island', group: 'games' },
  { value: 'starTrekCaptainsChair', label: "Star Trek: Captain's Chair", group: 'games' },
  { value: 'taintedGrail', label: 'Tainted Grail', group: 'games' },
  { value: 'tooManyBones', label: 'Too Many Bones', group: 'games' },
  { value: 'undauntedNormandy', label: 'Undaunted: Normandy', group: 'games' },
  { value: 'unsettled', label: 'Unsettled', group: 'games' },
  { value: 'achievements', label: 'Achievements', group: 'other' },
  { value: 'costs', label: 'Costs', group: 'other' },
  { value: 'feedback', label: 'Feedback', group: 'other' },
  { value: 'plays', label: 'Plays', group: 'other' },
  { value: 'monthlyChecklist', label: 'This month', group: 'other' },
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

export function isMainTab(value: string): value is MainTab {
  return (MAIN_TABS as readonly string[]).includes(value)
}

export function isPlaysView(value: string): value is PlaysView {
  return (PLAYS_VIEWS as readonly string[]).includes(value)
}

export function hashForNavState(nav: AppNavState): string {
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
      if (!encodedKey) return { mainTab: 'plays', playsView: 'byGame', selectedGameKey: null }
      let decodedKey = ''
      try {
        decodedKey = decodeURIComponent(encodedKey)
      } catch {
        return { mainTab: 'plays', playsView: 'byGame', selectedGameKey: null }
      }
      return {
        mainTab: 'plays',
        playsView: 'gameDetail',
        selectedGameKey: decodedKey,
      }
    }

    if (!isPlaysView(viewRaw) || viewRaw === 'drilldown') {
      return { mainTab: 'plays', playsView: 'plays', selectedGameKey: null }
    }

    return { mainTab: 'plays', playsView: viewRaw, selectedGameKey: null }
  }

  if (isMainTab(head)) return { mainTab: head }

  return null
}
