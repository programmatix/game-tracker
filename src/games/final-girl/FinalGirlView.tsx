import { For, Show, createEffect, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments } from '../../bgstats'
import { incrementCount, sortKeysByCountDesc } from '../../stats'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import ownedContentText from './content.txt?raw'
import {
  getOwnedFinalGirlLocations,
  getOwnedFinalGirlVillains,
  isOwnedFinalGirlLocation,
  isOwnedFinalGirlVillain,
  normalizeFinalGirlName,
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

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function readJsonRecordFromStorage(key: string): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) result[k] = v
    }
    return result
  } catch {
    return {}
  }
}

function writeJsonRecordToStorage(key: string, value: Record<string, number>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function CountTable(props: {
  title: string
  counts: Record<string, number>
  keys?: string[]
  isOwned?: (key: string) => boolean
  tracker?: {
    max: number
    getValue: (key: string) => number
    setValue: (key: string, value: number) => void
  }
}) {
  const keys = createMemo(() => props.keys ?? sortKeysByCountDesc(props.counts))
  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title}</h3>
      <div class="tableWrap compact">
        <table class="table compactTable">
          <thead>
            <tr>
              <th>Name</th>
              <th class="mono">Plays</th>
              <Show when={props.tracker}>
                <th class="mono trackerHead">Track</th>
              </Show>
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
                  <Show when={props.tracker}>
                    {(tracker) => {
                      const value = () => tracker().getValue(key)
                      return (
                        <td class="trackerCell">
                          <div class="trackerRow">
                            <button
                              type="button"
                              class="trackerBtn"
                              aria-label={`Decrease ${props.title} tracker for ${key}`}
                              onClick={() => tracker().setValue(key, value() - 1)}
                            >
                              –
                            </button>
                            <input
                              type="range"
                              min="0"
                              max={tracker().max}
                              value={value()}
                              class="trackerRange"
                              aria-label={`${props.title} tracker for ${key}`}
                              onInput={(e) =>
                                tracker().setValue(key, Number(e.currentTarget.value))
                              }
                            />
                            <button
                              type="button"
                              class="trackerBtn"
                              aria-label={`Increase ${props.title} tracker for ${key}`}
                              onClick={() => tracker().setValue(key, value() + 1)}
                            >
                              +
                            </button>
                            <span class="mono trackerValue">{value()}</span>
                          </div>
                        </td>
                      )
                    }}
                  </Show>
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

  const villainTrackStorageKey = 'game-tracker.finalGirl.villainTrack.v1'
  const locationTrackStorageKey = 'game-tracker.finalGirl.locationTrack.v1'
  const trackerMax = 10

  const [villainTrack, setVillainTrack] = createSignal<Record<string, number>>(
    readJsonRecordFromStorage(villainTrackStorageKey),
  )
  const [locationTrack, setLocationTrack] = createSignal<Record<string, number>>(
    readJsonRecordFromStorage(locationTrackStorageKey),
  )

  const [finalGirlThing] = createResource(
    () => FINAL_GIRL_OBJECT_ID,
    (id) => fetchThingSummary(id),
  )

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

  function mergeOwnedKeys(played: string[], owned: string[]): string[] {
    const seen = new Set(played.map(normalizeFinalGirlName))
    const merged = [...played]
    for (const name of owned) {
      const normalized = normalizeFinalGirlName(name)
      if (!seen.has(normalized)) {
        seen.add(normalized)
        merged.push(name)
      }
    }
    return merged
  }

  function getTrackedValue(map: Record<string, number>, name: string): number {
    const normalized = normalizeFinalGirlName(name)
    return clampInt(map[normalized] ?? 0, 0, trackerMax)
  }

  function setTrackedValue(
    setMap: (
      value:
        | Record<string, number>
        | ((prev: Record<string, number>) => Record<string, number>),
    ) => Record<string, number>,
    name: string,
    value: number,
  ) {
    const normalized = normalizeFinalGirlName(name)
    const nextValue = clampInt(value, 0, trackerMax)
    setMap((prev) => ({ ...prev, [normalized]: nextValue }))
  }

  const villainKeys = createMemo(() =>
    mergeOwnedKeys(sortKeysByCountDesc(villainCounts()), getOwnedFinalGirlVillains(ownedContent)),
  )
  const locationKeys = createMemo(() =>
    mergeOwnedKeys(
      sortKeysByCountDesc(locationCounts()),
      getOwnedFinalGirlLocations(ownedContent),
    ),
  )

  const matrixRows = createMemo(() => {
    if (flipAxes()) {
      return mergeOwnedKeys(sortKeysByCountDesc(locationCounts()), getOwnedFinalGirlLocations(ownedContent))
    }
    return mergeOwnedKeys(sortKeysByCountDesc(villainCounts()), getOwnedFinalGirlVillains(ownedContent))
  })

  const matrixCols = createMemo(() => {
    if (flipAxes()) {
      return mergeOwnedKeys(sortKeysByCountDesc(villainCounts()), getOwnedFinalGirlVillains(ownedContent))
    }
    return mergeOwnedKeys(sortKeysByCountDesc(locationCounts()), getOwnedFinalGirlLocations(ownedContent))
  })

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

  createEffect(() => writeJsonRecordToStorage(villainTrackStorageKey, villainTrack()))
  createEffect(() => writeJsonRecordToStorage(locationTrackStorageKey, locationTrack()))

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <Show when={finalGirlThing()?.thumbnail}>
          {(thumbnail) => (
            <a
              class="finalGirlThumbLink"
              href={`https://boardgamegeek.com/boardgame/${FINAL_GIRL_OBJECT_ID}`}
              target="_blank"
              rel="noreferrer"
              title="View on BoardGameGeek"
            >
              <img
                class="finalGirlThumb"
                src={thumbnail()}
                alt="Final Girl thumbnail"
                loading="lazy"
              />
            </a>
          )}
        </Show>
        <div class="meta">
          Final Girl plays in dataset:{' '}
          <span class="mono">{entries().length.toLocaleString()}</span>
          {' • '}Showing: <span class="mono">{displayEntries().length.toLocaleString()}</span>
          {' • '}Owned villains: <span class="mono">{ownedContent.ownedVillains.size}</span>
          {' • '}Owned locations: <span class="mono">{ownedContent.ownedLocations.size}</span>
        </div>
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
                    <CountTable
            title="Villains"
            counts={villainCounts()}
            keys={villainKeys()}
            isOwned={(villain) => isOwnedFinalGirlVillain(ownedContent, villain)}
            tracker={{
              max: trackerMax,
              getValue: (villain) => getTrackedValue(villainTrack(), villain),
              setValue: (villain, value) => setTrackedValue(setVillainTrack, villain, value),
            }}
          />
          <CountTable
            title="Locations"
            counts={locationCounts()}
            keys={locationKeys()}
            isOwned={(location) => isOwnedFinalGirlLocation(ownedContent, location)}
            tracker={{
              max: trackerMax,
              getValue: (location) => getTrackedValue(locationTrack(), location),
              setValue: (location, value) =>
                setTrackedValue(setLocationTrack, location, value),
            }}
          />

        </div>
      </Show>
    </div>
  )
}
