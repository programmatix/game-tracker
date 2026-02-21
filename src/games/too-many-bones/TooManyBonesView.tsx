import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import AchievementsPanel from '../../components/AchievementsPanel'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import {
  incrementCount,
  mergeCanonicalKeys,
  sortKeysByCountDesc,
  sortKeysByGroupThenCountDesc,
} from '../../stats'
import { tooManyBonesContent } from './content'
import { getTooManyBonesEntries, TOO_MANY_BONES_OBJECT_ID } from './tooManyBonesEntries'

export default function TooManyBonesView(props: {
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

  const [thing] = createResource(
    () => ({ id: TOO_MANY_BONES_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getTooManyBonesEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() =>
    computeGameAchievements('tooManyBones', props.plays, props.username),
  )

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))

  const tyrantCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.tyrant, entry.quantity)
    return counts
  })

  const playIdsByTyrant = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.tyrant] ||= []).push(entry.play.id)
    }
    return ids
  })

  const tyrantWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.tyrant, entry.quantity)
    }
    return counts
  })

  const gearlocCountsAll = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const gearloc of entry.gearlocs) incrementCount(counts, gearloc, entry.quantity)
    }
    return counts
  })

  const playIdsByGearlocAll = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const gearloc of entry.gearlocs) {
        ;(ids[gearloc] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const gearlocCountsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const gearloc of entry.myGearlocs) incrementCount(counts, gearloc, entry.quantity)
    }
    return counts
  })

  const playIdsByGearlocMine = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const gearloc of entry.myGearlocs) {
        ;(ids[gearloc] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const gearlocWinsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const gearloc of entry.myGearlocs) incrementCount(counts, gearloc, entry.quantity)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (entry.myGearlocs.length === 0) continue
      counts[entry.tyrant] ||= {}
      for (const gearloc of entry.myGearlocs) incrementCount(counts[entry.tyrant]!, gearloc, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const gearloc of entry.myGearlocs) {
        const key = `${entry.tyrant}|||${gearloc}`
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const gearlocGroupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const gearloc of tooManyBonesContent.gearlocs) {
      const group = tooManyBonesContent.gearlocGroupByName.get(gearloc)?.trim()
      if (!group || seen.has(group)) continue
      seen.add(group)
      order.push(group)
    }
    return order
  })

  const tyrantGroupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const tyrant of tooManyBonesContent.tyrants) {
      const group = tooManyBonesContent.tyrantGroupByName.get(tyrant)?.trim()
      if (!group || seen.has(group)) continue
      seen.add(group)
      order.push(group)
    }
    return order
  })

  const tyrantKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(tyrantCounts()), tooManyBonesContent.tyrants),
      tyrantCounts(),
      (tyrant) => tooManyBonesContent.tyrantGroupByName.get(tyrant),
      tyrantGroupOrder(),
    ),
  )
  const gearlocKeysMine = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(gearlocCountsMine()), tooManyBonesContent.gearlocs),
      gearlocCountsMine(),
      (gearloc) => tooManyBonesContent.gearlocGroupByName.get(gearloc),
      gearlocGroupOrder(),
    ),
  )
  const gearlocKeysAll = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(gearlocCountsAll()), tooManyBonesContent.gearlocs),
      gearlocCountsAll(),
      (gearloc) => tooManyBonesContent.gearlocGroupByName.get(gearloc),
      gearlocGroupOrder(),
    ),
  )

  const matrixRows = createMemo(() => (flipAxes() ? gearlocKeysMine() : tyrantKeys()))
  const matrixCols = createMemo(() => (flipAxes() ? tyrantKeys() : gearlocKeysMine()))
  const rowGroupBy = (row: string) =>
    flipAxes()
      ? tooManyBonesContent.gearlocGroupByName.get(row)
      : tooManyBonesContent.tyrantGroupByName.get(row)
  const colGroupBy = (col: string) =>
    flipAxes()
      ? tooManyBonesContent.tyrantGroupByName.get(col)
      : tooManyBonesContent.gearlocGroupByName.get(col)

  const matrixMax = createMemo(() => {
    let max = 0
    const rows = matrixRows()
    const cols = matrixCols()
    for (const row of rows) {
      for (const col of cols) {
        const value = flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
        if (value > max) max = value
      }
    }
    return max
  })

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={TOO_MANY_BONES_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Too Many Bones thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Too Many Bones</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Too Many Bones • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Tyrant mode: tyrant × my gearloc</div>
        </div>
      </div>

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Too Many Bones plays found. For BG Stats tags, put values in the player{' '}
            <span class="mono">color</span> field like{' '}
            <span class="mono">Boomer／Duster／Drellen／H</span> or <span class="mono">G: Boomer／T: Nom／D: A</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Tyrants"
            plays={tyrantCounts()}
            wins={tyrantWins()}
            keys={tyrantKeys()}
            groupBy={(tyrant) => tooManyBonesContent.tyrantGroupByName.get(tyrant)}
            getNextAchievement={(key) => getNextAchievement('tyrantWins', key)}
            onPlaysClick={(tyrant) =>
              props.onOpenPlays({
                title: `Too Many Bones • Tyrant: ${tyrant}`,
                playIds: playIdsByTyrant()[tyrant] ?? [],
              })
            }
          />
          <CountTable
            title="My gearlocs"
            plays={gearlocCountsMine()}
            wins={gearlocWinsMine()}
            keys={gearlocKeysMine()}
            groupBy={(gearloc) => tooManyBonesContent.gearlocGroupByName.get(gearloc)}
            getNextAchievement={(key) => getNextAchievement('gearlocPlays', key)}
            onPlaysClick={(gearloc) =>
              props.onOpenPlays({
                title: `Too Many Bones • My gearloc: ${gearloc}`,
                playIds: playIdsByGearlocMine()[gearloc] ?? [],
              })
            }
          />
          <CountTable
            title="All gearlocs"
            plays={gearlocCountsAll()}
            keys={gearlocKeysAll()}
            groupBy={(gearloc) => tooManyBonesContent.gearlocGroupByName.get(gearloc)}
            onPlaysClick={(gearloc) =>
              props.onOpenPlays({
                title: `Too Many Bones • Gearloc: ${gearloc}`,
                playIds: playIdsByGearlocAll()[gearloc] ?? [],
              })
            }
          />
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">{flipAxes() ? 'Gearloc × Tyrant' : 'Tyrant × Gearloc'}</h3>
            <div class="matrixControls">
              <label class="controlLabel">
                <input
                  type="checkbox"
                  checked={flipAxes()}
                  onChange={(e) => setFlipAxes(e.currentTarget.checked)}
                />{' '}
                Flip axes
              </label>
              <label class="controlLabel">
                <input
                  type="checkbox"
                  checked={hideCounts()}
                  onChange={(e) => setHideCounts(e.currentTarget.checked)}
                />{' '}
                Hide counts
              </label>
            </div>
          </div>

          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            rowHeader={flipAxes() ? 'Gearloc' : 'Tyrant'}
            colHeader={flipAxes() ? 'Tyrant' : 'Gearloc'}
            rowGroupBy={rowGroupBy}
            colGroupBy={colGroupBy}
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
            maxCount={matrixMax()}
            hideCounts={hideCounts()}
            onCellClick={(row, col) => {
              const tyrant = flipAxes() ? col : row
              const gearloc = flipAxes() ? row : col
              const key = `${tyrant}|||${gearloc}`
              props.onOpenPlays({
                title: `Too Many Bones • ${tyrant} • ${gearloc}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />
        </div>
      </Show>
    </div>
  )
}
