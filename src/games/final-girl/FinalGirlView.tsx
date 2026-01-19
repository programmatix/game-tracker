import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { incrementCount, sortKeysByCountDesc } from '../../stats'
import CountTable from '../../components/CountTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { computeGameAchievements } from '../../achievements/games'
import {
  buildLabelToIdLookup,
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import ownedContentText from './content.txt?raw'
import {
  getOwnedFinalGirlFinalGirls,
  getOwnedFinalGirlLocations,
  getOwnedFinalGirlVillains,
  isOwnedFinalGirlLocation,
  isOwnedFinalGirlVillain,
  normalizeFinalGirlName,
  parseOwnedFinalGirlContent,
  resolveFinalGirlBgStatsTags,
} from './ownedContent'

const FINAL_GIRL_OBJECT_ID = '277659'

type FinalGirlEntry = {
  play: BggPlay
  villain: string
  location: string
  finalGirl: string
  quantity: number
  isWin: boolean
}

const ownedContent = parseOwnedFinalGirlContent(ownedContentText)

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

export default function FinalGirlView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [hideCounts, setHideCounts] = createSignal(true)
  const [ownedVillainsOnly, setOwnedVillainsOnly] = createSignal(false)
  const [ownedLocationsOnly, setOwnedLocationsOnly] = createSignal(false)

  const [finalGirlThing] = createResource(
    () => ({ id: FINAL_GIRL_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
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

      const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))
      const resolved = resolveFinalGirlBgStatsTags(tags, ownedContent)

      const villain =
        getBgStatsValue(parsed, ['V', 'Villain']) || resolved.villain || 'Unknown villain'
      const location =
        getBgStatsValue(parsed, ['L', 'Location']) || resolved.location || 'Unknown location'
      const finalGirl =
        getBgStatsValue(parsed, ['FG', 'Final Girl', 'FinalGirl']) ||
        resolved.finalGirl ||
        'Unknown'

      result.push({
        play,
        villain,
        location,
        finalGirl,
        quantity: playQuantity(play),
        isWin: player?.attributes.win === '1',
      })
    }
    return result
  })

  const achievements = createMemo(() =>
    computeGameAchievements('finalGirl', props.plays, props.username),
  )

  const totalFinalGirlPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + entry.quantity, 0),
  )

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

  const displayFinalGirlPlays = createMemo(() =>
    displayEntries().reduce((sum, entry) => sum + entry.quantity, 0),
  )

  const villainCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) incrementCount(counts, entry.villain, entry.quantity)
    return counts
  })

  const playIdsByVillain = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of displayEntries()) {
      ;(ids[entry.villain] ||= []).push(entry.play.id)
    }
    return ids
  })

  const villainWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.villain, entry.quantity)
    }
    return counts
  })

  const locationCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) incrementCount(counts, entry.location, entry.quantity)
    return counts
  })

  const playIdsByLocation = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of displayEntries()) {
      ;(ids[entry.location] ||= []).push(entry.play.id)
    }
    return ids
  })

  const locationWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.location, entry.quantity)
    }
    return counts
  })

  const finalGirlCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) incrementCount(counts, entry.finalGirl, entry.quantity)
    return counts
  })

  const playIdsByFinalGirl = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of displayEntries()) {
      ;(ids[entry.finalGirl] ||= []).push(entry.play.id)
    }
    return ids
  })

  const finalGirlWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of displayEntries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.finalGirl, entry.quantity)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of displayEntries()) {
      counts[entry.villain] ||= {}
      incrementCount(counts[entry.villain]!, entry.location, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of displayEntries()) {
      const key = `${entry.villain}|||${entry.location}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
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

  const villainKeys = createMemo(() =>
    mergeOwnedKeys(sortKeysByCountDesc(villainCounts()), getOwnedFinalGirlVillains(ownedContent)),
  )
  const locationKeys = createMemo(() =>
    mergeOwnedKeys(
      sortKeysByCountDesc(locationCounts()),
      getOwnedFinalGirlLocations(ownedContent),
    ),
  )
  const finalGirlKeys = createMemo(() =>
    mergeOwnedKeys(
      sortKeysByCountDesc(finalGirlCounts()),
      getOwnedFinalGirlFinalGirls(ownedContent),
    ),
  )

  const matrixRows = createMemo(() => {
    if (flipAxes()) {
      return mergeOwnedKeys(
        sortKeysByCountDesc(locationCounts()),
        getOwnedFinalGirlLocations(ownedContent),
      )
    }
    return mergeOwnedKeys(
      sortKeysByCountDesc(villainCounts()),
      getOwnedFinalGirlVillains(ownedContent),
    )
  })

  const matrixCols = createMemo(() => {
    if (flipAxes()) {
      return mergeOwnedKeys(
        sortKeysByCountDesc(villainCounts()),
        getOwnedFinalGirlVillains(ownedContent),
      )
    }
    return mergeOwnedKeys(
      sortKeysByCountDesc(locationCounts()),
      getOwnedFinalGirlLocations(ownedContent),
    )
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

  function getOwnedContentWarningTitle(
    kind: 'Villain' | 'Location',
    name: string,
    isOwned: boolean,
    playCount: number,
  ): string | undefined {
    if (playCount <= 0) return undefined
    if (isOwned) return undefined
    return `${kind} "${name}" appears in plays but is not listed in owned content (content.txt) (or the spelling doesn't match).`
  }

  const villainLabelToId = createMemo(() =>
    buildLabelToIdLookup(
      [...ownedContent.villainsById.entries()].map(([id, info]) => ({ id, label: info.display })),
    ),
  )
  const locationLabelToId = createMemo(() =>
    buildLabelToIdLookup([...ownedContent.locationsById.entries()].map(([id, label]) => ({ id, label }))),
  )
  const finalGirlLabelToId = createMemo(() =>
    buildLabelToIdLookup([...ownedContent.finalGirlsById.entries()].map(([id, label]) => ({ id, label }))),
  )

  function findFinalGirlAchievement(trackIdPrefix: string, label: string, labelToId: Map<string, string>) {
    const normalized = normalizeAchievementItemLabel(label).toLowerCase()
    const itemId = labelToId.get(normalized) ?? slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${itemId}`])
  }

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
          <span class="mono">{totalFinalGirlPlays().toLocaleString()}</span>
          {' • '}Showing: <span class="mono">{displayFinalGirlPlays().toLocaleString()}</span>
          {' • '}Owned villains: <span class="mono">{ownedContent.ownedVillains.size}</span>
          {' • '}Owned locations: <span class="mono">{ownedContent.ownedLocations.size}</span>
        </div>
      </div>

      <AchievementsPanel
        achievements={achievements()}
        nextLimit={5}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Final Girl plays found. For BG Stats tags, put values in the player{' '}
            <span class="mono">color</span> field like{' '}
            <span class="mono">V: …／L: …／FG: …</span> or <span class="mono">BigBadWolf/Uki</span>.
          </div>
        }
      >
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
            getRowWarningTitle={(row) =>
              flipAxes()
                ? getOwnedContentWarningTitle(
                    'Location',
                    row,
                    isOwnedFinalGirlLocation(ownedContent, row),
                    locationCounts()[row] ?? 0,
                  )
                : getOwnedContentWarningTitle(
                    'Villain',
                    row,
                    isOwnedFinalGirlVillain(ownedContent, row),
                    villainCounts()[row] ?? 0,
                  )
            }
            getColWarningTitle={(col) =>
              flipAxes()
                ? getOwnedContentWarningTitle(
                    'Villain',
                    col,
                    isOwnedFinalGirlVillain(ownedContent, col),
                    villainCounts()[col] ?? 0,
                  )
                : getOwnedContentWarningTitle(
                    'Location',
                    col,
                    isOwnedFinalGirlLocation(ownedContent, col),
                    locationCounts()[col] ?? 0,
                  )
            }
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
            onCellClick={(row, col) => {
              const villain = flipAxes() ? col : row
              const location = flipAxes() ? row : col
              const key = `${villain}|||${location}`
              props.onOpenPlays({
                title: `Final Girl • ${villain} × ${location}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />
          <CountTable
            title="Villains"
            plays={villainCounts()}
            wins={villainWins()}
            keys={villainKeys()}
            getNextAchievement={(villain) =>
              findFinalGirlAchievement('villainWins', villain, villainLabelToId())
            }
            isOwned={(villain) => isOwnedFinalGirlVillain(ownedContent, villain)}
            getWarningTitle={(villain) =>
              getOwnedContentWarningTitle(
                'Villain',
                villain,
                isOwnedFinalGirlVillain(ownedContent, villain),
                villainCounts()[villain] ?? 0,
              )
            }
            onPlaysClick={(villain) =>
              props.onOpenPlays({
                title: `Final Girl • Villain: ${villain}`,
                playIds: playIdsByVillain()[villain] ?? [],
              })
            }
          />
          <CountTable
            title="Locations"
            plays={locationCounts()}
            wins={locationWins()}
            keys={locationKeys()}
            getNextAchievement={(location) =>
              findFinalGirlAchievement('locationPlays', location, locationLabelToId())
            }
            isOwned={(location) => isOwnedFinalGirlLocation(ownedContent, location)}
            getWarningTitle={(location) =>
              getOwnedContentWarningTitle(
                'Location',
                location,
                isOwnedFinalGirlLocation(ownedContent, location),
                locationCounts()[location] ?? 0,
              )
            }
            onPlaysClick={(location) =>
              props.onOpenPlays({
                title: `Final Girl • Location: ${location}`,
                playIds: playIdsByLocation()[location] ?? [],
              })
            }
          />
        </div>

        <div class="statsGrid">
          <CountTable
            title="Final Girls"
            plays={finalGirlCounts()}
            wins={finalGirlWins()}
            keys={finalGirlKeys()}
            getNextAchievement={(finalGirl) =>
              findFinalGirlAchievement('finalGirlPlays', finalGirl, finalGirlLabelToId())
            }
            onPlaysClick={(finalGirl) =>
              props.onOpenPlays({
                title: `Final Girl • Final Girl: ${finalGirl}`,
                playIds: playIdsByFinalGirl()[finalGirl] ?? [],
              })
            }
          />
        </div>
      </Show>
    </div>
  )
}
