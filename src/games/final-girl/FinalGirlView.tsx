import { For, Show, createMemo } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments } from '../../bgstats'
import { incrementCount, sortKeysByCountDesc } from '../../stats'

const FINAL_GIRL_OBJECT_ID = '277659'

type FinalGirlEntry = {
  play: BggPlay
  villain: string
  location: string
  finalGirl: string
}

function CountTable(props: { title: string; counts: Record<string, number> }) {
  const keys = createMemo(() => sortKeysByCountDesc(props.counts))
  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title}</h3>
      <div class="tableWrap compact">
        <table class="table compactTable">
          <thead>
            <tr>
              <th>Name</th>
              <th class="mono">Plays</th>
            </tr>
          </thead>
          <tbody>
            <For each={keys()}>
              {(key) => (
                <tr>
                  <td>{key}</td>
                  <td class="mono">{(props.counts[key] ?? 0).toLocaleString()}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function FinalGirlView(props: { plays: BggPlay[]; username: string }) {
  const entries = createMemo<FinalGirlEntry[]>(() => {
    const result: FinalGirlEntry[] = []
    const user = props.username.toLowerCase()

    for (const play of props.plays) {
      const objectid = play.item?.attributes.objectid || ''
      const name = play.item?.attributes.name || ''
      const isFinalGirl = objectid === FINAL_GIRL_OBJECT_ID || name === 'Final Girl'
      if (!isFinalGirl) continue

      const player = play.players.find(
        (p) => (p.attributes.username || '').toLowerCase() === user,
      )
      const color = player?.attributes.color || ''
      const parsed = parseBgStatsKeyValueSegments(color)

      const villain = getBgStatsValue(parsed, ['V', 'Villain']) || 'Unknown villain'
      const location = getBgStatsValue(parsed, ['L', 'Location']) || 'Unknown location'
      const finalGirl = getBgStatsValue(parsed, ['FG', 'Final Girl', 'FinalGirl']) || 'Unknown'

      result.push({ play, villain, location, finalGirl })
    }
    return result
  })

  const villainCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.villain)
    return counts
  })

  const locationCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.location)
    return counts
  })

  const finalGirlCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.finalGirl)
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.villain] ||= {}
      incrementCount(counts[entry.villain]!, entry.location)
    }
    return counts
  })

  const matrixRows = createMemo(() => sortKeysByCountDesc(villainCounts()))
  const matrixCols = createMemo(() => sortKeysByCountDesc(locationCounts()))

  return (
    <div class="finalGirl">
      <div class="meta">
        Final Girl plays in dataset:{' '}
        <span class="mono">{entries().length.toLocaleString()}</span>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Final Girl plays found. For BG Stats tags, put values in the player{' '}
            <span class="mono">color</span> field like{' '}
            <span class="mono">V: …／L: …／FG: …</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable title="Villains" counts={villainCounts()} />
          <CountTable title="Locations" counts={locationCounts()} />
          <CountTable title="Final Girls" counts={finalGirlCounts()} />
        </div>

        <div class="statsBlock">
          <h3 class="statsTitle">Villain × Location</h3>
          <div class="tableWrap matrixWrap">
            <table class="table matrixTable">
              <thead>
                <tr>
                  <th>Villain</th>
                  <For each={matrixCols()}>
                    {(col) => (
                      <th class="matrixHead">
                        <div class="matrixLabel">{col}</div>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={matrixRows()}>
                  {(row) => (
                    <tr>
                      <td class="matrixRowLabel">{row}</td>
                      <For each={matrixCols()}>
                        {(col) => (
                          <td class="mono matrixCell">
                            {(matrix()[row]?.[col] ?? 0) || '—'}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  )
}

