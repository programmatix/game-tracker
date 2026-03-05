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
import {
  incrementCount,
  mergeCanonicalKeys,
  sortKeysByCountDesc,
  sortKeysByGroupThenCountDesc,
} from '../../stats'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { paleoContent } from './content'
import { getPaleoEntries, PALEO_OBJECT_ID } from './paleoEntries'

type MatrixDisplayMode = 'count' | 'played'

function pairKey(left: string, right: string): string {
  return `${left}|||${right}`
}

export default function PaleoView(props: {
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
    () => ({ id: PALEO_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getPaleoEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() => computeGameAchievements('paleo', props.plays, props.username))
  const assumedMinutesPerPlay = createMemo(() => thingAssumedPlayTimeMinutes(thing()?.raw) ?? undefined)

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(() =>
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
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      if (resolved.assumed) return true
    }
    return false
  })

  const moduleCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const module of new Set([entry.moduleA, entry.moduleB])) {
        incrementCount(counts, module, entry.quantity)
      }
    }
    return counts
  })

  const moduleWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const module of new Set([entry.moduleA, entry.moduleB])) {
        incrementCount(counts, module, entry.quantity)
      }
    }
    return counts
  })

  const scenarioCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.scenario, entry.quantity)
    return counts
  })

  const scenarioWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.scenario, entry.quantity)
    }
    return counts
  })

  const playIdsByModule = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const module of new Set([entry.moduleA, entry.moduleB])) {
        ;(ids[module] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const playIdsByScenario = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.scenario] ||= []).push(entry.play.id)
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.moduleA] ||= {}
      incrementCount(counts[entry.moduleA]!, entry.moduleB, entry.quantity)
      if (entry.moduleA !== entry.moduleB) {
        counts[entry.moduleB] ||= {}
        incrementCount(counts[entry.moduleB]!, entry.moduleA, entry.quantity)
      }
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.moduleA] ||= {}
      incrementCount(counts[entry.moduleA]!, entry.moduleB, entry.quantity)
      if (entry.moduleA !== entry.moduleB) {
        counts[entry.moduleB] ||= {}
        incrementCount(counts[entry.moduleB]!, entry.moduleA, entry.quantity)
      }
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const forward = pairKey(entry.moduleA, entry.moduleB)
      const existingForward = ids.get(forward)
      if (existingForward) existingForward.push(entry.play.id)
      else ids.set(forward, [entry.play.id])

      if (entry.moduleA !== entry.moduleB) {
        const reverse = pairKey(entry.moduleB, entry.moduleA)
        const existingReverse = ids.get(reverse)
        if (existingReverse) existingReverse.push(entry.play.id)
        else ids.set(reverse, [entry.play.id])
      }
    }
    return ids
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const moduleABox = paleoContent.moduleGroupByName.get(entry.moduleA)
      if (moduleABox) boxes.add(moduleABox)
      const moduleBBox = paleoContent.moduleGroupByName.get(entry.moduleB)
      if (moduleBBox) boxes.add(moduleBBox)
      const scenarioBox = paleoContent.scenarioGroupByName.get(entry.scenario)
      if (scenarioBox) boxes.add(scenarioBox)
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      const hours = resolved.minutes / 60
      if (hours <= 0) continue

      const boxes = new Set<string>()
      const moduleABox = paleoContent.moduleGroupByName.get(entry.moduleA)
      if (moduleABox) boxes.add(moduleABox)
      const moduleBBox = paleoContent.moduleGroupByName.get(entry.moduleB)
      if (moduleBBox) boxes.add(moduleBBox)
      const scenarioBox = paleoContent.scenarioGroupByName.get(entry.scenario)
      if (scenarioBox) boxes.add(scenarioBox)

      for (const box of boxes) incrementCount(hoursByBox, box, hours)
      if (resolved.assumed) {
        for (const box of boxes) hasAssumedHoursByBox[box] = true
      }
    }
    return { hoursByBox, hasAssumedHoursByBox }
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const moduleABox = paleoContent.moduleGroupByName.get(entry.moduleA)
      if (moduleABox) boxes.add(moduleABox)
      const moduleBBox = paleoContent.moduleGroupByName.get(entry.moduleB)
      if (moduleBBox) boxes.add(moduleBBox)
      const scenarioBox = paleoContent.scenarioGroupByName.get(entry.scenario)
      if (scenarioBox) boxes.add(scenarioBox)
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...paleoContent.boxCostsByName.entries()]
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
    () => Boolean(paleoContent.costCurrencySymbol) && paleoContent.boxCostsByName.size > 0,
  )

  const moduleGroupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const module of paleoContent.modules) {
      const group = paleoContent.moduleGroupByName.get(module)?.trim()
      if (!group || seen.has(group)) continue
      seen.add(group)
      order.push(group)
    }
    return order
  })

  const moduleKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(moduleCounts()), paleoContent.modules),
      moduleCounts(),
      (module) => paleoContent.moduleGroupByName.get(module),
      moduleGroupOrder(),
    ),
  )

  const scenarioKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(scenarioCounts()), paleoContent.scenarios),
  )

  const matrixRows = createMemo(() => moduleKeys())
  const matrixCols = createMemo(() => moduleKeys())

  const matrixMax = createMemo(() => {
    let max = 0
    for (const row of matrixRows()) {
      for (const col of matrixCols()) {
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
          objectId={PALEO_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Paleo thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Paleo</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Paleo • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Track module pairings and scenario progression.</div>
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
            No Paleo plays found. Use BG Stats player <span class="mono">color</span> tags like{' '}
            <span class="mono">M1: ModA／S: Scen1／M2: ModB</span> or{' '}
            <span class="mono">ModA／Scen1／ModB</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Modules"
            plays={moduleCounts()}
            wins={moduleWins()}
            keys={moduleKeys()}
            groupBy={(module) => paleoContent.moduleGroupByName.get(module)}
            getNextAchievement={(key) => getNextAchievement('moduleWins', key)}
            onPlaysClick={(module) =>
              props.onOpenPlays({
                title: `Paleo • Module: ${module}`,
                playIds: playIdsByModule()[module] ?? [],
              })
            }
          />
          <CountTable
            title="Scenarios"
            plays={scenarioCounts()}
            wins={scenarioWins()}
            keys={scenarioKeys()}
            getNextAchievement={(key) => getNextAchievement('scenarioWins', key)}
            onPlaysClick={(scenario) =>
              props.onOpenPlays({
                title: `Paleo • Scenario: ${scenario}`,
                playIds: playIdsByScenario()[scenario] ?? [],
              })
            }
          />
          <Show when={hasCostTable()}>
            <CostPerPlayTable
              title="Cost per box"
              rows={costRows()}
              currencySymbol={paleoContent.costCurrencySymbol}
              overallPlays={totalPlays()}
              overallHours={totalHours()}
              overallHoursHasAssumed={totalHoursHasAssumed()}
              onPlaysClick={(box) =>
                props.onOpenPlays({
                  title: `Paleo • Box: ${box}`,
                  playIds: playIdsByBox()[box] ?? [],
                })
              }
            />
          </Show>
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">Module A × Module B</h3>
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
          </div>

          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            rowHeader="Module A"
            colHeader="Module B"
            rowGroupBy={(row) => paleoContent.moduleGroupByName.get(row)}
            colGroupBy={(col) => paleoContent.moduleGroupByName.get(col)}
            getCount={(row, col) => matrix()[row]?.[col] ?? 0}
            getWinCount={(row, col) => matrixWins()[row]?.[col] ?? 0}
            maxCount={matrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            onCellClick={(row, col) =>
              props.onOpenPlays({
                title: `Paleo • ${row} + ${col}`,
                playIds: playIdsByPair().get(pairKey(row, col)) ?? [],
              })
            }
          />
        </div>
      </Show>
    </div>
  )
}
