import {
  For,
  Show,
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js'
import { fetchAllUserPlays, fetchThingSummary, type BggPlaysResponse } from './bgg'
import FinalGirlView from './games/final-girl/FinalGirlView'
import DeathMayDieView from './games/death-may-die/DeathMayDieView'
import MistfallView from './games/mistfall/MistfallView'
import SpiritIslandView from './games/spirit-island/SpiritIslandView'
import BulletView from './games/bullet/BulletView'
import TooManyBonesView from './games/too-many-bones/TooManyBonesView'
import MageKnightView from './games/mage-knight/MageKnightView'
import UndauntedNormandyView from './games/undaunted-normandy/UndauntedNormandyView'
import UnsettledView from './games/unsettled/UnsettledView'
import SkytearHordeView from './games/skytear-horde/SkytearHordeView'
import AchievementsView from './AchievementsView'
import MonthlyChecklistView from './MonthlyChecklistView'
import { authUser, signOutUser } from './auth/auth'
import {
  fetchPinnedAchievementIds,
  savePinnedAchievementIds,
} from './achievements/pinsFirebase'
import {
  maybeWriteAchievementsSnapshot,
  readSeenCompletedAchievementIds,
  writeSeenCompletedAchievementIds,
} from './achievements/localStore'
import {
  computeNewlyUnlockedAchievements,
  computeTrackIdsForAchievements,
} from './achievements/newlyUnlocked'
import { pickBestAvailableAchievementForTrackIds } from './achievements/nextAchievement'
import { computeAllGameAchievementSummaries } from './achievements/games'
import NewAchievementsBanner from './components/NewAchievementsBanner'
import type { PlaysDrilldownRequest } from './playsDrilldown'
import {
  fetchSpiritIslandSessions,
  SPIRIT_ISLAND_MINDWANDERER_UID,
} from './games/spirit-island/mindwanderer'
import { formatPlayLength } from './formatPlayLength'
import './App.css'

const USERNAME = 'stony82'
const PLAYS_PER_PAGE = 25
type MainTab =
  | 'monthlyChecklist'
  | 'finalGirl'
  | 'skytearHorde'
  | 'unsettled'
  | 'spiritIsland'
  | 'mistfall'
  | 'deathMayDie'
  | 'bullet'
  | 'tooManyBones'
  | 'mageKnight'
  | 'undauntedNormandy'
  | 'achievements'
  | 'plays'
type PlaysView = 'plays' | 'byGame' | 'gameDetail' | 'drilldown'

type PlaysDrilldownReturn = {
  mainTab: MainTab
  playsView: PlaysView
  selectedGameKey: string | null
}

const MAIN_TABS: ReadonlyArray<MainTab> = [
  'monthlyChecklist',
  'finalGirl',
  'skytearHorde',
  'unsettled',
  'spiritIsland',
  'mistfall',
  'deathMayDie',
  'bullet',
  'tooManyBones',
  'mageKnight',
  'undauntedNormandy',
  'achievements',
  'plays',
]
const PLAYS_VIEWS: ReadonlyArray<PlaysView> = ['plays', 'byGame', 'gameDetail', 'drilldown']

function isMainTab(value: string): value is MainTab {
  return (MAIN_TABS as readonly string[]).includes(value)
}

function isPlaysView(value: string): value is PlaysView {
  return (PLAYS_VIEWS as readonly string[]).includes(value)
}

type AppNavState = {
  mainTab: MainTab
  playsView: PlaysView
  selectedGameKey: string | null
}

function hashForNavState(nav: AppNavState): string {
  if (nav.mainTab !== 'plays') return `#${nav.mainTab}`

  if (nav.playsView === 'byGame') return '#plays/byGame'
  if (nav.playsView === 'gameDetail' && nav.selectedGameKey) {
    return `#plays/game/${encodeURIComponent(nav.selectedGameKey)}`
  }
  if (nav.playsView === 'drilldown') return '#plays/drilldown'
  return '#plays/plays'
}

function parseNavStateFromHash(hash: string): Partial<AppNavState> | null {
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

type PlaysCacheV1 = {
  version: 1
  fetchedAtMs: number
  data: Pick<BggPlaysResponse, 'username' | 'userid' | 'total' | 'plays' | 'raw'>
}

const PLAYS_CACHE_KEY = `bggPlaysCache:v1:${USERNAME}`
const PLAYS_CACHE_TTL_MS = 30 * 60 * 1000

function readPlaysCache(): PlaysCacheV1 | null {
  try {
    const raw = localStorage.getItem(PLAYS_CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed != null &&
      'version' in parsed &&
      (parsed as { version: unknown }).version === 1 &&
      'fetchedAtMs' in parsed &&
      typeof (parsed as { fetchedAtMs: unknown }).fetchedAtMs === 'number' &&
      'data' in parsed &&
      typeof (parsed as { data: unknown }).data === 'object'
    ) {
      return parsed as PlaysCacheV1
    }
    return null
  } catch {
    return null
  }
}

function writePlaysCache(cache: PlaysCacheV1) {
  try {
    localStorage.setItem(PLAYS_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore quota / storage failures
  }
}

function isCacheFresh(cache: PlaysCacheV1 | null): boolean {
  if (!cache) return false
  return Date.now() - cache.fetchedAtMs <= PLAYS_CACHE_TTL_MS
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function compareIsoDatesDesc(a?: string, b?: string): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  if (a === b) return 0
  return a > b ? -1 : 1
}

function gameKeyFromPlay(play: {
  item?: { attributes: Record<string, string> }
}): string {
  const objectid = play.item?.attributes.objectid
  const objecttype = play.item?.attributes.objecttype
  const name = play.item?.attributes.name || 'Unknown'
  return objectid ? `${objecttype || 'thing'}:${objectid}` : `name:${name}`
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function getPlayerColorForUser(play: {
  players: Array<{ attributes: Record<string, string> }>
}, username: string): string {
  const user = username.toLowerCase()
  const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
  return player?.attributes.color || ''
}

function bggPlayUrl(playId: number): string {
  return `https://boardgamegeek.com/play/details/${playId}`
}

function App() {
  const parsedHash =
    typeof window === 'undefined' ? null : parseNavStateFromHash(window.location.hash)
  const initialMainTab: MainTab = parsedHash?.mainTab ?? 'finalGirl'
  const initialPlaysView: PlaysView =
    initialMainTab === 'plays' ? (parsedHash?.playsView ?? 'plays') : 'plays'
  const initialSelectedGameKey: string | null =
    initialMainTab === 'plays' && initialPlaysView === 'gameDetail'
      ? (parsedHash?.selectedGameKey ?? null)
      : null

  const [page, setPage] = createSignal(1)
  const [pageDraft, setPageDraft] = createSignal(String(page()))
  const [mainTab, setMainTab] = createSignal<MainTab>(initialMainTab)
  const [playsView, setPlaysView] = createSignal<PlaysView>(initialPlaysView)
  const [selectedGameKey, setSelectedGameKey] =
    createSignal<string | null>(initialSelectedGameKey)
  const [playsDrilldown, setPlaysDrilldown] = createSignal<PlaysDrilldownRequest | null>(null)
  const [playsDrilldownReturn, setPlaysDrilldownReturn] =
    createSignal<PlaysDrilldownReturn | null>(null)
  const bggAuthToken = createMemo(
    () => (import.meta.env.BGG_TOKEN || import.meta.env.VITE_BGG_TOKEN || '').trim(),
  )

  const [spiritIslandSessions] = createResource(
    () => SPIRIT_ISLAND_MINDWANDERER_UID,
    (uid: string) => fetchSpiritIslandSessions(uid),
  )
  const spiritIslandSessionsValue = createMemo(() => {
    try {
      return spiritIslandSessions()
    } catch {
      return undefined
    }
  })
  const spiritIslandSessionsError = createMemo(() => {
    const error = spiritIslandSessions.error
    if (!error) return null
    return error instanceof Error ? error.message : String(error)
  })

  const [playsCache, setPlaysCache] = createSignal<PlaysCacheV1 | null>(readPlaysCache())
  const [playsError, setPlaysError] = createSignal<string | null>(null)
  const [isFetchingPlays, setIsFetchingPlays] = createSignal(false)
  const [pinnedAchievementIds, setPinnedAchievementIds] = createSignal(new Set<string>())
  const [seenCompletedAchievementIds, setSeenCompletedAchievementIds] = createSignal(
    readSeenCompletedAchievementIds(),
  )

  const [thumbnailsByObjectId, setThumbnailsByObjectId] = createSignal(
    new Map<string, string>(),
  )
  const objectIdsInFlight = new Set<string>()
  const objectIdsFailed = new Set<string>()
  const queuedObjectIds = new Set<string>()
  let isThumbnailPumpRunning = false
  let thumbnailsEnabled = true

  createEffect(() => setPageDraft(String(page())))
  createEffect(() => {
    const user = authUser()
    if (!user) return

    let cancelled = false
    void fetchPinnedAchievementIds(user).then((remoteIds) => {
      if (cancelled) return
      setPinnedAchievementIds(remoteIds)
    })

    onCleanup(() => {
      cancelled = true
    })
  })

  createEffect(() => {
    if (mainTab() === 'plays') return
    if (playsView() !== 'drilldown') return
    setPlaysDrilldown(null)
    setPlaysDrilldownReturn(null)
    setPlaysView('plays')
  })

  const allPlays = createMemo<BggPlaysResponse>(() => {
    const cached = playsCache()
    if (!cached) {
      return { username: USERNAME, total: 0, page: 1, raw: { cache: null }, plays: [] }
    }
    return {
      username: cached.data.username || USERNAME,
      userid: cached.data.userid,
      total: cached.data.total,
      page: 1,
      raw: cached.data.raw,
      plays: cached.data.plays,
    }
  })

  async function refreshPlays(options?: { force?: boolean }) {
    if (isFetchingPlays()) return

    const cached = playsCache()
    const shouldFetch = options?.force ? true : !isCacheFresh(cached)
    if (!shouldFetch) return

    setIsFetchingPlays(true)
    setPlaysError(null)
    try {
      const response = await fetchAllUserPlays(USERNAME, {
        authToken: bggAuthToken(),
        bypassCache: Boolean(options?.force),
      })
      const nextCache: PlaysCacheV1 = {
        version: 1,
        fetchedAtMs: Date.now(),
        data: {
          username: response.username || USERNAME,
          userid: response.userid,
          total: response.total,
          plays: response.plays,
          raw: response.raw,
        },
      }
      writePlaysCache(nextCache)
      setPlaysCache(nextCache)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setPlaysError(message)
    } finally {
      setIsFetchingPlays(false)
    }
  }

  void refreshPlays()
  createEffect(() => {
    const id = window.setInterval(() => void refreshPlays(), 60 * 1000)
    onCleanup(() => window.clearInterval(id))
  })
  const totalPlayCount = createMemo(() =>
    allPlays().plays.reduce((sum, play) => sum + playQuantity(play), 0),
  )

  const allAchievements = createMemo(() => {
    const summaries = computeAllGameAchievementSummaries(allPlays().plays, USERNAME, {
      spiritIslandSessions: spiritIslandSessionsValue(),
    })
    return summaries.flatMap((summary) => summary.achievements)
  })

  const newlyUnlockedAchievements = createMemo(() =>
    computeNewlyUnlockedAchievements(allAchievements(), seenCompletedAchievementIds()),
  )
  const newlyUnlockedTrackIds = createMemo(() =>
    computeTrackIdsForAchievements(newlyUnlockedAchievements()),
  )
  const suppressAvailableTrackIds = createMemo(
    () => new Set<string>(newlyUnlockedTrackIds()),
  )
  const nextAchievementAfterDismiss = createMemo(() =>
    pickBestAvailableAchievementForTrackIds(allAchievements(), newlyUnlockedTrackIds()),
  )

  function dismissNewlyUnlockedAchievements() {
    const nextSeen = new Set(seenCompletedAchievementIds())
    for (const achievement of newlyUnlockedAchievements()) nextSeen.add(achievement.id)
    setSeenCompletedAchievementIds(nextSeen)
    writeSeenCompletedAchievementIds(nextSeen)
  }

  createEffect(() => {
    // Persist a snapshot in the background while navigating (at most every ~10 minutes).
    mainTab()
    playsView()
    maybeWriteAchievementsSnapshot(allAchievements())
  })

  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(allPlays().plays.length / PLAYS_PER_PAGE)),
  )

  function toggleAchievementPin(achievementId: string) {
    const next = new Set(pinnedAchievementIds())
    if (next.has(achievementId)) {
      next.delete(achievementId)
    } else {
      next.add(achievementId)
    }
    setPinnedAchievementIds(next)
    const user = authUser()
    if (user) {
      void savePinnedAchievementIds(user, next).catch(() => {
        // ignore sync failures
      })
    }
  }

  const pagedPlays = createMemo(() => {
    const start = (page() - 1) * PLAYS_PER_PAGE
    return allPlays().plays.slice(start, start + PLAYS_PER_PAGE)
  })

  const playsByGame = createMemo(() => {
    const groups = new Map<
      string,
      {
        key: string
        objectid?: string
        objecttype?: string
        name: string
        plays: number
        mostRecentDate?: string
      }
    >()

    for (const play of allPlays().plays) {
      const objectid = play.item?.attributes.objectid
      const objecttype = play.item?.attributes.objecttype
      const name = play.item?.attributes.name || 'Unknown'
      const key = objectid ? `${objecttype || 'thing'}:${objectid}` : `name:${name}`
      const qty = playQuantity(play)
      const date = play.attributes.date || undefined

      const existing = groups.get(key)
      if (existing) {
        existing.plays += qty
        if (date && compareIsoDatesDesc(date, existing.mostRecentDate) < 0) {
          existing.mostRecentDate = date
        }
      } else {
        groups.set(key, {
          key,
          objectid,
          objecttype,
          name,
          plays: qty,
          mostRecentDate: date,
        })
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays
      return a.name.localeCompare(b.name)
    })
  })

  const selectedGame = createMemo(() => {
    const key = selectedGameKey()
    if (!key) return undefined
    return playsByGame().find((row) => row.key === key)
  })

  const selectedGamePlays = createMemo(() => {
    const key = selectedGameKey()
    if (!key) return []
    const plays = allPlays().plays.filter((play) => gameKeyFromPlay(play) === key)
    return plays
      .slice()
      .sort((a, b) => compareIsoDatesDesc(a.attributes.date, b.attributes.date))
  })

  const selectedGamePlayCount = createMemo(() =>
    selectedGamePlays().reduce((sum, play) => sum + playQuantity(play), 0),
  )

  const selectedGameTotalPages = createMemo(() =>
    Math.max(1, Math.ceil(selectedGamePlays().length / PLAYS_PER_PAGE)),
  )

  const selectedGamePagedPlays = createMemo(() => {
    const start = (page() - 1) * PLAYS_PER_PAGE
    return selectedGamePlays().slice(start, start + PLAYS_PER_PAGE)
  })

  const drilldownPlays = createMemo(() => {
    const drill = playsDrilldown()
    if (!drill) return []
    const ids = new Set(drill.playIds.filter((id) => Number.isFinite(id)))
    return allPlays()
      .plays.filter((play) => ids.has(play.id))
      .slice()
      .sort((a, b) => compareIsoDatesDesc(a.attributes.date, b.attributes.date))
  })

  const drilldownTotalPages = createMemo(() =>
    Math.max(1, Math.ceil(drilldownPlays().length / PLAYS_PER_PAGE)),
  )

  const drilldownPagedPlays = createMemo(() => {
    const start = (page() - 1) * PLAYS_PER_PAGE
    return drilldownPlays().slice(start, start + PLAYS_PER_PAGE)
  })

  function noteThumbnail(objectid: string, url?: string) {
    if (!url) return
    if (thumbnailsByObjectId().get(objectid) === url) return
    setThumbnailsByObjectId((prev) => {
      const next = new Map(prev)
      next.set(objectid, url)
      return next
    })
  }

  async function pumpThumbnailsQueue() {
    if (isThumbnailPumpRunning) return
    isThumbnailPumpRunning = true

    const MAX_CONCURRENT = 4
    try {
      while (queuedObjectIds.size > 0) {
        if (!thumbnailsEnabled) break

        const batch: string[] = []
        for (const objectid of queuedObjectIds) {
          queuedObjectIds.delete(objectid)
          if (thumbnailsByObjectId().has(objectid)) continue
          if (objectIdsInFlight.has(objectid)) continue
          if (objectIdsFailed.has(objectid)) continue
          batch.push(objectid)
          if (batch.length >= MAX_CONCURRENT) break
        }

        if (batch.length === 0) break

        await Promise.allSettled(
          batch.map(async (objectid) => {
            objectIdsInFlight.add(objectid)
            try {
              const authToken = bggAuthToken()
              if (!authToken) return
              const thing = await fetchThingSummary(objectid, { authToken })
              noteThumbnail(objectid, thing.image || thing.thumbnail)
            } catch {
              objectIdsFailed.add(objectid)
            } finally {
              objectIdsInFlight.delete(objectid)
            }
          }),
        )
      }
    } finally {
      isThumbnailPumpRunning = false
    }
  }

  function enqueueThumbnails(objectids: string[]) {
    for (const objectid of objectids) {
      if (!objectid) continue
      if (thumbnailsByObjectId().has(objectid)) continue
      if (objectIdsFailed.has(objectid)) continue
      queuedObjectIds.add(objectid)
    }
    void pumpThumbnailsQueue()
  }

  createEffect(() => {
    thumbnailsEnabled = playsView() === 'byGame' && Boolean(bggAuthToken())
    if (!thumbnailsEnabled) return

    const ids = playsByGame()
      .map((row) => row.objectid)
      .filter((id): id is string => Boolean(id))

    enqueueThumbnails(ids)
  })

  const currentTotalPages = createMemo(() =>
    playsView() === 'gameDetail'
      ? selectedGameTotalPages()
      : playsView() === 'drilldown'
        ? drilldownTotalPages()
        : totalPages(),
  )

  const goToPage = (nextPage: number) => setPage(clamp(nextPage, 1, currentTotalPages()))
  const resetPage = () => {
    setPage(1)
    setPageDraft('1')
  }

  type AppHistoryState =
    | { kind: 'app'; nav: AppNavState }
    | { kind: 'drilldown'; navReturn: AppNavState; request: PlaysDrilldownRequest }

  function currentNavState(): AppNavState {
    return {
      mainTab: mainTab(),
      playsView: playsView(),
      selectedGameKey: selectedGameKey(),
    }
  }

  function applyNavState(next: AppNavState) {
    setMainTab(next.mainTab)
    setPlaysView(next.playsView)
    setSelectedGameKey(next.selectedGameKey)
    resetPage()
  }

  function pushNavState(next: AppNavState) {
    if (mainTab() === 'plays' && playsView() === 'drilldown') return
    const url = new URL(window.location.href)
    url.hash = hashForNavState(next)
    const state: AppHistoryState = { kind: 'app', nav: next }
    window.history.pushState(state, '', url.toString())
  }

  function openPlaysDrilldown(request: PlaysDrilldownRequest, options?: { pushHistory?: boolean }) {
    const returnState = currentNavState()
    batch(() => {
      setPlaysDrilldownReturn({
        mainTab: returnState.mainTab,
        playsView: returnState.playsView,
        selectedGameKey: returnState.selectedGameKey,
      })
      setPlaysDrilldown(request)
      setSelectedGameKey(null)
      setMainTab('plays')
      setPlaysView('drilldown')
      resetPage()
    })

    const shouldPush = options?.pushHistory !== false
    if (!shouldPush) return

    const url = new URL(window.location.href)
    const previousUrl = url.toString()
    const drilldownUrl = new URL(previousUrl)
    drilldownUrl.hash = '#plays/drilldown'

    const appState: AppHistoryState = { kind: 'app', nav: returnState }
    window.history.replaceState(appState, '', previousUrl)
    const drillState: AppHistoryState = { kind: 'drilldown', navReturn: returnState, request }
    window.history.pushState(drillState, '', drilldownUrl.toString())
  }

  function closePlaysDrilldown(options?: { viaHistoryBack?: boolean }) {
    if (options?.viaHistoryBack) {
      const state = window.history.state as AppHistoryState | null
      if (state?.kind === 'drilldown') {
        window.history.back()
        return
      }
    }

    const back = playsDrilldownReturn()
    setPlaysDrilldown(null)
    setPlaysDrilldownReturn(null)

    if (back) {
      applyNavState(back)
      return
    }

    setPlaysView('plays')
    resetPage()
  }

  onMount(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as AppHistoryState | null

      if (!state || (state.kind !== 'app' && state.kind !== 'drilldown')) {
        if (playsView() === 'drilldown') {
          setPlaysDrilldown(null)
          setPlaysDrilldownReturn(null)
          setPlaysView('plays')
          resetPage()
        }
        return
      }

      if (state.kind === 'drilldown') {
        setPlaysDrilldownReturn(state.navReturn)
        openPlaysDrilldown(state.request, { pushHistory: false })
        return
      }

      setPlaysDrilldown(null)
      setPlaysDrilldownReturn(null)
      applyNavState(state.nav)
    }

    window.addEventListener('popstate', onPopState)
    onCleanup(() => window.removeEventListener('popstate', onPopState))
  })

  createEffect(() => {
    if (mainTab() === 'plays' && playsView() === 'drilldown') return
    const nav = currentNavState()
    const state: AppHistoryState = { kind: 'app', nav }
    const url = new URL(window.location.href)
    const desiredHash = hashForNavState(nav)
    if (url.hash !== desiredHash) url.hash = desiredHash
    window.history.replaceState(state, '', url.toString())
  })

  return (
    <div class="app">
      <header class="header">
        <div class="title">
          <h1>Game Tracker</h1>
          <p class="muted">
            BoardGameGeek user: <span class="mono">{USERNAME}</span>
          </p>
        </div>
        <div class="headerActions">
          <div class="tokenRow">
            <span class="muted">Signed in</span>
            <span class="mono">{authUser()?.email || '—'}</span>
            <button
              class="linkButton"
              type="button"
              onClick={() => void signOutUser()}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
          <div class="muted">
            Plays source:{' '}
            <span class="mono">
              {playsCache() ? 'BGG (cached)' : isFetchingPlays() ? 'BGG (loading)' : 'BGG'}
            </span>
          </div>
          <div class="tokenRow">
            <button
              class="linkButton"
              type="button"
              onClick={() => void refreshPlays({ force: true })}
              disabled={isFetchingPlays()}
              title="Reload plays from BoardGameGeek"
            >
              {isFetchingPlays() ? 'Reloading…' : 'Reload'}
            </button>
            <Show when={playsCache()} fallback={<span class="muted">Last fetch: —</span>}>
              {(cached) => (
                <span class="muted">
                  Last fetch:{' '}
                  <span class="mono">{new Date(cached().fetchedAtMs).toLocaleString()}</span>
                </span>
              )}
            </Show>
          </div>
          <Show when={!bggAuthToken()}>
            <div class="muted">
              BGG token missing in <span class="mono">.env</span>
            </div>
          </Show>
          <Show when={playsError()}>
            {(message) => <div class="muted">Fetch error: {message()}</div>}
          </Show>
        </div>
      </header>

      <Show when={newlyUnlockedAchievements().length > 0}>
        <NewAchievementsBanner
          unlocked={newlyUnlockedAchievements()}
          nextAfterDismiss={nextAchievementAfterDismiss()}
          onDismissAll={dismissNewlyUnlockedAchievements}
        />
      </Show>

      <main class="main">
        <section class="panel">
          <div class="panelHeader playsHeader">
            <div class="panelHeaderLeft">
              <h2>Views</h2>
              <div class="tabs" role="tablist" aria-label="Views">
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'monthlyChecklist' }}
                  onClick={() => {
                    if (mainTab() === 'monthlyChecklist') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'monthlyChecklist' }
                    setMainTab('monthlyChecklist')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'monthlyChecklist'}
                >
                  This month
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'finalGirl' }}
                  onClick={() => {
                    if (mainTab() === 'finalGirl') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'finalGirl' }
                    setMainTab('finalGirl')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'finalGirl'}
                >
                  Final Girl
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'skytearHorde' }}
                  onClick={() => {
                    if (mainTab() === 'skytearHorde') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'skytearHorde' }
                    setMainTab('skytearHorde')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'skytearHorde'}
                >
                  Skytear Horde
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'spiritIsland' }}
                  onClick={() => {
                    if (mainTab() === 'spiritIsland') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'spiritIsland' }
                    setMainTab('spiritIsland')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'spiritIsland'}
                >
                  Spirit Island
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'unsettled' }}
                  onClick={() => {
                    if (mainTab() === 'unsettled') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'unsettled' }
                    setMainTab('unsettled')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'unsettled'}
                >
                  Unsettled
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'mistfall' }}
                  onClick={() => {
                    if (mainTab() === 'mistfall') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'mistfall' }
                    setMainTab('mistfall')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'mistfall'}
                >
                  Mistfall
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'bullet' }}
                  onClick={() => {
                    if (mainTab() === 'bullet') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'bullet' }
                    setMainTab('bullet')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'bullet'}
                >
                  Bullet
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'tooManyBones' }}
                  onClick={() => {
                    if (mainTab() === 'tooManyBones') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'tooManyBones' }
                    setMainTab('tooManyBones')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'tooManyBones'}
                >
                  Too Many Bones
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'mageKnight' }}
                  onClick={() => {
                    if (mainTab() === 'mageKnight') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'mageKnight' }
                    setMainTab('mageKnight')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'mageKnight'}
                >
                  Mage Knight
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'undauntedNormandy' }}
                  onClick={() => {
                    if (mainTab() === 'undauntedNormandy') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'undauntedNormandy' }
                    setMainTab('undauntedNormandy')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'undauntedNormandy'}
                >
                  Undaunted: Normandy
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'achievements' }}
                  onClick={() => {
                    if (mainTab() === 'achievements') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'achievements' }
                    setMainTab('achievements')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'achievements'}
                >
                  Achievements
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'plays' }}
                  onClick={() => {
                    if (mainTab() === 'plays') return
                    const next: AppNavState = { ...currentNavState(), mainTab: 'plays' }
                    setMainTab('plays')
                    pushNavState(next)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'plays'}
                >
                  Plays
                </button>
              </div>

              <Show when={mainTab() === 'plays'}>
                <Show
                  when={playsView() === 'gameDetail' || playsView() === 'drilldown'}
                  fallback={
                    <div class="tabs" role="tablist" aria-label="Plays views">
                      <button
                        class="tabButton"
                        classList={{ tabButtonActive: playsView() === 'plays' }}
                        onClick={() => {
                          if (playsView() === 'plays') return
                          setPlaysView('plays')
                          setSelectedGameKey(null)
                          setPlaysDrilldown(null)
                          resetPage()
                          pushNavState({
                            mainTab: 'plays',
                            playsView: 'plays',
                            selectedGameKey: null,
                          })
                        }}
                        type="button"
                        role="tab"
                        aria-selected={playsView() === 'plays'}
                      >
                        All plays
                      </button>
                      <button
                        class="tabButton"
                        classList={{ tabButtonActive: playsView() === 'byGame' }}
                        onClick={() => {
                          if (playsView() === 'byGame') return
                          setPlaysView('byGame')
                          setSelectedGameKey(null)
                          setPlaysDrilldown(null)
                          resetPage()
                          pushNavState({
                            mainTab: 'plays',
                            playsView: 'byGame',
                            selectedGameKey: null,
                          })
                        }}
                        type="button"
                        role="tab"
                        aria-selected={playsView() === 'byGame'}
                      >
                        By game
                      </button>
                    </div>
                  }
                >
                  <div class="gameDetailHeader">
                    <button
                      class="linkButton"
                      type="button"
                      onClick={() => {
                        if (playsView() === 'drilldown') {
                          closePlaysDrilldown({ viaHistoryBack: true })
                        } else {
                          setPlaysView('byGame')
                          setSelectedGameKey(null)
                          resetPage()
                          pushNavState({
                            mainTab: 'plays',
                            playsView: 'byGame',
                            selectedGameKey: null,
                          })
                        }
                      }}
                    >
                      ← Back
                    </button>
                    <div class="mono">
                      {playsView() === 'drilldown'
                        ? (playsDrilldown()?.title || 'Plays')
                        : (selectedGame()?.name || 'Game')}
                    </div>
                  </div>
                </Show>
              </Show>
            </div>

            <Show when={mainTab() === 'plays' && playsView() !== 'byGame'}>
              <div class="pager">
                <button onClick={() => goToPage(page() - 1)} disabled={page() <= 1}>
                  Prev
                </button>

                <div class="pagerCenter">
                  <span class="muted">Page</span>
                  <input
                    class="pageInput"
                    inputmode="numeric"
                    type="number"
                    min="1"
                    max={currentTotalPages()}
                    value={pageDraft()}
                    onInput={(e) => setPageDraft(e.currentTarget.value)}
                  />
                  <span class="muted">
                    / <span class="mono">{currentTotalPages()}</span>
                  </span>
                  <button onClick={() => goToPage(Number(pageDraft()))}>Go</button>
                </div>

                <button
                  onClick={() => goToPage(page() + 1)}
                  disabled={page() >= currentTotalPages()}
                >
                  Next
                </button>
              </div>
            </Show>
          </div>

          <Show when={mainTab() === 'monthlyChecklist'}>
            <MonthlyChecklistView plays={allPlays().plays} authToken={bggAuthToken()} />
          </Show>

          <Show when={mainTab() === 'finalGirl'}>
            <FinalGirlView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'skytearHorde'}>
            <SkytearHordeView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'spiritIsland'}>
            <SpiritIslandView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              spiritIslandSessions={spiritIslandSessionsValue()}
              spiritIslandSessionsLoading={spiritIslandSessions.loading}
              spiritIslandSessionsError={spiritIslandSessionsError()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'unsettled'}>
            <UnsettledView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'mistfall'}>
            <MistfallView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'deathMayDie'}>
            <DeathMayDieView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'bullet'}>
            <BulletView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'tooManyBones'}>
            <TooManyBonesView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'mageKnight'}>
            <MageKnightView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'undauntedNormandy'}>
            <UndauntedNormandyView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'achievements'}>
            <AchievementsView
              plays={allPlays().plays}
              username={USERNAME}
              spiritIslandSessions={spiritIslandSessionsValue()}
              pinnedAchievementIds={pinnedAchievementIds()}
              suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
              onTogglePin={toggleAchievementPin}
            />
          </Show>

          <Show when={mainTab() === 'plays'}>
            <Show when={playsView() === 'plays'}>
              <div class="meta">
                Total plays: <span class="mono">{totalPlayCount().toLocaleString()}</span>
              </div>

              <div class="tableWrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Play</th>
                      <th>Date</th>
                      <th>Game</th>
                      <th>Qty</th>
                      <th>Length</th>
                      <th>Location</th>
                      <th>Incomplete</th>
                      <th>Now in Stats</th>
                      <th>Players</th>
                      <th>Comments</th>
                      <th>User Comment</th>
                      <th>Raw</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={pagedPlays()}>
                      {(play) => (
                        <tr>
                          <td class="mono">
                            <a href={bggPlayUrl(play.id)} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </td>
                          <td class="mono">{play.id}</td>
                          <td class="mono">{play.attributes.date || ''}</td>
                          <td>
                            <button
                              class="gameButtonInline"
                              type="button"
                              onClick={() => {
                                const key = gameKeyFromPlay(play)
                                setSelectedGameKey(key)
                                setPlaysView('gameDetail')
                                resetPage()
                                pushNavState({
                                  mainTab: 'plays',
                                  playsView: 'gameDetail',
                                  selectedGameKey: key,
                                })
                              }}
                            >
                              {play.item?.attributes.name || ''}
                            </button>
                            <div class="muted mono">
                              {play.item?.attributes.objecttype || 'thing'} #
                              {play.item?.attributes.objectid || ''}
                            </div>
                          </td>
                          <td class="mono">{play.attributes.quantity || ''}</td>
                          <td class="mono">{formatPlayLength(play.attributes.length)}</td>
                          <td>{play.attributes.location || ''}</td>
                          <td class="mono">{play.attributes.incomplete || ''}</td>
                          <td class="mono">{play.attributes.nowinstats || ''}</td>
                          <td>
                            <div class="players">
                              <For each={play.players}>
                                {(player) => {
                                  const name =
                                    player.attributes.username ||
                                    player.attributes.name ||
                                    'Unknown'
                                  const score = player.attributes.score
                                    ? ` score:${player.attributes.score}`
                                    : ''
                                  const win =
                                    player.attributes.win === '1' ? ' win' : ''
                                  return (
                                    <div class="mono">
                                      {name}
                                      {score}
                                      {win}
                                    </div>
                                  )
                                }}
                              </For>
                            </div>
                          </td>
                          <td>
                            <Show
                              when={play.comments}
                              fallback={<span class="muted">—</span>}
                            >
                              <details class="detailsCell">
                                <summary>View</summary>
                                <pre>{play.comments}</pre>
                              </details>
                            </Show>
                          </td>
                          <td>
                            <Show
                              when={play.usercomment}
                              fallback={<span class="muted">—</span>}
                            >
                              <details class="detailsCell">
                                <summary>View</summary>
                                <pre>{play.usercomment}</pre>
                              </details>
                            </Show>
                          </td>
                          <td>
                            <details class="detailsCell">
                              <summary>View</summary>
                              <pre>{JSON.stringify(play.raw, null, 2)}</pre>
                            </details>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>

            <Show when={playsView() === 'byGame'}>
              <div class="meta">
                Games: <span class="mono">{playsByGame().length.toLocaleString()}</span>
                {' • '}
                Total plays: <span class="mono">{totalPlayCount().toLocaleString()}</span>
                <Show when={!bggAuthToken()}>
                  {' • '}
                  <span class="muted">
                    Set <span class="mono">BGG_TOKEN</span> in <span class="mono">.env</span>{' '}
                    to load thumbnails
                  </span>
                </Show>
              </div>

              <div class="tableWrap">
                <table class="table tableCompact">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Total plays</th>
                      <th>Most recent</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={playsByGame()}>
                      {(row) => (
                        <tr>
                          <td>
                            <div class="gameRow">
                              <Show
                                when={
                                  row.objectid
                                    ? thumbnailsByObjectId().get(row.objectid)
                                    : undefined
                                }
                              >
                                {(thumbnail) => (
                                  <img
                                    class="gameThumb"
                                    src={thumbnail()}
                                    alt=""
                                    loading="lazy"
                                  />
                                )}
                              </Show>

                              <div class="gameInfo">
                                <button
                                  class="gameButton"
                                  type="button"
                                  onClick={() => {
                                    setSelectedGameKey(row.key)
                                    setPlaysView('gameDetail')
                                    resetPage()
                                    pushNavState({
                                      mainTab: 'plays',
                                      playsView: 'gameDetail',
                                      selectedGameKey: row.key,
                                    })
                                  }}
                                >
                                  {row.name}
                                </button>
                                <Show
                                  when={row.objectid}
                                  fallback={<span class="muted mono">—</span>}
                                >
                                  <div class="muted mono">
                                    {row.objecttype || 'thing'} #{row.objectid}
                                  </div>
                                </Show>
                              </div>
                            </div>
                          </td>
                          <td class="mono">{row.plays.toLocaleString()}</td>
                          <td class="mono">{row.mostRecentDate || '—'}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>

            <Show when={playsView() === 'drilldown'}>
              <div class="meta">
                Plays: <span class="mono">{drilldownPlays().length.toLocaleString()}</span>
              </div>

              <div class="tableWrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Date</th>
                      <th>Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={drilldownPagedPlays()}>
                      {(play) => (
                        <tr>
                          <td class="mono">
                            <a href={bggPlayUrl(play.id)} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </td>
                          <td class="mono">{play.attributes.date || ''}</td>
                          <td class="mono">{getPlayerColorForUser(play, USERNAME)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>

            <Show when={playsView() === 'gameDetail'}>
              <div class="meta">
                Total plays: <span class="mono">{selectedGamePlayCount().toLocaleString()}</span>
                {' • '}
                Most recent:{' '}
                <span class="mono">{selectedGame()?.mostRecentDate || '—'}</span>
              </div>

              <div class="tableWrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Play</th>
                      <th>Date</th>
                      <th>Game</th>
                      <th>Qty</th>
                      <th>Length</th>
                      <th>Location</th>
                      <th>Incomplete</th>
                      <th>Now in Stats</th>
                      <th>Players</th>
                      <th>Comments</th>
                      <th>User Comment</th>
                      <th>Raw</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={selectedGamePagedPlays()}>
                      {(play) => (
                        <tr>
                          <td class="mono">
                            <a href={bggPlayUrl(play.id)} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </td>
                          <td class="mono">{play.id}</td>
                          <td class="mono">{play.attributes.date || ''}</td>
                          <td>
                            <div>{play.item?.attributes.name || ''}</div>
                            <div class="muted mono">
                              {play.item?.attributes.objecttype || 'thing'} #
                              {play.item?.attributes.objectid || ''}
                            </div>
                          </td>
                          <td class="mono">{play.attributes.quantity || ''}</td>
                          <td class="mono">{formatPlayLength(play.attributes.length)}</td>
                          <td>{play.attributes.location || ''}</td>
                          <td class="mono">{play.attributes.incomplete || ''}</td>
                          <td class="mono">{play.attributes.nowinstats || ''}</td>
                          <td>
                            <div class="players">
                              <For each={play.players}>
                                {(player) => {
                                  const name =
                                    player.attributes.username ||
                                    player.attributes.name ||
                                    'Unknown'
                                  const score = player.attributes.score
                                    ? ` score:${player.attributes.score}`
                                    : ''
                                  const win =
                                    player.attributes.win === '1' ? ' win' : ''
                                  return (
                                    <div class="mono">
                                      {name}
                                      {score}
                                      {win}
                                    </div>
                                  )
                                }}
                              </For>
                            </div>
                          </td>
                          <td>
                            <Show
                              when={play.comments}
                              fallback={<span class="muted">—</span>}
                            >
                              <details class="detailsCell">
                                <summary>View</summary>
                                <pre>{play.comments}</pre>
                              </details>
                            </Show>
                          </td>
                          <td>
                            <Show
                              when={play.usercomment}
                              fallback={<span class="muted">—</span>}
                            >
                              <details class="detailsCell">
                                <summary>View</summary>
                                <pre>{play.usercomment}</pre>
                              </details>
                            </Show>
                          </td>
                          <td>
                            <details class="detailsCell">
                              <summary>View</summary>
                              <pre>{JSON.stringify(play.raw, null, 2)}</pre>
                            </details>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </section>
      </main>
    </div>
  )
}

export default App
