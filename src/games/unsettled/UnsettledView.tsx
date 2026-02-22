import { createMemo, createResource, createSignal } from 'solid-js'
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
import { incrementCount, mergeCanonicalKeys } from '../../stats'
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
  const [flipAxes, setFlipAxes] = createSignal(false)
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

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))

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

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
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

  const matrixRows = createMemo(() => (flipAxes() ? taskKeys() : planetKeys()))
  const matrixCols = createMemo(() => (flipAxes() ? planetKeys() : taskKeys()))

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

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />

      <div class="matrixControls">
        <label class="checkboxLabel">
          <input
            type="checkbox"
            checked={flipAxes()}
            onInput={(e) => setFlipAxes(e.currentTarget.checked)}
          />{' '}
          Flip axes
        </label>
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
          rowHeader={flipAxes() ? 'Task' : 'Planet'}
          colHeader={flipAxes() ? 'Planet' : 'Task'}
          maxCount={matrixMax()}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(row, col) =>
            flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
          }
          onCellClick={(row, col) => {
            const planet = flipAxes() ? col : row
            const task = flipAxes() ? row : col
            const key = pairKey(planet, task)
            props.onOpenPlays({
              title: `Unsettled • ${planet} × ${task}`,
              playIds: playIdsByPair().get(key) ?? [],
            })
          }}
        />
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
    </div>
  )
}
