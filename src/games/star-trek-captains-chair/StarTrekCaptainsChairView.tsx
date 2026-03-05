import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import {
  thingAssumedPlayTimeMinutes,
  totalPlayMinutesWithAssumption,
} from '../../playDuration'
import { starTrekCaptainsChairContent } from './content'
import {
  getStarTrekCaptainsChairEntries,
  STAR_TREK_CAPTAINS_CHAIR_OBJECT_ID,
} from './starTrekCaptainsChairEntries'

type MatrixDisplayMode = 'count' | 'played'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(scenario: string, captain: string): string {
  return `${normalizeLabel(scenario)}|||${normalizeLabel(captain)}`
}

export default function StarTrekCaptainsChairView(props: {
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
    () => ({ id: STAR_TREK_CAPTAINS_CHAIR_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getStarTrekCaptainsChairEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('starTrekCaptainsChair', props.plays, props.username),
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

  const playIdsByScenario = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.scenario)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const myCaptainCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.captain, entry.quantity)
    return counts
  })

  const myCaptainWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.captain, entry.quantity)
    }
    return counts
  })

  const playIdsByMyCaptain = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.captain)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const allCaptainCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const captain of entry.allCaptains) incrementCount(counts, captain, entry.quantity)
    }
    return counts
  })

  const playIdsByAllCaptain = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const captain of entry.allCaptains) {
        const key = normalizeLabel(captain)
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.scenario] ||= {}
      incrementCount(counts[entry.scenario]!, entry.captain, entry.quantity)
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.scenario] ||= {}
      incrementCount(counts[entry.scenario]!, entry.captain, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = pairKey(entry.scenario, entry.captain)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const scenarioKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(scenarioCounts()), starTrekCaptainsChairContent.scenarios),
  )
  const myCaptainKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(myCaptainCounts()), starTrekCaptainsChairContent.captains),
  )
  const allCaptainKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(allCaptainCounts()), starTrekCaptainsChairContent.captains),
  )

  const matrixRows = createMemo(() => scenarioKeys())
  const matrixCols = createMemo(() => myCaptainKeys())

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

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const scenarioBox = starTrekCaptainsChairContent.scenarioBoxByName.get(entry.scenario)
      if (scenarioBox) boxes.add(scenarioBox)
      for (const captain of entry.allCaptains) {
        const captainBox = starTrekCaptainsChairContent.captainBoxByName.get(captain)
        if (captainBox) boxes.add(captainBox)
      }
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const scenarioBox = starTrekCaptainsChairContent.scenarioBoxByName.get(entry.scenario)
      if (scenarioBox) boxes.add(scenarioBox)
      for (const captain of entry.allCaptains) {
        const captainBox = starTrekCaptainsChairContent.captainBoxByName.get(captain)
        if (captainBox) boxes.add(captainBox)
      }
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      const hours = resolved.minutes / 60
      if (hours <= 0) continue
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
      const scenarioBox = starTrekCaptainsChairContent.scenarioBoxByName.get(entry.scenario)
      if (scenarioBox) boxes.add(scenarioBox)
      for (const captain of entry.allCaptains) {
        const captainBox = starTrekCaptainsChairContent.captainBoxByName.get(captain)
        if (captainBox) boxes.add(captainBox)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...starTrekCaptainsChairContent.boxCostsByName.entries()]
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
      Boolean(starTrekCaptainsChairContent.costCurrencySymbol) &&
      starTrekCaptainsChairContent.boxCostsByName.size > 0,
  )

  const getScenarioGroup = (scenario: string) =>
    starTrekCaptainsChairContent.scenarioGroupByName.get(scenario)
  const getCaptainGroup = (captain: string) =>
    starTrekCaptainsChairContent.captainGroupByName.get(captain)

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={STAR_TREK_CAPTAINS_CHAIR_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Star Trek: Captain's Chair thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Star Trek: Captain's Chair</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: "Star Trek: Captain's Chair • All plays",
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Captain and scenario tracker from BG Stats color tags.</div>
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
            No Star Trek: Captain's Chair plays found. In BG Stats, use player{' '}
            <span class="mono">color</span> like <span class="mono">Picard／Basic</span> or{' '}
            <span class="mono">C: Picard／S: Advanced</span>.
          </div>
        }
      >
        <div class="matrixHeaderRow">
          <div class="muted">
            Matrix mode:{' '}
            <span class="mono">
              {matrixDisplayMode() === 'played' ? 'Played/Unplayed' : 'Play counts'}
            </span>
          </div>
          <div class="tabs">
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: matrixDisplayMode() === 'played' }}
              onClick={() => setMatrixDisplayMode('played')}
            >
              Played/Unplayed
            </button>
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: matrixDisplayMode() === 'count' }}
              onClick={() => setMatrixDisplayMode('count')}
            >
              Play counts
            </button>
          </div>
        </div>

        <HeatmapMatrix
          rows={matrixRows()}
          cols={matrixCols()}
          rowHeader="Scenario"
          colHeader="My captain"
          maxCount={matrixMax()}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(scenario, captain) => matrix()[scenario]?.[captain] ?? 0}
          getWinCount={(scenario, captain) => matrixWins()[scenario]?.[captain] ?? 0}
          getCellDisplayText={(scenario, captain, count) => {
            if (matrixDisplayMode() === 'count') return count === 0 ? '—' : String(count)
            const wins = matrixWins()[scenario]?.[captain] ?? 0
            if (count === 0) return '—'
            if (wins <= 0) return '✗'
            return '✓'
          }}
          getCellLabel={(scenario, captain, count) => {
            const wins = matrixWins()[scenario]?.[captain] ?? 0
            if (count === 0) return `${scenario} × ${captain}: unplayed`
            return `${scenario} × ${captain}: ${count} plays, ${wins} wins`
          }}
          rowGroupBy={getScenarioGroup}
          colGroupBy={getCaptainGroup}
          onCellClick={(scenario, captain) =>
            props.onOpenPlays({
              title: `Star Trek: Captain's Chair • ${scenario} × ${captain}`,
              playIds: playIdsByPair().get(pairKey(scenario, captain)) ?? [],
            })
          }
        />

        <div class="statsGrid">
          <CountTable
            title="Scenarios"
            plays={scenarioCounts()}
            wins={scenarioWins()}
            keys={scenarioKeys()}
            groupBy={getScenarioGroup}
            getNextAchievement={(scenario) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `scenarioPlays:${slugifyAchievementItemId(scenario)}`,
                `scenarioWins:${slugifyAchievementItemId(scenario)}`,
              ])
            }
            onPlaysClick={(scenario) =>
              props.onOpenPlays({
                title: `Star Trek: Captain's Chair • Scenario: ${scenario}`,
                playIds: playIdsByScenario().get(normalizeLabel(scenario)) ?? [],
              })
            }
          />
          <CountTable
            title="My captains"
            plays={myCaptainCounts()}
            wins={myCaptainWins()}
            keys={myCaptainKeys()}
            groupBy={getCaptainGroup}
            getNextAchievement={(captain) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `captainPlays:${slugifyAchievementItemId(captain)}`,
                `captainWins:${slugifyAchievementItemId(captain)}`,
              ])
            }
            onPlaysClick={(captain) =>
              props.onOpenPlays({
                title: `Star Trek: Captain's Chair • My captain: ${captain}`,
                playIds: playIdsByMyCaptain().get(normalizeLabel(captain)) ?? [],
              })
            }
          />
          <CountTable
            title="All captains"
            plays={allCaptainCounts()}
            keys={allCaptainKeys()}
            groupBy={getCaptainGroup}
            getNextAchievement={(captain) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `captainPlays:${slugifyAchievementItemId(captain)}`,
              ])
            }
            onPlaysClick={(captain) =>
              props.onOpenPlays({
                title: `Star Trek: Captain's Chair • Captain: ${captain}`,
                playIds: playIdsByAllCaptain().get(normalizeLabel(captain)) ?? [],
              })
            }
          />
          <Show when={hasCostTable()}>
            <CostPerPlayTable
              title="Cost per box"
              rows={costRows()}
              currencySymbol={starTrekCaptainsChairContent.costCurrencySymbol}
              overallPlays={totalPlays()}
              overallHours={totalHours()}
              overallHoursHasAssumed={totalHoursHasAssumed()}
              onPlaysClick={(box) =>
                props.onOpenPlays({
                  title: `Star Trek: Captain's Chair • Box: ${box}`,
                  playIds: playIdsByBox()[box] ?? [],
                })
              }
            />
          </Show>
        </div>
      </Show>
    </div>
  )
}
