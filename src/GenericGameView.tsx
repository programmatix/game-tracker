import { For, Show, createMemo } from 'solid-js'
import type { BggPlay } from './bgg'
import { getConfigurableGameDefinition } from './configurableGames'
import {
  findConfigurableGameIdForOptions,
  getConfigurableGameMatchDefinition,
} from './configurableGameMatching'
import type { PlaysDrilldownRequest } from './playsDrilldown'
import { purchaseGameFamilyById } from './purchaseGameFamilies'
import {
  compareIsoDatesDesc,
  getOtherPlayersSummary,
  getPlayerColorForUser,
  getPlayerResultForUser,
  playQuantity,
} from './playsHelpers'

type MatchedBggEntry = {
  key: string
  name: string
  objectid?: string
  objecttype?: string
  plays: number
  mostRecentDate?: string
}

const poundsFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

function summarizeUserResult(play: BggPlay, username: string): string {
  const result = getPlayerResultForUser(play, username)
  const color = getPlayerColorForUser(play, username).trim()
  return [result, color].filter(Boolean).join(' • ') || '—'
}

export default function GenericGameView(props: {
  gameId: string
  plays: BggPlay[]
  username: string
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const gameDefinition = createMemo(() => getConfigurableGameDefinition(props.gameId))
  const purchaseFamily = createMemo(() => purchaseGameFamilyById.get(props.gameId))
  const matchDefinition = createMemo(() => getConfigurableGameMatchDefinition(props.gameId))

  const matchedPlays = createMemo(() =>
    props.plays.filter(
      (play) =>
        findConfigurableGameIdForOptions({
          name: play.item?.attributes.name || null,
          objectId: play.item?.attributes.objectid || null,
        }) === props.gameId,
    ),
  )

  const totalMatchedPlays = createMemo(() =>
    matchedPlays().reduce((sum, play) => sum + playQuantity(play), 0),
  )

  const matchedPlayIds = createMemo(() => matchedPlays().map((play) => play.id))

  const mostRecentDate = createMemo(() => {
    const dates = matchedPlays()
      .map((play) => play.attributes.date || '')
      .filter(Boolean)
      .sort(compareIsoDatesDesc)
    return dates[0] || undefined
  })

  const seenPlayers = createMemo(() => {
    const names = new Set<string>()

    for (const play of matchedPlays()) {
      for (const player of play.players) {
        const username = (player.attributes.username || '').trim()
        const name = (player.attributes.name || '').trim()
        if (username) {
          names.add(username)
          continue
        }
        if (name) names.add(name)
      }
    }

    return [...names].sort((left, right) => left.localeCompare(right))
  })

  const matchedEntries = createMemo<MatchedBggEntry[]>(() => {
    const entries = new Map<string, MatchedBggEntry>()

    for (const play of matchedPlays()) {
      const name = play.item?.attributes.name || gameDefinition().label
      const objectid = play.item?.attributes.objectid || undefined
      const objecttype = play.item?.attributes.objecttype || undefined
      const key = objectid ? `${objecttype || 'thing'}:${objectid}` : `name:${name}`
      const quantity = playQuantity(play)
      const date = play.attributes.date || undefined
      const existing = entries.get(key)

      if (existing) {
        existing.plays += quantity
        if (date && compareIsoDatesDesc(date, existing.mostRecentDate) < 0) {
          existing.mostRecentDate = date
        }
        continue
      }

      entries.set(key, {
        key,
        name,
        objectid,
        objecttype,
        plays: quantity,
        mostRecentDate: date,
      })
    }

    return [...entries.values()].sort((left, right) => {
      if (right.plays !== left.plays) return right.plays - left.plays
      return left.name.localeCompare(right.name)
    })
  })

  const recentPlays = createMemo(() =>
    [...matchedPlays()]
      .sort((left, right) => compareIsoDatesDesc(left.attributes.date, right.attributes.date))
      .slice(0, 12),
  )

  const aliases = createMemo(() => {
    const label = gameDefinition().label.trim().toLowerCase()
    return (matchDefinition()?.aliases || []).filter((alias) => alias.trim().toLowerCase() !== label)
  })

  return (
    <div class="gameView">
      <div class="gameMetaRow">
        <div class="gameMeta">
          <div class="metaTitleRow">
            <h2 class="metaTitle">{gameDefinition().label}</h2>
            <div class="metaPlays">{totalMatchedPlays().toLocaleString()} tracked plays</div>
          </div>

          <div class="meta">Generic tab view for games that do not have a dedicated page yet.</div>

          <dl class="kv">
            <div class="kvRow">
              <dt>Game id</dt>
              <dd class="mono">{props.gameId}</dd>
            </div>

            <Show when={purchaseFamily()}>
              {(family) => (
                <>
                  <div class="kvRow">
                    <dt>Purchase family</dt>
                    <dd>{family().spreadsheetFamily}</dd>
                  </div>
                  <div class="kvRow">
                    <dt>Purchase price</dt>
                    <dd>{poundsFormatter.format(family().price)}</dd>
                  </div>
                </>
              )}
            </Show>

            <Show when={matchDefinition()?.objectIds.length}>
              <div class="kvRow">
                <dt>BGG object ids</dt>
                <dd class="mono">{matchDefinition()!.objectIds.join(', ')}</dd>
              </div>
            </Show>

            <Show when={aliases().length}>
              <div class="kvRow">
                <dt>Known aliases</dt>
                <dd>{aliases().join(', ')}</dd>
              </div>
            </Show>
          </dl>
        </div>
      </div>

      <section class="statsBlock">
        <div class="statsTitleRow">
          <h3 class="statsTitle">Summary</h3>
          <Show when={matchedPlayIds().length > 0}>
            <button
              class="linkButton"
              type="button"
              onClick={() =>
                props.onOpenPlays({
                  title: gameDefinition().label,
                  playIds: matchedPlayIds(),
                })
              }
            >
              Open matched plays
            </button>
          </Show>
        </div>

        <dl class="kv">
          <div class="kvRow">
            <dt>Total plays</dt>
            <dd class="mono">{totalMatchedPlays().toLocaleString()}</dd>
          </div>
          <div class="kvRow">
            <dt>Most recent play</dt>
            <dd class="mono">{mostRecentDate() || '—'}</dd>
          </div>
          <div class="kvRow">
            <dt>Matched BGG entries</dt>
            <dd class="mono">{matchedEntries().length.toLocaleString()}</dd>
          </div>
          <div class="kvRow">
            <dt>Players seen</dt>
            <dd>{seenPlayers().join(', ') || '—'}</dd>
          </div>
        </dl>
      </section>

      <section class="statsBlock">
        <h3 class="statsTitle">Matched BGG entries</h3>

        <Show
          when={matchedEntries().length > 0}
          fallback={<div class="muted">No plays matched this game yet.</div>}
        >
          <div class="tableWrap compact">
            <table class="table compactTable mobileCardTable">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Total plays</th>
                  <th>Most recent</th>
                </tr>
              </thead>
              <tbody>
                <For each={matchedEntries()}>
                  {(entry) => (
                    <tr>
                      <td data-label="Entry">
                        <div>{entry.name}</div>
                        <div class="muted mono">
                          {entry.objectid ? `${entry.objecttype || 'thing'} #${entry.objectid}` : '—'}
                        </div>
                      </td>
                      <td class="mono" data-label="Total plays">
                        {entry.plays.toLocaleString()}
                      </td>
                      <td class="mono" data-label="Most recent">
                        {entry.mostRecentDate || '—'}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </section>

      <section class="statsBlock">
        <h3 class="statsTitle">Recent plays</h3>

        <Show
          when={recentPlays().length > 0}
          fallback={<div class="muted">No recent plays to show.</div>}
        >
          <div class="tableWrap compact">
            <table class="table compactTable mobileCardTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry</th>
                  <th>Qty</th>
                  <th>{`You (${props.username})`}</th>
                  <th>Others</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <For each={recentPlays()}>
                  {(play) => (
                    <tr>
                      <td class="mono" data-label="Date">
                        {play.attributes.date || '—'}
                      </td>
                      <td data-label="Entry">
                        <div>{play.item?.attributes.name || gameDefinition().label}</div>
                        <div class="muted mono">
                          {play.item?.attributes.objectid
                            ? `${play.item?.attributes.objecttype || 'thing'} #${play.item?.attributes.objectid}`
                            : '—'}
                        </div>
                      </td>
                      <td class="mono" data-label="Qty">
                        {playQuantity(play).toLocaleString()}
                      </td>
                      <td data-label={`You (${props.username})`}>
                        {summarizeUserResult(play, props.username)}
                      </td>
                      <td data-label="Others">{getOtherPlayersSummary(play, props.username)}</td>
                      <td data-label="Notes">
                        <Show
                          when={(play.comments || '').trim() || (play.usercomment || '').trim()}
                          fallback={<span class="muted">—</span>}
                        >
                          <details class="detailsCell">
                            <summary>Show</summary>
                            <pre>{(play.comments || play.usercomment || '').trim()}</pre>
                          </details>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </section>
    </div>
  )
}
