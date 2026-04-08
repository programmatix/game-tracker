import { Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
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
import { robinsonCrusoeContent } from './content'
import { getRobinsonCrusoeEntries, ROBINSON_CRUSOE_OBJECT_ID } from './robinsonCrusoeEntries'

export default function RobinsonCrusoeView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: ROBINSON_CRUSOE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getRobinsonCrusoeEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() =>
    computeGameAchievements('robinsonCrusoe', props.plays, props.username),
  )
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
  const averageHoursPerPlay = createMemo(() => {
    const plays = totalPlays()
    if (plays <= 0) return undefined
    const hours = totalHours()
    if (hours <= 0) return undefined
    return hours / plays
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
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.scenario] ||= []).push(entry.play.id)
    }
    return ids
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const box = robinsonCrusoeContent.scenarioBoxByName.get(entry.scenario)
      if (!box) continue
      incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const box = robinsonCrusoeContent.scenarioBoxByName.get(entry.scenario)
      if (!box) continue
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      incrementCount(hoursByBox, box, resolved.minutes / 60)
      if (resolved.assumed) hasAssumedHoursByBox[box] = true
    }
    return { hoursByBox, hasAssumedHoursByBox }
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const box = robinsonCrusoeContent.scenarioBoxByName.get(entry.scenario)
      if (!box) continue
      ;(ids[box] ||= []).push(entry.play.id)
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...robinsonCrusoeContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours().hoursByBox[box] ?? 0,
        hasAssumedHours: boxPlayHours().hasAssumedHoursByBox[box] === true,
      }))
      .sort((a, b) => {
        const byPlays = (b.plays ?? 0) - (a.plays ?? 0)
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () => Boolean(robinsonCrusoeContent.costCurrencySymbol) && robinsonCrusoeContent.boxCostsByName.size > 0,
  )

  const scenarioGroupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const scenario of robinsonCrusoeContent.scenarios) {
      const group = robinsonCrusoeContent.scenarioGroupByName.get(scenario)?.trim()
      if (!group || seen.has(group)) continue
      seen.add(group)
      order.push(group)
    }
    return order
  })

  const scenarioKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(scenarioCounts()), robinsonCrusoeContent.scenarios),
      scenarioCounts(),
      (scenario) => robinsonCrusoeContent.scenarioGroupByName.get(scenario),
      scenarioGroupOrder(),
    ),
  )

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={ROBINSON_CRUSOE_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Robinson Crusoe thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Robinson Crusoe</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Robinson Crusoe • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Track tutorial clears and core scenario progression.</div>
        </div>
      </div>

      <div class="finalGirlMetaRow">
        <div class="meta">
          <div class="metaLabel">Total hours</div>
          <div class="metaValue mono">
            {totalHours().toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {totalHoursHasAssumed() ? '*' : ''}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Avg hours / play</div>
          <div class="metaValue mono">
            <Show when={averageHoursPerPlay() !== undefined} fallback="—">
              {averageHoursPerPlay()!.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              {totalHoursHasAssumed() ? '*' : ''}
            </Show>
          </div>
        </div>
      </div>

      <Show when={totalHoursHasAssumed()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length.
        </div>
      </Show>

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          title="Cost Per Box"
          rows={costRows()}
          currencySymbol={robinsonCrusoeContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          averageHoursPerPlay={averageHoursPerPlay()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          onPlaysClick={(box) => {
            const playIds = playIdsByBox()[box] ?? []
            props.onOpenPlays({
              title: `Robinson Crusoe • ${box}`,
              playIds,
            })
          }}
        />
      </Show>

      <CountTable
        title="Scenarios"
        plays={scenarioCounts()}
        wins={scenarioWins()}
        keys={scenarioKeys()}
        groupBy={(scenario) => robinsonCrusoeContent.scenarioGroupByName.get(scenario)}
        getNextAchievement={(scenario) => getNextAchievement('scenarioPlays', scenario)}
        onPlaysClick={(scenario) => {
          const playIds = playIdsByScenario()[scenario] ?? []
          props.onOpenPlays({
            title: `Robinson Crusoe • ${scenario}`,
            playIds,
          })
        }}
      />

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
        onTogglePin={props.onTogglePin}
      />
    </div>
  )
}
