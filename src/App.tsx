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
import { authUser, signOutUser } from './auth/auth'
import {
  fetchAchievementStore,
  saveAchievementsSnapshot,
  saveSeenCompletedAchievementIds,
} from './achievements/achievementsFirebase'
import {
  fetchPinnedAchievementIds,
  savePinnedAchievementIds,
} from './achievements/pinsFirebase'
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
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from './playDuration'
import AppContent from './AppContent'
import {
  MAIN_TAB_GROUPS,
  MAIN_TAB_OPTIONS,
  type AppNavState,
  type MainTab,
  type PlaysView,
  hashForNavState,
  parseNavStateFromHash,
} from './appNav'
import {
  clamp,
  compareIsoDatesDesc,
  gameKeyFromPlay,
  groupPlaysByGame,
  hasRecordedPlayLength,
  isPlaysCacheFresh,
  playQuantity,
  readPlaysCache,
  type PlaysCacheV1,
  writePlaysCache,
} from './playsHelpers'
import { loadPurchaseSpreadsheet } from './purchaseSpreadsheet'
import './App.css'

const USERNAME = 'stony82'
const FEEDBACK_ADMIN_EMAIL = 'grahampople@gmail.com'
const PLAYS_PER_PAGE = 25
const PLAYS_CACHE_KEY = `bggPlaysCache:v1:${USERNAME}`
const PLAYS_CACHE_TTL_MS = 30 * 60 * 1000

type PlaysDrilldownReturn = {
  mainTab: MainTab
  playsView: PlaysView
  selectedGameKey: string | null
}

type AppHistoryState =
  | { kind: 'app'; nav: AppNavState }
  | { kind: 'drilldown'; navReturn: AppNavState; request: PlaysDrilldownRequest }

function App() {
  const parsedHash =
    typeof window === 'undefined' ? null : parseNavStateFromHash(window.location.hash)
  const initialMainTab: MainTab = parsedHash?.mainTab ?? 'monthlyChecklist'
  const initialPlaysView: PlaysView =
    initialMainTab === 'plays' ? (parsedHash?.playsView ?? 'plays') : 'plays'
  const initialSelectedGameKey: string | null =
    initialMainTab === 'plays' && initialPlaysView === 'gameDetail'
      ? (parsedHash?.selectedGameKey ?? null)
      : null

  const [page, setPage] = createSignal(1)
  const [pageDraft, setPageDraft] = createSignal('1')
  const [mainTab, setMainTab] = createSignal<MainTab>(initialMainTab)
  const [playsView, setPlaysView] = createSignal<PlaysView>(initialPlaysView)
  const [selectedGameKey, setSelectedGameKey] = createSignal<string | null>(initialSelectedGameKey)
  const [playsDrilldown, setPlaysDrilldown] = createSignal<PlaysDrilldownRequest | null>(null)
  const [playsDrilldownReturn, setPlaysDrilldownReturn] =
    createSignal<PlaysDrilldownReturn | null>(null)
  const [playsCache, setPlaysCache] = createSignal<PlaysCacheV1 | null>(readPlaysCache(PLAYS_CACHE_KEY))
  const [playsError, setPlaysError] = createSignal<string | null>(null)
  const [isFetchingPlays, setIsFetchingPlays] = createSignal(false)
  const [firebaseSaveErrorToast, setFirebaseSaveErrorToast] = createSignal<string | null>(null)
  const [pinnedAchievementIds, setPinnedAchievementIds] = createSignal(new Set<string>())
  const [seenCompletedAchievementIds, setSeenCompletedAchievementIds] = createSignal(
    new Set<string>(),
  )
  const [thumbnailsByObjectId, setThumbnailsByObjectId] = createSignal(new Map<string, string>())
  const [assumedMinutesByObjectId, setAssumedMinutesByObjectId] = createSignal(
    new Map<string, number>(),
  )

  const bggAuthToken = createMemo(
    () => (import.meta.env.BGG_TOKEN || import.meta.env.VITE_BGG_TOKEN || '').trim(),
  )
  const isFeedbackAdmin = createMemo(
    () => authUser()?.email?.toLowerCase() === FEEDBACK_ADMIN_EMAIL,
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

  const thingSummaryInFlight = new Set<string>()
  const thingSummaryFailed = new Set<string>()
  const thingSummaryResolved = new Set<string>()
  const queuedThingSummaryObjectIds = new Set<string>()
  let isThingSummaryPumpRunning = false
  let thumbnailsEnabled = true
  let firebaseSaveErrorToastTimeoutId: number | undefined
  let lastAchievementsSnapshotSavedAtMs = 0

  function showFirebaseSaveErrorToast(message: string) {
    setFirebaseSaveErrorToast(message)
    if (firebaseSaveErrorToastTimeoutId) {
      window.clearTimeout(firebaseSaveErrorToastTimeoutId)
    }
    firebaseSaveErrorToastTimeoutId = window.setTimeout(() => {
      setFirebaseSaveErrorToast(null)
      firebaseSaveErrorToastTimeoutId = undefined
    }, 5000)
  }

  createEffect(() => setPageDraft(String(page())))
  onCleanup(() => {
    if (firebaseSaveErrorToastTimeoutId) {
      window.clearTimeout(firebaseSaveErrorToastTimeoutId)
    }
  })

  createEffect(() => {
    const user = authUser()
    lastAchievementsSnapshotSavedAtMs = 0
    if (!user) {
      batch(() => {
        setPinnedAchievementIds(new Set<string>())
        setSeenCompletedAchievementIds(new Set<string>())
      })
      return
    }

    let cancelled = false
    void Promise.all([fetchPinnedAchievementIds(user), fetchAchievementStore(user)]).then(
      ([remotePinnedIds, store]) => {
        if (cancelled) return
        batch(() => {
          setPinnedAchievementIds(remotePinnedIds)
          setSeenCompletedAchievementIds(store.seenCompletedAchievementIds)
        })
      },
    )

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
    const shouldFetch = options?.force ? true : !isPlaysCacheFresh(cached, PLAYS_CACHE_TTL_MS)
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
      writePlaysCache(PLAYS_CACHE_KEY, nextCache)
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
  const suppressAvailableTrackIds = createMemo(() => new Set<string>(newlyUnlockedTrackIds()))
  const nextAchievementAfterDismiss = createMemo(() =>
    pickBestAvailableAchievementForTrackIds(allAchievements(), newlyUnlockedTrackIds()),
  )

  function dismissNewlyUnlockedAchievements() {
    const nextSeen = new Set(seenCompletedAchievementIds())
    for (const achievement of newlyUnlockedAchievements()) nextSeen.add(achievement.id)
    setSeenCompletedAchievementIds(nextSeen)
    const user = authUser()
    if (user) {
      void saveSeenCompletedAchievementIds(user, nextSeen).catch(() => {
        showFirebaseSaveErrorToast('Failed to save dismissed achievements to Firebase.')
      })
    }
  }

  createEffect(() => {
    const user = authUser()
    if (!user) return

    mainTab()
    playsView()
    const now = Date.now()
    if (now - lastAchievementsSnapshotSavedAtMs < 10 * 60 * 1000) return
    lastAchievementsSnapshotSavedAtMs = now
    void saveAchievementsSnapshot(user, allAchievements()).catch(() => {
      lastAchievementsSnapshotSavedAtMs = 0
      showFirebaseSaveErrorToast('Failed to save achievement snapshot to Firebase.')
    })
  })

  function toggleAchievementPin(achievementId: string) {
    const next = new Set(pinnedAchievementIds())
    if (next.has(achievementId)) next.delete(achievementId)
    else next.add(achievementId)
    setPinnedAchievementIds(next)
    const user = authUser()
    if (user) {
      void savePinnedAchievementIds(user, next).catch(() => {
        showFirebaseSaveErrorToast('Failed to save pinned achievements to Firebase.')
      })
    }
  }

  const pagedPlays = createMemo(() => {
    const start = (page() - 1) * PLAYS_PER_PAGE
    return allPlays().plays.slice(start, start + PLAYS_PER_PAGE)
  })
  const playsByGame = createMemo(() => groupPlaysByGame(allPlays().plays))
  const selectedGame = createMemo(() => {
    const key = selectedGameKey()
    if (!key) return undefined
    return playsByGame().find((row) => row.key === key)
  })
  const selectedGamePlays = createMemo(() => {
    const key = selectedGameKey()
    if (!key) return []
    return allPlays()
      .plays.filter((play) => gameKeyFromPlay(play) === key)
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

  function noteAssumedMinutes(objectid: string, minutes?: number) {
    if (!minutes || minutes <= 0) return
    if (assumedMinutesByObjectId().get(objectid) === minutes) return
    setAssumedMinutesByObjectId((prev) => {
      const next = new Map(prev)
      next.set(objectid, minutes)
      return next
    })
  }

  async function pumpThingSummaryQueue() {
    if (isThingSummaryPumpRunning) return
    isThingSummaryPumpRunning = true

    const MAX_CONCURRENT = 4
    try {
      while (queuedThingSummaryObjectIds.size > 0) {
        const shouldSkipThumbnailUpdates = !thumbnailsEnabled
        const batchIds: string[] = []

        for (const objectid of queuedThingSummaryObjectIds) {
          queuedThingSummaryObjectIds.delete(objectid)
          if (thingSummaryResolved.has(objectid)) continue
          if (thingSummaryInFlight.has(objectid)) continue
          if (thingSummaryFailed.has(objectid)) continue
          batchIds.push(objectid)
          if (batchIds.length >= MAX_CONCURRENT) break
        }

        if (batchIds.length === 0) break

        await Promise.allSettled(
          batchIds.map(async (objectid) => {
            thingSummaryInFlight.add(objectid)
            try {
              const authToken = bggAuthToken() || undefined
              const thing = await fetchThingSummary(objectid, { authToken })
              thingSummaryResolved.add(objectid)
              if (!shouldSkipThumbnailUpdates) {
                noteThumbnail(objectid, thing.image || thing.thumbnail)
              }
              noteAssumedMinutes(objectid, thingAssumedPlayTimeMinutes(thing.raw) ?? undefined)
            } catch {
              thingSummaryFailed.add(objectid)
            } finally {
              thingSummaryInFlight.delete(objectid)
            }
          }),
        )
      }
    } finally {
      isThingSummaryPumpRunning = false
    }
  }

  function enqueueThingSummaries(objectids: string[]) {
    for (const objectid of objectids) {
      if (!objectid) continue
      if (thingSummaryResolved.has(objectid)) continue
      if (thingSummaryInFlight.has(objectid)) continue
      if (thingSummaryFailed.has(objectid)) continue
      queuedThingSummaryObjectIds.add(objectid)
    }
    void pumpThingSummaryQueue()
  }

  createEffect(() => {
    thumbnailsEnabled = playsView() === 'byGame' && Boolean(bggAuthToken())
    if (!thumbnailsEnabled) return
    enqueueThingSummaries(
      playsByGame()
        .map((row) => row.objectid)
        .filter((id): id is string => Boolean(id)),
    )
  })

  const visiblePlaysMissingLength = createMemo(() => {
    const source =
      playsView() === 'gameDetail'
        ? selectedGamePagedPlays()
        : playsView() === 'drilldown'
          ? drilldownPagedPlays()
          : pagedPlays()

    return source.filter((play) => {
      if (hasRecordedPlayLength(play.attributes)) return false
      return Boolean(play.item?.attributes.objectid)
    })
  })

  createEffect(() => {
    enqueueThingSummaries(
      visiblePlaysMissingLength()
        .map((play) => play.item?.attributes.objectid || '')
        .filter(Boolean),
    )
  })

  createEffect(() => {
    if (mainTab() !== 'costs') return
    enqueueThingSummaries(
      allPlays()
        .plays.filter((play) => !hasRecordedPlayLength(play.attributes))
        .map((play) => play.item?.attributes.objectid || '')
        .filter(Boolean),
    )
  })

  function playTimeDisplay(play: {
    attributes: Record<string, string>
    item?: { attributes: Record<string, string> }
  }): string {
    const objectid = play.item?.attributes.objectid || ''
    const assumedMinutesPerPlay = objectid ? assumedMinutesByObjectId().get(objectid) : undefined
    const resolved = totalPlayMinutesWithAssumption({
      attributes: play.attributes,
      quantity: playQuantity(play),
      assumedMinutesPerPlay,
    })

    if (resolved.minutes <= 0) return hasRecordedPlayLength(play.attributes) ? '' : '*'
    const formatted = formatPlayLength(String(resolved.minutes))
    return resolved.assumed ? `*${formatted}` : formatted
  }

  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(allPlays().plays.length / PLAYS_PER_PAGE)),
  )
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

  const switchMainTab = (nextTab: MainTab) => {
    if (mainTab() === nextTab) return
    const next: AppNavState = { ...currentNavState(), mainTab: nextTab }
    setMainTab(nextTab)
    pushNavState(next)
  }

  const switchPlaysView = (nextView: Extract<PlaysView, 'plays' | 'byGame'>) => {
    if (playsView() === nextView) return
    setPlaysView(nextView)
    setSelectedGameKey(null)
    setPlaysDrilldown(null)
    resetPage()
    pushNavState({ mainTab: 'plays', playsView: nextView, selectedGameKey: null })
  }

  function openGameDetail(gameKey: string) {
    setSelectedGameKey(gameKey)
    setPlaysView('gameDetail')
    resetPage()
    pushNavState({
      mainTab: 'plays',
      playsView: 'gameDetail',
      selectedGameKey: gameKey,
    })
  }

  function openPlaysDrilldown(request: PlaysDrilldownRequest, options?: { pushHistory?: boolean }) {
    const returnState = currentNavState()
    batch(() => {
      setPlaysDrilldownReturn(returnState)
      setPlaysDrilldown(request)
      setSelectedGameKey(null)
      setMainTab('plays')
      setPlaysView('drilldown')
      resetPage()
    })

    if (options?.pushHistory === false) return

    const url = new URL(window.location.href)
    const previousUrl = url.toString()
    const drilldownUrl = new URL(previousUrl)
    drilldownUrl.hash = '#plays/drilldown'

    window.history.replaceState({ kind: 'app', nav: returnState } satisfies AppHistoryState, '', previousUrl)
    window.history.pushState(
      { kind: 'drilldown', navReturn: returnState, request } satisfies AppHistoryState,
      '',
      drilldownUrl.toString(),
    )
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
    void loadPurchaseSpreadsheet().catch((error) => {
      console.error('Failed to load purchase spreadsheet.', error)
    })

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
      <Show when={firebaseSaveErrorToast()}>
        {(message) => (
          <div class="toastStack" aria-live="polite" aria-atomic="true">
            <div class="toast toastError" role="status">
              {message()}
            </div>
          </div>
        )}
      </Show>

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
                  Last fetch: <span class="mono">{new Date(cached().fetchedAtMs).toLocaleString()}</span>
                </span>
              )}
            </Show>
          </div>
          <Show when={!bggAuthToken()}>
            <div class="muted">
              BGG token missing in <span class="mono">.env</span>
            </div>
          </Show>
          <Show when={playsError()}>{(message) => <div class="muted">Fetch error: {message()}</div>}</Show>
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
        <aside class="panel sidebarNav desktopOnly">
          <div class="sidebarNavHeader">
            <h2>Views</h2>
          </div>
          <div class="sidebarTabs">
            <For each={MAIN_TAB_GROUPS}>
              {(group) => (
                <section class="sidebarSection">
                  <div class="sidebarSectionLabel">{group.label}</div>
                  <div role="tablist" aria-label={`${group.label} views`}>
                    <For each={MAIN_TAB_OPTIONS.filter((option) => option.group === group.id)}>
                      {(option) => (
                        <button
                          class="tabButton sidebarTabButton"
                          classList={{ tabButtonActive: mainTab() === option.value }}
                          onClick={() => switchMainTab(option.value)}
                          type="button"
                          role="tab"
                          aria-selected={mainTab() === option.value}
                        >
                          {option.label}
                        </button>
                      )}
                    </For>
                  </div>
                </section>
              )}
            </For>
          </div>
        </aside>

        <section class="panel contentPanel">
          <AppContent
            mainTab={mainTab()}
            playsView={playsView()}
            username={USERNAME}
            authToken={bggAuthToken()}
            plays={allPlays().plays}
            pinnedAchievementIds={pinnedAchievementIds()}
            suppressAvailableAchievementTrackIds={suppressAvailableTrackIds()}
            onTogglePin={toggleAchievementPin}
            onOpenPlays={openPlaysDrilldown}
            spiritIslandSessions={spiritIslandSessionsValue()}
            spiritIslandSessionsLoading={spiritIslandSessions.loading}
            spiritIslandSessionsError={spiritIslandSessionsError()}
            assumedMinutesByObjectId={assumedMinutesByObjectId()}
            feedbackUser={authUser()}
            isFeedbackAdmin={isFeedbackAdmin()}
            page={page()}
            pageDraft={pageDraft()}
            currentTotalPages={currentTotalPages()}
            onPageDraftInput={setPageDraft}
            onGoToPage={goToPage}
            onClosePlaysDetail={() => {
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
            onSwitchPlaysView={switchPlaysView}
            onSwitchMainTab={switchMainTab}
            onOpenGame={openGameDetail}
            onOpenPlayGame={(play) => openGameDetail(gameKeyFromPlay(play))}
            playsByGame={playsByGame()}
            thumbnailsByObjectId={thumbnailsByObjectId()}
            totalPlayCount={totalPlayCount()}
            pagedPlays={pagedPlays()}
            selectedGameName={selectedGame()?.name}
            selectedGameMostRecentDate={selectedGame()?.mostRecentDate}
            selectedGamePlayCount={selectedGamePlayCount()}
            selectedGamePagedPlays={selectedGamePagedPlays()}
            drilldownTitle={playsDrilldown()?.title}
            drilldownPlaysCount={drilldownPlays().length}
            drilldownPagedPlays={drilldownPagedPlays()}
            playTimeDisplay={playTimeDisplay}
          />
        </section>
      </main>
    </div>
  )
}

export default App
