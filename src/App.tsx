import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js'
import localPlaysXml from '../data.xml?raw'
import { fetchThingSummary, parsePlaysXmlText } from './bgg'
import FinalGirlView from './games/final-girl/FinalGirlView'
import DeathMayDieView from './games/death-may-die/DeathMayDieView'
import MistfallView from './games/mistfall/MistfallView'
import SpiritIslandView from './games/spirit-island/SpiritIslandView'
import { authUser, signOutUser } from './auth/auth'
import './App.css'

const USERNAME = 'stony82'
const PLAYS_PER_PAGE = 25
const BGG_AUTH_TOKEN_STORAGE_KEY = 'bggAuthToken'
type MainTab = 'finalGirl' | 'spiritIsland' | 'deathMayDie' | 'mistfall' | 'plays'
type PlaysView = 'plays' | 'byGame' | 'gameDetail'

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

function App() {
  const [page, setPage] = createSignal(1)
  const [pageDraft, setPageDraft] = createSignal(String(page()))
  const [mainTab, setMainTab] = createSignal<MainTab>('finalGirl')
  const [playsView, setPlaysView] = createSignal<PlaysView>('plays')
  const [selectedGameKey, setSelectedGameKey] = createSignal<string | null>(null)
  const [bggAuthToken, setBggAuthToken] = createSignal(
    localStorage.getItem(BGG_AUTH_TOKEN_STORAGE_KEY) || '',
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
    localStorage.setItem(BGG_AUTH_TOKEN_STORAGE_KEY, bggAuthToken())
  })

  const allPlays = createMemo(() => parsePlaysXmlText(localPlaysXml))
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
              const authToken = bggAuthToken().trim()
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
    thumbnailsEnabled = playsView() === 'byGame' && Boolean(bggAuthToken().trim())
    if (!thumbnailsEnabled) return

    const ids = playsByGame()
      .map((row) => row.objectid)
      .filter((id): id is string => Boolean(id))

    enqueueThumbnails(ids)
  })

  const currentTotalPages = createMemo(() =>
    playsView() === 'gameDetail' ? selectedGameTotalPages() : totalPages(),
  )

  const goToPage = (nextPage: number) => setPage(clamp(nextPage, 1, currentTotalPages()))
  const resetPage = () => {
    setPage(1)
    setPageDraft('1')
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
          <div class="muted">Using local XML: <span class="mono">data.xml</span></div>
          <label class="tokenRow">
            <span class="muted">BGG token</span>
            <input
              class="tokenInput mono"
              type="password"
              placeholder="(optional)"
              value={bggAuthToken()}
              onInput={(e) => setBggAuthToken(e.currentTarget.value)}
              autocomplete="off"
            />
            <button
              class="linkButton"
              type="button"
              onClick={() => setBggAuthToken('')}
              disabled={!bggAuthToken()}
              title="Clear token"
            >
              Clear
            </button>
          </label>
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
                  when={playsView() === 'gameDetail'}
                  fallback={
                    <div class="tabs" role="tablist" aria-label="Plays views">
                      <button
                        class="tabButton"
                        classList={{ tabButtonActive: playsView() === 'plays' }}
                        onClick={() => {
                          setPlaysView('plays')
                          setSelectedGameKey(null)
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
                        setPlaysView('byGame')
                        setSelectedGameKey(null)
                        resetPage()
                      }}
                    >
                      ← Back
                    </button>
                    <div class="mono">{selectedGame()?.name || 'Game'}</div>
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
            <FinalGirlView plays={allPlays().plays} username={USERNAME} authToken={bggAuthToken()} />
          </Show>

          <Show when={mainTab() === 'spiritIsland'}>
            <SpiritIslandView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
            />
          </Show>

          <Show when={mainTab() === 'mistfall'}>
            <MistfallView plays={allPlays().plays} username={USERNAME} authToken={bggAuthToken()} />
          </Show>

          <Show when={mainTab() === 'deathMayDie'}>
            <DeathMayDieView
              plays={allPlays().plays}
              username={USERNAME}
              authToken={bggAuthToken()}
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
                <Show when={!bggAuthToken().trim()}>
                  {' • '}
                  <span class="muted">Add BGG token to load thumbnails</span>
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
