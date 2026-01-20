import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import AchievementsPanel from '../../components/AchievementsPanel'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
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
      if (!entry.myGearloc) continue
      incrementCount(counts, entry.myGearloc, entry.quantity)
    }
    return counts
  })

  const playIdsByGearlocMine = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (!entry.myGearloc) continue
      ;(ids[entry.myGearloc] ||= []).push(entry.play.id)
    }
    return ids
  })

  const gearlocWinsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myGearloc) continue
      if (!entry.isWin) continue
      incrementCount(counts, entry.myGearloc, entry.quantity)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.myGearloc) continue
      counts[entry.tyrant] ||= {}
      incrementCount(counts[entry.tyrant]!, entry.myGearloc, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.myGearloc) continue
      const key = `${entry.tyrant}|||${entry.myGearloc}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const tyrantKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(tyrantCounts()), tooManyBonesContent.tyrants),
  )
  const gearlocKeysMine = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(gearlocCountsMine()), tooManyBonesContent.gearlocs),
  )
  const gearlocKeysAll = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(gearlocCountsAll()), tooManyBonesContent.gearlocs),
  )

  const matrixRows = createMemo(() => (flipAxes() ? gearlocKeysMine() : tyrantKeys()))
  const matrixCols = createMemo(() => (flipAxes() ? tyrantKeys() : gearlocKeysMine()))

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
        <Show when={thing()?.thumbnail}>
          {(thumbnail) => (
            <a
              class="finalGirlThumbLink"
              href={`https://boardgamegeek.com/boardgame/${TOO_MANY_BONES_OBJECT_ID}`}
              target="_blank"
              rel="noreferrer"
              title="View on BoardGameGeek"
            >
              <img class="finalGirlThumb" src={thumbnail()} alt="" loading="lazy" />
            </a>
          )}
        </Show>

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Too Many Bones</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
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
            <span class="mono">G: Boomer／T: Nom</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Tyrants"
            plays={tyrantCounts()}
            wins={tyrantWins()}
            keys={tyrantKeys()}
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

