import { For, Show } from 'solid-js'
import type { BggPlay } from './bgg'
import type { PlaysView as PlaysViewMode } from './appNav'
import type { PlaysByGameRow } from './playsHelpers'
import GameLink from './components/GameLink'
import GameOptionsButton from './components/GameOptionsButton'
import { findGameTabForOptions } from './gameOptionsLookup'
import {
  bggPlayUrl,
  getBggPlayerResult,
  getOtherPlayersSummary,
  getPlayerColorForUser,
  getPlayerResultForUser,
} from './playsHelpers'

type PagerProps = {
  page: number
  pageDraft: string
  currentTotalPages: number
  onPageDraftInput: (value: string) => void
  onGoToPage: (page: number) => void
}

type PlaysPanelProps = {
  username: string
  playsView: PlaysViewMode
  bggAuthToken: string
  totalPlayCount: number
  pagedPlays: BggPlay[]
  playsByGame: PlaysByGameRow[]
  thumbnailsByObjectId: ReadonlyMap<string, string>
  drilldownTitle?: string
  drilldownPlaysCount: number
  drilldownPagedPlays: BggPlay[]
  selectedGameName?: string
  selectedGameMostRecentDate?: string
  selectedGamePlayCount: number
  selectedGamePagedPlays: BggPlay[]
  playTimeDisplay: (play: BggPlay) => string
  onOpenGame: (gameKey: string) => void
  onOpenGameOptions: (gameId: string) => void
  onOpenPlayGame: (play: BggPlay) => void
}

function PlaysTable(props: {
  plays: BggPlay[]
  playTimeDisplay: (play: BggPlay) => string
  onOpenPlayGame?: (play: BggPlay) => void
}) {
  return (
    <div class="tableWrap">
      <table class="table mobileCardTable">
        <thead>
          <tr>
            <th>Link</th>
            <th>Play</th>
            <th>Date</th>
            <th>Game</th>
            <th>Qty</th>
            <th>Play time</th>
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
          <For each={props.plays}>
            {(play) => (
              <tr>
                <td class="mono" data-label="Link">
                  <a href={bggPlayUrl(play.id)} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </td>
                <td class="mono" data-label="Play">
                  {play.id}
                </td>
                <td class="mono" data-label="Date">
                  {play.attributes.date || ''}
                </td>
                <td data-label="Game">
                  <Show
                    when={props.onOpenPlayGame}
                    fallback={
                      <>
                        <div>{play.item?.attributes.name || ''}</div>
                        <div class="muted mono">
                          {play.item?.attributes.objecttype || 'thing'} #
                          {play.item?.attributes.objectid || ''}
                        </div>
                      </>
                    }
                  >
                    {(openPlayGame) => (
                      <>
                        <button
                          class="gameButtonInline"
                          type="button"
                          onClick={() => openPlayGame()(play)}
                        >
                          {play.item?.attributes.name || ''}
                        </button>
                        <div class="muted mono">
                          {play.item?.attributes.objecttype || 'thing'} #
                          {play.item?.attributes.objectid || ''}
                        </div>
                      </>
                    )}
                  </Show>
                </td>
                <td class="mono" data-label="Qty">
                  {play.attributes.quantity || ''}
                </td>
                <td class="mono" data-label="Play time">
                  {props.playTimeDisplay(play)}
                </td>
                <td data-label="Location">{play.attributes.location || ''}</td>
                <td class="mono" data-label="Incomplete">
                  {play.attributes.incomplete || ''}
                </td>
                <td class="mono" data-label="Now in Stats">
                  {play.attributes.nowinstats || ''}
                </td>
                <td data-label="Players">
                  <div class="players">
                    <For each={play.players}>
                      {(player) => {
                        const name =
                          player.attributes.username || player.attributes.name || 'Unknown'
                        const score = player.attributes.score
                          ? ` score:${player.attributes.score}`
                          : ''
                        const result = getBggPlayerResult(player.attributes)
                        const winLoss = result ? ` ${result.toLowerCase()}` : ''
                        return (
                          <div class="mono">
                            {name}
                            {score}
                            {winLoss}
                          </div>
                        )
                      }}
                    </For>
                  </div>
                </td>
                <td data-label="Comments">
                  <Show when={play.comments} fallback={<span class="muted">—</span>}>
                    <details class="detailsCell">
                      <summary>View</summary>
                      <pre>{play.comments}</pre>
                    </details>
                  </Show>
                </td>
                <td data-label="User Comment">
                  <Show when={play.usercomment} fallback={<span class="muted">—</span>}>
                    <details class="detailsCell">
                      <summary>View</summary>
                      <pre>{play.usercomment}</pre>
                    </details>
                  </Show>
                </td>
                <td data-label="Raw">
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
  )
}

export function PlaysPager(props: PagerProps) {
  return (
    <div class="pager">
      <button onClick={() => props.onGoToPage(props.page - 1)} disabled={props.page <= 1}>
        Prev
      </button>

      <div class="pagerCenter">
        <span class="muted">Page</span>
        <input
          class="pageInput"
          inputmode="numeric"
          type="number"
          min="1"
          max={props.currentTotalPages}
          value={props.pageDraft}
          onInput={(e) => props.onPageDraftInput(e.currentTarget.value)}
        />
        <span class="muted">
          / <span class="mono">{props.currentTotalPages}</span>
        </span>
        <button onClick={() => props.onGoToPage(Number(props.pageDraft))}>Go</button>
      </div>

      <button
        onClick={() => props.onGoToPage(props.page + 1)}
        disabled={props.page >= props.currentTotalPages}
      >
        Next
      </button>
    </div>
  )
}

export default function PlaysView(props: PlaysPanelProps) {
  return (
    <>
      <Show when={props.playsView !== 'byGame'}>
        <div class="muted">
          <span class="mono">*</span> Estimated from BGG average play time when length is missing.
        </div>
      </Show>

      <Show when={props.playsView === 'plays'}>
        <div class="meta">
          Total plays: <span class="mono">{props.totalPlayCount.toLocaleString()}</span>
        </div>

        <PlaysTable
          plays={props.pagedPlays}
          playTimeDisplay={props.playTimeDisplay}
          onOpenPlayGame={props.onOpenPlayGame}
        />
      </Show>

      <Show when={props.playsView === 'byGame'}>
        <div class="meta">
          Games: <span class="mono">{props.playsByGame.length.toLocaleString()}</span>
          {' • '}
          Total plays: <span class="mono">{props.totalPlayCount.toLocaleString()}</span>
          <Show when={!props.bggAuthToken}>
            {' • '}
            <span class="muted">
              Set <span class="mono">BGG_TOKEN</span> in <span class="mono">.env</span> to load
              thumbnails
            </span>
          </Show>
        </div>

        <div class="tableWrap">
          <table class="table tableCompact mobileCardTable">
            <thead>
              <tr>
                <th>Game</th>
                <th>Total plays</th>
                <th>Most recent</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.playsByGame}>
                {(row) => (
                  <tr>
                    <td data-label="Game">
                      <div class="gameRow">
                        <Show when={row.objectid ? props.thumbnailsByObjectId.get(row.objectid) : undefined}>
                          {(thumbnail) => (
                            <img class="gameThumb" src={thumbnail()} alt="" loading="lazy" />
                          )}
                        </Show>

                        <div class="gameInfo">
                          <div class="gameTitleRow">
                            <GameLink label={row.name} gameKey={row.key} onOpenGame={props.onOpenGame} />
                            <Show when={findGameTabForOptions({ name: row.name, objectId: row.objectid || null })}>
                              {(gameId) => (
                                <GameOptionsButton
                                  gameId={gameId()}
                                  gameLabel={row.name}
                                  onOpenGameOptions={props.onOpenGameOptions}
                                />
                              )}
                            </Show>
                          </div>
                          <Show when={row.objectid} fallback={<span class="muted mono">—</span>}>
                            <div class="muted mono">
                              {row.objecttype || 'thing'} #{row.objectid}
                            </div>
                          </Show>
                        </div>
                      </div>
                    </td>
                    <td class="mono" data-label="Total plays">
                      {row.plays.toLocaleString()}
                    </td>
                    <td class="mono" data-label="Most recent">
                      {row.mostRecentDate || '—'}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={props.playsView === 'drilldown'}>
        <div class="meta">
          Plays: <span class="mono">{props.drilldownPlaysCount.toLocaleString()}</span>
        </div>

        <div class="tableWrap">
          <table class="table mobileCardTable">
            <thead>
              <tr>
                <th>Link</th>
                <th>Date</th>
                <th>Play time</th>
                <th>{`Result (${props.username})`}</th>
                <th>{`Color (${props.username})`}</th>
                <th>Other Players</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.drilldownPagedPlays}>
                {(play) => (
                  <tr>
                    <td class="mono" data-label="Link">
                      <a href={bggPlayUrl(play.id)} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </td>
                    <td class="mono" data-label="Date">
                      {play.attributes.date || ''}
                    </td>
                    <td class="mono" data-label="Play time">
                      {props.playTimeDisplay(play)}
                    </td>
                    <td class="mono" data-label={`Result (${props.username})`}>
                      {getPlayerResultForUser(play, props.username) || '—'}
                    </td>
                    <td class="mono" data-label={`Color (${props.username})`}>
                      {getPlayerColorForUser(play, props.username) || '—'}
                    </td>
                    <td data-label="Other Players">
                      {getOtherPlayersSummary(play, props.username)}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={props.playsView === 'gameDetail'}>
        <div class="meta">
          Total plays: <span class="mono">{props.selectedGamePlayCount.toLocaleString()}</span>
          {' • '}
          Most recent: <span class="mono">{props.selectedGameMostRecentDate || '—'}</span>
        </div>

        <PlaysTable plays={props.selectedGamePagedPlays} playTimeDisplay={props.playTimeDisplay} />
      </Show>
    </>
  )
}
