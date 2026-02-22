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
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { skytearHordeContent } from './content'
import {
  getSkytearHordeEntries,
  SKYTEAR_HORDE_OBJECT_ID,
} from './skytearHordeEntries'

type MatrixDisplayMode = 'count' | 'played'

export default function SkytearHordeView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const BOX_ORDER = ['core', 'campaigns', 'monoliths'] as const

  const sortByBoxThenCount = (
    keys: string[],
    counts: Record<string, number>,
    boxByKey: Map<string, string>,
    canonical: string[],
  ): string[] => {
    const canonicalIndex = new Map<string, number>()
    canonical.forEach((key, index) => canonicalIndex.set(key, index))

    const boxRank = (box: string) => {
      const idx = BOX_ORDER.indexOf(box as (typeof BOX_ORDER)[number])
      return idx >= 0 ? idx : BOX_ORDER.length
    }

    return keys.slice().sort((a, b) => {
      const aBox = (boxByKey.get(a) || '').trim().toLowerCase()
      const bBox = (boxByKey.get(b) || '').trim().toLowerCase()
      const byBox = boxRank(aBox) - boxRank(bBox)
      if (byBox !== 0) return byBox

      const byCount = (counts[b] ?? 0) - (counts[a] ?? 0)
      if (byCount !== 0) return byCount

      const byCanonical = (canonicalIndex.get(a) ?? Number.MAX_SAFE_INTEGER) - (canonicalIndex.get(b) ?? Number.MAX_SAFE_INTEGER)
      if (byCanonical !== 0) return byCanonical

      return a.localeCompare(b)
    })
  }

  const [matrixDisplayMode, setMatrixDisplayMode] = createSignal<MatrixDisplayMode>('played')

  const [thing] = createResource(
    () => ({ id: SKYTEAR_HORDE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getSkytearHordeEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('skytearHorde', props.plays, props.username),
  )

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))

  const heroCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.heroPrecon, entry.quantity)
    return counts
  })

  const enemyCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.enemyPrecon, entry.quantity)
    return counts
  })

  const enemyLevelCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.enemyLevel) continue
      incrementCount(counts, `L${entry.enemyLevel}`, entry.quantity)
    }
    return counts
  })

  const playIdsByHero = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.heroPrecon] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByEnemy = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.enemyPrecon] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByEnemyLevel = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (!entry.enemyLevel) continue
      const key = `L${entry.enemyLevel}`
      ;(ids[key] ||= []).push(entry.play.id)
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.heroPrecon] ||= {}
      incrementCount(counts[entry.heroPrecon]!, entry.enemyPrecon, entry.quantity)
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.heroPrecon] ||= {}
      incrementCount(counts[entry.heroPrecon]!, entry.enemyPrecon, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = `${entry.heroPrecon}|||${entry.enemyPrecon}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const heroKeys = createMemo(() => {
    const merged = mergeCanonicalKeys(sortKeysByCountDesc(heroCounts()), skytearHordeContent.heroPrecons)
    return sortByBoxThenCount(
      merged,
      heroCounts(),
      skytearHordeContent.heroBoxByPrecon,
      skytearHordeContent.heroPrecons,
    )
  })
  const enemyKeys = createMemo(() => {
    const merged = mergeCanonicalKeys(sortKeysByCountDesc(enemyCounts()), skytearHordeContent.enemyPrecons)
    return sortByBoxThenCount(
      merged,
      enemyCounts(),
      skytearHordeContent.enemyBoxByPrecon,
      skytearHordeContent.enemyPrecons,
    )
  })

  const matrixRows = createMemo(() => heroKeys())
  const matrixCols = createMemo(() => enemyKeys())

  const matrixMax = createMemo(() => {
    let max = 0
    const rows = matrixRows()
    const cols = matrixCols()
    for (const row of rows) {
      for (const col of cols) {
        const value = matrix()[row]?.[col] ?? 0
        if (value > max) max = value
      }
    }
    return max
  })

  const rowGroupBy = (row: string) => skytearHordeContent.heroBoxByPrecon.get(row)
  const colGroupBy = (col: string) => skytearHordeContent.enemyBoxByPrecon.get(col)

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={SKYTEAR_HORDE_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Skytear Horde thumbnail"
        />
        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Skytear Horde</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Skytear Horde • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Hero precon × enemy precon tracker</div>
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
            No Skytear Horde plays found. In BG Stats, tag the player{' '}
            <span class="mono">color</span> field like{' '}
            <span class="mono">H: Frostbite／E: Undead</span> (or{' '}
            <span class="mono">Frostbite／Undead</span>).
          </div>
        }
      >
        <div class="matrixControls">
          <label class="control">
            <span>Display</span>
            <select
              value={matrixDisplayMode()}
              onInput={(e) => setMatrixDisplayMode(e.currentTarget.value as MatrixDisplayMode)}
            >
              <option value="count">Count</option>
              <option value="played">Played</option>
            </select>
          </label>
        </div>

        <div class="statsGrid">
          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            rowHeader="Hero precon"
            colHeader="Enemy precon"
            rowGroupBy={rowGroupBy}
            colGroupBy={colGroupBy}
            maxCount={matrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            getCount={(row, col) => matrix()[row]?.[col] ?? 0}
            getWinCount={(row, col) => matrixWins()[row]?.[col] ?? 0}
            onCellClick={(row, col) => {
              const hero = row
              const enemy = col
              const key = `${hero}|||${enemy}`
              props.onOpenPlays({
                title: `Skytear Horde • ${hero} × ${enemy}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />

          <CountTable
            title="Hero precons"
            plays={heroCounts()}
            keys={heroKeys()}
            groupBy={(hero) => skytearHordeContent.heroBoxByPrecon.get(hero)}
            getNextAchievement={(key) => getNextAchievement('heroPreconPlays', key)}
            onPlaysClick={(hero) =>
              props.onOpenPlays({
                title: `Skytear Horde • Hero precon: ${hero}`,
                playIds: playIdsByHero()[hero] ?? [],
              })
            }
          />
        </div>

        <div class="statsGrid">
          <CountTable
            title="Enemy precons"
            plays={enemyCounts()}
            keys={enemyKeys()}
            groupBy={(enemy) => skytearHordeContent.enemyBoxByPrecon.get(enemy)}
            getNextAchievement={(key) => getNextAchievement('enemyPreconWins', key)}
            onPlaysClick={(enemy) =>
              props.onOpenPlays({
                title: `Skytear Horde • Enemy precon: ${enemy}`,
                playIds: playIdsByEnemy()[enemy] ?? [],
              })
            }
          />

          <Show when={Object.keys(enemyLevelCounts()).length > 0}>
            <CountTable
              title="Enemy levels"
              plays={enemyLevelCounts()}
              keys={sortKeysByCountDesc(enemyLevelCounts())}
              onPlaysClick={(level) =>
                props.onOpenPlays({
                  title: `Skytear Horde • Enemy level: ${level}`,
                  playIds: playIdsByEnemyLevel()[level] ?? [],
                })
              }
            />
          </Show>
        </div>
      </Show>
    </div>
  )
}
