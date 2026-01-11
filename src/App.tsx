import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js'
import localPlaysXml from '../data.xml?raw'
import { parsePlaysXmlText } from './bgg'
import FinalGirlView from './games/final-girl/FinalGirlView'
import './App.css'

const USERNAME = 'stony82'
const PLAYS_PER_PAGE = 25
type MainTab = 'finalGirl' | 'plays'
type PlaysView = 'plays' | 'byGame'

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function App() {
  const [page, setPage] = createSignal(1)
  const [pageDraft, setPageDraft] = createSignal(String(page()))
  const [mainTab, setMainTab] = createSignal<MainTab>('finalGirl')
  const [playsView, setPlaysView] = createSignal<PlaysView>('plays')

  createEffect(() => setPageDraft(String(page())))

  const allPlays = createMemo(() => parsePlaysXmlText(localPlaysXml))
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
      { objectid?: string; objecttype?: string; name: string; plays: number }
    >()

    for (const play of allPlays().plays) {
      const objectid = play.item?.attributes.objectid
      const objecttype = play.item?.attributes.objecttype
      const name = play.item?.attributes.name || 'Unknown'
      const key = objectid ? `${objecttype || 'thing'}:${objectid}` : `name:${name}`

      const existing = groups.get(key)
      if (existing) {
        existing.plays += 1
      } else {
        groups.set(key, { objectid, objecttype, name, plays: 1 })
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays
      return a.name.localeCompare(b.name)
    })
  })

  const goToPage = (nextPage: number) => setPage(clamp(nextPage, 1, totalPages()))

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
          <div class="muted">Using local XML: <span class="mono">data.xml</span></div>
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
                <dt>Plays (from XML)</dt>
                <dd class="mono">{allPlays().plays.length.toLocaleString()}</dd>
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
                <div class="tabs" role="tablist" aria-label="Plays views">
                  <button
                    class="tabButton"
                    classList={{ tabButtonActive: playsView() === 'plays' }}
                    onClick={() => setPlaysView('plays')}
                    type="button"
                    role="tab"
                    aria-selected={playsView() === 'plays'}
                  >
                    All plays
                  </button>
                  <button
                    class="tabButton"
                    classList={{ tabButtonActive: playsView() === 'byGame' }}
                    onClick={() => setPlaysView('byGame')}
                    type="button"
                    role="tab"
                    aria-selected={playsView() === 'byGame'}
                  >
                    By game
                  </button>
                </div>
              </Show>
            </div>

            <Show when={mainTab() === 'plays' && playsView() === 'plays'}>
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
                    max={totalPages()}
                    value={pageDraft()}
                    onInput={(e) => setPageDraft(e.currentTarget.value)}
                  />
                  <span class="muted">
                    / <span class="mono">{totalPages()}</span>
                  </span>
                  <button onClick={() => goToPage(Number(pageDraft()))}>Go</button>
                </div>

                <button
                  onClick={() => goToPage(page() + 1)}
                  disabled={page() >= totalPages()}
                >
                  Next
                </button>
              </div>
            </Show>
          </div>

          <Show when={mainTab() === 'finalGirl'}>
            <FinalGirlView plays={allPlays().plays} username={USERNAME} />
          </Show>

          <Show when={mainTab() === 'plays'}>
            <Show
              when={playsView() === 'plays'}
              fallback={
                <>
                  <div class="meta">
                    Games:{' '}
                    <span class="mono">{playsByGame().length.toLocaleString()}</span>
                    {' • '}
                    Total plays:{' '}
                    <span class="mono">{allPlays().plays.length.toLocaleString()}</span>
                  </div>

                  <div class="tableWrap">
                    <table class="table tableCompact">
                      <thead>
                        <tr>
                          <th>Game</th>
                          <th>Total plays</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={playsByGame()}>
                          {(row) => (
                            <tr>
                              <td>
                                <div>{row.name}</div>
                                <Show
                                  when={row.objectid}
                                  fallback={<span class="muted mono">—</span>}
                                >
                                  <div class="muted mono">
                                    {row.objecttype || 'thing'} #{row.objectid}
                                  </div>
                                </Show>
                              </td>
                              <td class="mono">{row.plays.toLocaleString()}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </>
              }
            >
              <div class="meta">
                Total plays:{' '}
                <span class="mono">{allPlays().plays.length.toLocaleString()}</span>
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
