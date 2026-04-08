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
import { incrementCount, mergeCanonicalKeys } from '../../stats'
import {
  thingAssumedPlayTimeMinutes,
  totalPlayMinutesWithAssumption,
} from '../../playDuration'
import { unsettledContent } from './content'
import { getUnsettledEntries, UNSETTLED_OBJECT_ID } from './unsettledEntries'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(planet: string, task: string): string {
  return `${normalizeLabel(planet)}|||${normalizeLabel(task)}`
}

type MatrixDisplayMode = 'count' | 'played'

export default function UnsettledView(props: {
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
    () => ({ id: UNSETTLED_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getUnsettledEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('unsettled', props.plays, props.username),
  )
  const assumedMinutesPerPlay = createMemo(() => thingAssumedPlayTimeMinutes(thing()?.raw) ?? undefined)

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(
    () =>
      entries().reduce(
        (sum, entry) =>
          sum +
          totalPlayMinutesWithAssumption({
            attributes: entry.play.attributes,
            quantity: entry.quantity,
            assumedMinutesPerPlay: assumedMinutesPerPlay(),
          }).minutes /
            60,
        0,
      ),
  )
  const totalHoursHasAssumed = createMemo(() => {
    for (const entry of entries()) {
      if (
        totalPlayMinutesWithAssumption({
          attributes: entry.play.attributes,
          quantity: entry.quantity,
          assumedMinutesPerPlay: assumedMinutesPerPlay(),
        }).assumed
      )
        return true
    }
    return false
  })

  const planetCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.planet, entry.quantity)
    return counts
  })

  const planetWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.planet, entry.quantity)
    }
    return counts
  })

  const taskCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.task, entry.quantity)
    return counts
  })

  const taskWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.task, entry.quantity)
    }
    return counts
  })

  const playIdsByPlanet = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.planet)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const playIdsByTask = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.task)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = pairKey(entry.planet, entry.task)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const box = unsettledContent.planetBoxByName.get(entry.planet)
      if (!box) continue
      incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const box = unsettledContent.planetBoxByName.get(entry.planet)
      if (!box) continue
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      const hours = resolved.minutes / 60
      if (hours <= 0) continue
      incrementCount(hoursByBox, box, hours)
      if (resolved.assumed) hasAssumedHoursByBox[box] = true
    }
    return { hoursByBox, hasAssumedHoursByBox }
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const box = unsettledContent.planetBoxByName.get(entry.planet)
      if (!box) continue
      ;(ids[box] ||= []).push(entry.play.id)
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...unsettledContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours().hoursByBox[box] ?? 0,
        hasAssumedHours: boxPlayHours().hasAssumedHoursByBox[box] === true,
      }))
      .sort((a, b) => {
        const byPlays = b.plays - a.plays
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () =>
      Boolean(unsettledContent.costCurrencySymbol) &&
      unsettledContent.boxCostsByName.size > 0,
  )

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.planet] ||= {}
      incrementCount(counts[entry.planet]!, entry.task, entry.quantity)
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.planet] ||= {}
      incrementCount(counts[entry.planet]!, entry.task, entry.quantity)
    }
    return counts
  })

  const planetKeys = createMemo(() =>
    mergeCanonicalKeys(Object.keys(planetCounts()), unsettledContent.planets),
  )

  const taskKeys = createMemo(() =>
    mergeCanonicalKeys(unsettledContent.tasks, Object.keys(taskCounts()), (value) =>
      value.trim().toUpperCase(),
    ),
  )

  const matrixRows = createMemo(() => planetKeys())
  const matrixCols = createMemo(() => taskKeys())

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
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={UNSETTLED_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Unsettled thumbnail"
        />
        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Unsettled</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({ title: 'Unsettled • All plays', playIds: allPlayIds() })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Planet × task tracker</div>
        </div>
      </div>

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
          rowHeader="Planet"
          colHeader="Task"
          maxCount={matrixMax()}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(row, col) => matrix()[row]?.[col] ?? 0}
          getWinCount={(row, col) => matrixWins()[row]?.[col] ?? 0}
          onCellClick={(row, col) => {
            const planet = row
            const task = col
            const key = pairKey(planet, task)
            props.onOpenPlays({
              title: `Unsettled • ${planet} × ${task}`,
              playIds: playIdsByPair().get(key) ?? [],
            })
          }}
        />
      </div>

      <div class="statsGrid">
        <Show when={hasCostTable()}>
          <CostPerPlayTable
            title="Cost per box"
            rows={costRows()}
            currencySymbol={unsettledContent.costCurrencySymbol}
            overallPlays={totalPlays()}
            overallHours={totalHours()}
            overallHoursHasAssumed={totalHoursHasAssumed()}
            onPlaysClick={(box) =>
              props.onOpenPlays({
                title: `Unsettled • Box: ${box}`,
                playIds: playIdsByBox()[box] ?? [],
              })
            }
          />
        </Show>
        <CountTable
          title="Planets"
          plays={planetCounts()}
          wins={planetWins()}
          keys={planetKeys()}
          getNextAchievement={(planet) => getNextAchievement('planetPlays', planet)}
          onPlaysClick={(planet) =>
            props.onOpenPlays({
              title: `Unsettled • Planet: ${planet}`,
              playIds: playIdsByPlanet().get(normalizeLabel(planet)) ?? [],
            })
          }
        />
      </div>

      <div class="statsGrid">
        <CountTable
          title="Tasks"
          plays={taskCounts()}
          wins={taskWins()}
          keys={taskKeys()}
          getNextAchievement={(task) => getNextAchievement('taskPlays', task)}
          onPlaysClick={(task) =>
            props.onOpenPlays({
              title: `Unsettled • Task: ${task}`,
              playIds: playIdsByTask().get(normalizeLabel(task)) ?? [],
            })
          }
        />
      </div>

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />
    </div>
  )
}
