import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
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
import { totalPlayMinutes } from '../../playDuration'
import { bulletContent } from './content'
import { BULLET_OBJECT_ID, getBulletEntries } from './bulletEntries'

type MatrixDisplayMode = 'count' | 'played'

export default function BulletView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [matrixDisplayMode, setMatrixDisplayMode] = createSignal<MatrixDisplayMode>('played')

  const [thing] = createResource(
    () => ({ id: BULLET_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getBulletEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() =>
    computeGameAchievements('bullet', props.plays, props.username),
  )

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(
    () =>
      entries().reduce(
        (sum, entry) => sum + totalPlayMinutes(entry.play.attributes, entry.quantity) / 60,
        0,
      ),
  )

  const bossCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.boss, entry.quantity)
    return counts
  })

  const playIdsByBoss = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.boss] ||= []).push(entry.play.id)
    }
    return ids
  })

  const bossWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.boss, entry.quantity)
    }
    return counts
  })

  const heroineCountsAll = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const heroine of entry.heroines) incrementCount(counts, heroine, entry.quantity)
    }
    return counts
  })

  const playIdsByHeroineAll = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const heroine of entry.heroines) {
        ;(ids[heroine] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const heroineCountsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myHeroine) continue
      incrementCount(counts, entry.myHeroine, entry.quantity)
    }
    return counts
  })

  const playIdsByHeroineMine = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (!entry.myHeroine) continue
      ;(ids[entry.myHeroine] ||= []).push(entry.play.id)
    }
    return ids
  })

  const heroineWinsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myHeroine) continue
      if (!entry.isWin) continue
      incrementCount(counts, entry.myHeroine, entry.quantity)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.myHeroine) continue
      counts[entry.boss] ||= {}
      incrementCount(counts[entry.boss]!, entry.myHeroine, entry.quantity)
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      if (!entry.myHeroine) continue
      counts[entry.boss] ||= {}
      incrementCount(counts[entry.boss]!, entry.myHeroine, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.myHeroine) continue
      const key = `${entry.boss}|||${entry.myHeroine}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const bossSet = bulletContent.bossSetByName.get(entry.boss)
      if (bossSet) boxes.add(bossSet)
      for (const heroine of entry.heroines) {
        const heroineSet = bulletContent.heroineSetByName.get(heroine)
        if (heroineSet) boxes.add(heroineSet)
      }
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const bossSet = bulletContent.bossSetByName.get(entry.boss)
      if (bossSet) boxes.add(bossSet)
      for (const heroine of entry.heroines) {
        const heroineSet = bulletContent.heroineSetByName.get(heroine)
        if (heroineSet) boxes.add(heroineSet)
      }
      const hours = totalPlayMinutes(entry.play.attributes, entry.quantity) / 60
      if (hours <= 0) continue
      for (const box of boxes) incrementCount(hoursByBox, box, hours)
    }
    return hoursByBox
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const bossSet = bulletContent.bossSetByName.get(entry.boss)
      if (bossSet) boxes.add(bossSet)
      for (const heroine of entry.heroines) {
        const heroineSet = bulletContent.heroineSetByName.get(heroine)
        if (heroineSet) boxes.add(heroineSet)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...bulletContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours()[box] ?? 0,
      }))
      .sort((a, b) => {
        const byPlays = b.plays - a.plays
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () => Boolean(bulletContent.costCurrencySymbol) && bulletContent.boxCostsByName.size > 0,
  )

  const sortByGroupThenCount = (
    keys: string[],
    counts: Record<string, number>,
    groupByKey: Map<string, string>,
    canonical: string[],
  ): string[] => {
    const groupOrder = new Map<string, number>()
    for (const key of canonical) {
      const group = (groupByKey.get(key) || '').trim().toLowerCase()
      if (!group || groupOrder.has(group)) continue
      groupOrder.set(group, groupOrder.size)
    }

    const canonicalIndex = new Map<string, number>()
    canonical.forEach((key, index) => canonicalIndex.set(key, index))

    return keys.slice().sort((a, b) => {
      const aGroup = (groupByKey.get(a) || '').trim().toLowerCase()
      const bGroup = (groupByKey.get(b) || '').trim().toLowerCase()
      const byGroup = (groupOrder.get(aGroup) ?? Number.MAX_SAFE_INTEGER) - (groupOrder.get(bGroup) ?? Number.MAX_SAFE_INTEGER)
      if (byGroup !== 0) return byGroup

      const byCount = (counts[b] ?? 0) - (counts[a] ?? 0)
      if (byCount !== 0) return byCount

      const byCanonical = (canonicalIndex.get(a) ?? Number.MAX_SAFE_INTEGER) - (canonicalIndex.get(b) ?? Number.MAX_SAFE_INTEGER)
      if (byCanonical !== 0) return byCanonical

      return a.localeCompare(b)
    })
  }

  const bossKeys = createMemo(() => {
    const merged = mergeCanonicalKeys(sortKeysByCountDesc(bossCounts()), bulletContent.bosses)
    return sortByGroupThenCount(merged, bossCounts(), bulletContent.bossSetByName, bulletContent.bosses)
  })
  const heroineKeys = createMemo(() => {
    const merged = mergeCanonicalKeys(sortKeysByCountDesc(heroineCountsMine()), bulletContent.heroines)
    return sortByGroupThenCount(
      merged,
      heroineCountsMine(),
      bulletContent.heroineSetByName,
      bulletContent.heroines,
    )
  })
  const heroineKeysAll = createMemo(() => {
    const merged = mergeCanonicalKeys(sortKeysByCountDesc(heroineCountsAll()), bulletContent.heroines)
    return sortByGroupThenCount(
      merged,
      heroineCountsAll(),
      bulletContent.heroineSetByName,
      bulletContent.heroines,
    )
  })

  const matrixRows = createMemo(() => bossKeys())
  const matrixCols = createMemo(() => heroineKeys())
  const rowGroupBy = (row: string) =>
    bulletContent.bossSetByName.get(row)
  const colGroupBy = (col: string) =>
    bulletContent.heroineSetByName.get(col)

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

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="gameView">
      <div class="gameMetaRow">
        <GameThingThumb
          objectId={BULLET_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Bullet thumbnail"
        />

        <div class="gameMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Bullet</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({ title: 'Bullet • All plays', playIds: allPlayIds() })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Boss mode: boss × my heroine</div>
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
            No Bullet plays found. In BG Stats, put values in the player{' '}
            <span class="mono">color</span> field like <span class="mono">Ekolu</span> or{' '}
            <span class="mono">H: Ekolu</span>. Bosses can be tagged as{' '}
            <span class="mono">B: History</span> and will be picked up from any player.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Bosses"
            plays={bossCounts()}
            wins={bossWins()}
            keys={bossKeys()}
            groupBy={(boss) => bulletContent.bossSetByName.get(boss)}
            getNextAchievement={(boss) => getNextAchievement('bossWins', boss)}
            onPlaysClick={(boss) =>
              props.onOpenPlays({
                title: `Bullet • Boss: ${boss}`,
                playIds: playIdsByBoss()[boss] ?? [],
              })
            }
          />
          <CountTable
            title="My Heroines"
            plays={heroineCountsMine()}
            wins={heroineWinsMine()}
            keys={heroineKeys()}
            groupBy={(heroine) => bulletContent.heroineSetByName.get(heroine)}
            getNextAchievement={(heroine) => getNextAchievement('heroinePlays', heroine)}
            onPlaysClick={(heroine) =>
              props.onOpenPlays({
                title: `Bullet • My Heroine: ${heroine}`,
                playIds: playIdsByHeroineMine()[heroine] ?? [],
              })
            }
          />
          <CountTable
            title="All Heroines"
            plays={heroineCountsAll()}
            keys={heroineKeysAll()}
            groupBy={(heroine) => bulletContent.heroineSetByName.get(heroine)}
            onPlaysClick={(heroine) =>
              props.onOpenPlays({
                title: `Bullet • Heroine: ${heroine}`,
                playIds: playIdsByHeroineAll()[heroine] ?? [],
              })
            }
          />
          <Show when={hasCostTable()}>
            <CostPerPlayTable
              title="Cost per box"
              rows={costRows()}
              currencySymbol={bulletContent.costCurrencySymbol}
              overallPlays={totalPlays()}
              overallHours={totalHours()}
              onPlaysClick={(box) =>
                props.onOpenPlays({
                  title: `Bullet • Box: ${box}`,
                  playIds: playIdsByBox()[box] ?? [],
                })
              }
            />
          </Show>
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">Boss × Heroine</h3>
            <div class="gameControls">
              <label class="control">
                <span>Display</span>
                <select
                  value={matrixDisplayMode()}
                  onInput={(e) =>
                    setMatrixDisplayMode(e.currentTarget.value as MatrixDisplayMode)
                  }
                >
                  <option value="count">Count</option>
                  <option value="played">Played</option>
                </select>
              </label>
            </div>
          </div>
          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            rowHeader="Boss"
            colHeader="Heroine"
            rowGroupBy={rowGroupBy}
            colGroupBy={colGroupBy}
            maxCount={matrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            getCount={(row, col) => matrix()[row]?.[col] ?? 0}
            getWinCount={(row, col) => matrixWins()[row]?.[col] ?? 0}
            onCellClick={(row, col) => {
              const boss = row
              const heroine = col
              const ids = playIdsByPair().get(`${boss}|||${heroine}`) ?? []
              props.onOpenPlays({ title: `Bullet • ${boss} • ${heroine}`, playIds: ids })
            }}
          />
        </div>
      </Show>
    </div>
  )
}
