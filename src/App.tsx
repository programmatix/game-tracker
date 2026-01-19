import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js'
import { fetchAllUserPlays, fetchThingSummary, type BggPlaysResponse } from './bgg'
import FinalGirlView from './games/final-girl/FinalGirlView'
import DeathMayDieView from './games/death-may-die/DeathMayDieView'
import MistfallView from './games/mistfall/MistfallView'
import SpiritIslandView from './games/spirit-island/SpiritIslandView'
import AchievementsView from './AchievementsView'
import { authUser, signOutUser } from './auth/auth'
import {
  fetchPinnedAchievementIds,
  savePinnedAchievementIds,
} from './achievements/pinsFirebase'
import type { PlaysDrilldownRequest } from './playsDrilldown'
import './App.css'

const USERNAME = 'stony82'
const PLAYS_PER_PAGE = 25
type MainTab =
  | 'finalGirl'
  | 'spiritIsland'
  | 'mistfall'
  | 'deathMayDie'
  | 'achievements'
  | 'plays'
type PlaysView = 'plays' | 'byGame' | 'gameDetail' | 'drilldown'

type PlaysDrilldownReturn = {
  mainTab: MainTab
  playsView: PlaysView
  selectedGameKey: string | null
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

function App() {
  const [page, setPage] = createSignal(1)
  const [pageDraft, setPageDraft] = createSignal(String(page()))
  const [mainTab, setMainTab] = createSignal<MainTab>('finalGirl')
  const [playsView, setPlaysView] = createSignal<PlaysView>('plays')
  const [selectedGameKey, setSelectedGameKey] = createSignal<string | null>(null)
  const [playsDrilldown, setPlaysDrilldown] = createSignal<PlaysDrilldownRequest | null>(null)
  const [playsDrilldownReturn, setPlaysDrilldownReturn] =
    createSignal<PlaysDrilldownReturn | null>(null)
  const bggAuthToken = createMemo(
    () => (import.meta.env.BGG_TOKEN || import.meta.env.VITE_BGG_TOKEN || '').trim(),
  )

  const [playsCache, setPlaysCache] = createSignal<PlaysCacheV1 | null>(readPlaysCache())
  const [playsError, setPlaysError] = createSignal<string | null>(null)
  const [isFetchingPlays, setIsFetchingPlays] = createSignal(false)
  const [pinnedAchievementIds, setPinnedAchievementIds] = createSignal(new Set<string>())

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
      const response = await fetchAllUserPlays(USERNAME, { authToken: bggAuthToken() })
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

  const mostRecentPlay = createMemo(() => {
    let best:
      | { date: string; name: string; objectid?: string; objecttype?: string }
      | undefined

    for (const play of allPlays().plays) {
      const date = play.attributes.date || ''
      if (!date) continue

      const name = play.item?.attributes.name || 'Unknown'
      const objectid = play.item?.attributes.objectid
      const objecttype = play.item?.attributes.objecttype

      if (!best || compareIsoDatesDesc(date, best.date) < 0) {
        best = { date, name, objectid, objecttype }
      }
    }

    return best
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
              noteThumbnail(objectid, thing.thumbnail)
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

  function openPlaysDrilldown(request: PlaysDrilldownRequest) {
    setPlaysDrilldownReturn({
      mainTab: mainTab(),
      playsView: playsView(),
      selectedGameKey: selectedGameKey(),
    })
    setPlaysDrilldown(request)
    setSelectedGameKey(null)
    setPlaysView('drilldown')
    setMainTab('plays')
    resetPage()
  }

  function closePlaysDrilldown() {
    const back = playsDrilldownReturn()
    setPlaysDrilldown(null)
    setPlaysDrilldownReturn(null)

    if (back) {
      setMainTab(back.mainTab)
      setPlaysView(back.playsView)
      setSelectedGameKey(back.selectedGameKey)
      resetPage()
      return
    }

    setPlaysView('plays')
    resetPage()
  }

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

      <main class="main">
        <section class="panel">
          <div class="panelHeader">
            <h2>Profile</h2>
          </div>

          <div class="profile">
            <dl class="kv">
              <div class="kvRow">
                <dt>User</dt>
                <dd class="mono">{allPlays().username || USERNAME}</dd>
              </div>
              <div class="kvRow">
                <dt>User ID</dt>
                <dd class="mono">{allPlays().userid || '—'}</dd>
              </div>
              <div class="kvRow">
                <dt>Total plays</dt>
                <dd class="mono">{totalPlayCount().toLocaleString()}</dd>
              </div>
              <div class="kvRow">
                <dt>Most recent play</dt>
                <dd class="mono">
                  <Show when={mostRecentPlay()} fallback={'—'}>
                    {(recent) => (
                      <>
                        {recent().date} — {recent().name}
                      </>
                    )}
                  </Show>
                </dd>
              </div>
            </dl>
            <details class="details">
              <summary>Raw plays document</summary>
              <pre>{JSON.stringify(allPlays().raw, null, 2)}</pre>
            </details>
          </div>
        </section>

        <section class="panel">
          <div class="panelHeader playsHeader">
            <div class="panelHeaderLeft">
              <h2>Views</h2>
              <div class="tabs" role="tablist" aria-label="Views">
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'finalGirl' }}
                  onClick={() => setMainTab('finalGirl')}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'finalGirl'}
                >
                  Final Girl
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'spiritIsland' }}
                  onClick={() => setMainTab('spiritIsland')}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'spiritIsland'}
                >
                  Spirit Island
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'mistfall' }}
                  onClick={() => setMainTab('mistfall')}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'mistfall'}
                >
                  Mistfall
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'deathMayDie' }}
                  onClick={() => setMainTab('deathMayDie')}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'deathMayDie'}
                >
                  Death May Die
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'achievements' }}
                  onClick={() => setMainTab('achievements')}
                  type="button"
                  role="tab"
                  aria-selected={mainTab() === 'achievements'}
                >
                  Achievements
                </button>
                <button
                  class="tabButton"
                  classList={{ tabButtonActive: mainTab() === 'plays' }}
                  onClick={() => setMainTab('plays')}
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
                          setPlaysView('plays')
                          setSelectedGameKey(null)
                          setPlaysDrilldown(null)
                          resetPage()
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
                          setPlaysView('byGame')
                          setSelectedGameKey(null)
                          setPlaysDrilldown(null)
                          resetPage()
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
                          closePlaysDrilldown()
                        } else {
                          setPlaysView('byGame')
                          setSelectedGameKey(null)
                          resetPage()
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

          <Show when={mainTab() === 'finalGirl'}>
            <FinalGirlView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'spiritIsland'}>
            <SpiritIslandView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
              pinnedAchievementIds={pinnedAchievementIds()}
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
              onTogglePin={toggleAchievementPin}
              onOpenPlays={openPlaysDrilldown}
            />
          </Show>

          <Show when={mainTab() === 'achievements'}>
            <AchievementsView
              plays={allPlays().plays}
              username={USERNAME}
              pinnedAchievementIds={pinnedAchievementIds()}
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
                          <td class="mono">{play.id}</td>
                          <td class="mono">{play.attributes.date || ''}</td>
                          <td>
                            <button
                              class="gameButtonInline"
                              type="button"
                              onClick={() => {
                                setSelectedGameKey(gameKeyFromPlay(play))
                                setPlaysView('gameDetail')
                                resetPage()
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
                          <td class="mono">{play.attributes.length || ''}</td>
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
                      <th>Date</th>
                      <th>Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={drilldownPagedPlays()}>
                      {(play) => (
                        <tr>
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
                          <td class="mono">{play.attributes.length || ''}</td>
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
