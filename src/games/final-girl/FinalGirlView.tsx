import { For, Show, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments } from '../../bgstats'
import { incrementCount, sortKeysByCountDesc } from '../../stats'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import ownedContentText from './content.txt?raw'
import {
  isOwnedFinalGirlLocation,
  isOwnedFinalGirlVillain,
  parseOwnedFinalGirlContent,
} from './ownedContent'

const FINAL_GIRL_OBJECT_ID = '277659'

type FinalGirlEntry = {
  play: BggPlay
  villain: string
  location: string
  finalGirl: string
}

const ownedContent = parseOwnedFinalGirlContent(ownedContentText)

function CountTable(props: {
  title: string
  counts: Record<string, number>
  isOwned?: (key: string) => boolean
}) {
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
                <tr
                  classList={{
                    dimRow: props.isOwned ? !(props.isOwned(key) ?? true) : false,
                  }}
                >
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
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [hideCounts, setHideCounts] = createSignal(true)
  const [ownedVillainsOnly, setOwnedVillainsOnly] = createSignal(false)
  const [ownedLocationsOnly, setOwnedLocationsOnly] = createSignal(false)

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

  const displayEntries = createMemo(() => {
    const filterVillains = ownedVillainsOnly() && ownedContent.ownedVillains.size > 0
    const filterLocations = ownedLocationsOnly() && ownedContent.ownedLocations.size > 0

    if (!filterVillains && !filterLocations) return entries()

    return entries().filter((entry) => {
      if (filterVillains && !isOwnedFinalGirlVillain(ownedContent, entry.villain)) return false
      if (filterLocations && !isOwnedFinalGirlLocation(ownedContent, entry.location)) return false
      return true
    })
  })

  const villainCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) incrementCount(counts, entry.villain)
    return counts
  })

  const locationCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) incrementCount(counts, entry.location)
    return counts
  })

  const finalGirlCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) incrementCount(counts, entry.finalGirl)
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of displayEntries()) {
      counts[entry.villain] ||= {}
      incrementCount(counts[entry.villain]!, entry.location)
    }
    return counts
  })

  const matrixRows = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(locationCounts()) : sortKeysByCountDesc(villainCounts()),
  )
  const matrixCols = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(villainCounts()) : sortKeysByCountDesc(locationCounts()),
  )

  const matrixMax = createMemo(() => {
    let max = 0
    const rows = matrixRows()
    const cols = matrixCols()
    for (const row of rows) {
      for (const col of cols) {
        const value = flipAxes()
          ? (matrix()[col]?.[row] ?? 0)
          : (matrix()[row]?.[col] ?? 0)
        if (value > max) max = value
      }
    }
    return max
  })

  return (
    <div class="finalGirl">
      <div class="meta">
        Final Girl plays in dataset: <span class="mono">{entries().length.toLocaleString()}</span>
        {' • '}Showing: <span class="mono">{displayEntries().length.toLocaleString()}</span>
        {' • '}Owned villains: <span class="mono">{ownedContent.ownedVillains.size}</span>
        {' • '}Owned locations: <span class="mono">{ownedContent.ownedLocations.size}</span>
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
          <CountTable
            title="Villains"
            counts={villainCounts()}
            isOwned={(villain) => isOwnedFinalGirlVillain(ownedContent, villain)}
          />
          <CountTable
            title="Locations"
            counts={locationCounts()}
            isOwned={(location) => isOwnedFinalGirlLocation(ownedContent, location)}
          />
          <CountTable title="Final Girls" counts={finalGirlCounts()} />
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">Villain × Location</h3>
            <div class="finalGirlControls">
              <label class="control">
                <input
                  type="checkbox"
                  checked={ownedVillainsOnly()}
                  disabled={ownedContent.ownedVillains.size === 0}
                  onInput={(e) => setOwnedVillainsOnly(e.currentTarget.checked)}
                />
                Owned villains only
              </label>
              <label class="control">
                <input
                  type="checkbox"
                  checked={ownedLocationsOnly()}
                  disabled={ownedContent.ownedLocations.size === 0}
                  onInput={(e) => setOwnedLocationsOnly(e.currentTarget.checked)}
                />
                Owned locations only
              </label>
              <label class="control">
                <input
                  type="checkbox"
                  checked={flipAxes()}
                  onInput={(e) => setFlipAxes(e.currentTarget.checked)}
                />
                Flip axes
              </label>
              <label class="control">
                <input
                  type="checkbox"
                  checked={hideCounts()}
                  onInput={(e) => setHideCounts(e.currentTarget.checked)}
                />
                Hide count
              </label>
            </div>
          </div>
          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            maxCount={matrixMax()}
            hideCounts={hideCounts()}
            rowHeader={flipAxes() ? 'Location' : 'Villain'}
            colHeader={flipAxes() ? 'Villain' : 'Location'}
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
          />
        </div>
      </Show>
    </div>
  )
}
