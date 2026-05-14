import { Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import AchievementsPanel from '../../components/AchievementsPanel'
import CampaignProgressTable from '../../components/CampaignProgressTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import CountTable from '../../components/CountTable'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { aeonTrespassOdysseyContent } from './content'
import {
  AEON_TRESPASS_ODYSSEY_OBJECT_ID,
  getAeonTrespassOdysseyEntries,
} from './aeonTrespassOdysseyEntries'

function uniquePlayIds(values: readonly number[]): number[] {
  return [...new Set(values)]
}

export default function AeonTrespassOdysseyView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: AEON_TRESPASS_ODYSSEY_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getAeonTrespassOdysseyEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => uniquePlayIds(entries().map((entry) => entry.play.id)))
  const achievements = createMemo(() =>
    computeGameAchievements('aeonTrespassOdyssey', props.plays, props.username),
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

  const cycleCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.campaign, entry.quantity)
    return counts
  })

  const dayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.day, entry.quantity)
    return counts
  })

  const dayWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.day, entry.quantity)
    }
    return counts
  })

  const playIdsByCycle = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.campaign] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByDay = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.day] ||= []).push(entry.play.id)
    }
    return ids
  })

  const continuationCount = createMemo(() =>
    entries().reduce(
      (sum, entry) =>
        sum + (entry.continuedFromPrevious || entry.continuedToNext ? entry.quantity : 0),
      0,
    ),
  )

  const taggedPlays = createMemo(() =>
    entries().reduce(
      (sum, entry) =>
        sum + (entry.campaign === 'Unknown cycle' && entry.day === 'Unknown day' ? 0 : entry.quantity),
      0,
    ),
  )
  const untaggedPlays = createMemo(() => totalPlays() - taggedPlays())

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const box = aeonTrespassOdysseyContent.dayBoxByName.get(entry.day)
      if (!box) continue
      incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const box = aeonTrespassOdysseyContent.dayBoxByName.get(entry.day)
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

  const dayPlayHours = createMemo(() => {
    const hoursByDay: Record<string, number> = {}
    const hasAssumedHoursByDay: Record<string, boolean> = {}
    for (const entry of entries()) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      incrementCount(hoursByDay, entry.day, resolved.minutes / 60)
      if (resolved.assumed) hasAssumedHoursByDay[entry.day] = true
    }
    return { hoursByDay, hasAssumedHoursByDay }
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const box = aeonTrespassOdysseyContent.dayBoxByName.get(entry.day)
      if (!box) continue
      ;(ids[box] ||= []).push(entry.play.id)
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...aeonTrespassOdysseyContent.boxCostsByName.entries()]
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
    () =>
      Boolean(aeonTrespassOdysseyContent.costCurrencySymbol) &&
      aeonTrespassOdysseyContent.boxCostsByName.size > 0,
  )

  const cycleKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(cycleCounts()), aeonTrespassOdysseyContent.cycles),
  )

  const playedDayCount = createMemo(
    () => aeonTrespassOdysseyContent.days.filter((day) => (dayCounts()[day] ?? 0) > 0).length,
  )
  const completionPercent = createMemo(() => {
    const totalDays = aeonTrespassOdysseyContent.days.length
    if (totalDays <= 0) return 0
    return (playedDayCount() / totalDays) * 100
  })

  const cycleSections = createMemo(() =>
    aeonTrespassOdysseyContent.cycles.map((cycle) => {
      const days = aeonTrespassOdysseyContent.dayNamesByCycleName.get(cycle) ?? []
      const playedCount = days.filter((day) => (dayCounts()[day] ?? 0) > 0).length

      return {
        key: cycle,
        label: cycle,
        group: aeonTrespassOdysseyContent.cycleGroupByName.get(cycle),
        summary: `${playedCount.toLocaleString()} / ${days.length.toLocaleString()} days played`,
        playIds: uniquePlayIds(playIdsByCycle()[cycle] ?? []),
        steps: days.map((day) => ({
          key: day,
          label: aeonTrespassOdysseyContent.dayShortLabelByName.get(day) ?? day,
          plays: dayCounts()[day] ?? 0,
          wins: dayWins()[day] ?? 0,
          hours: dayPlayHours().hoursByDay[day] ?? 0,
          hasAssumedHours: dayPlayHours().hasAssumedHoursByDay[day] === true,
          playIds: uniquePlayIds(playIdsByDay()[day] ?? []),
        })),
      }
    }),
  )

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={AEON_TRESPASS_ODYSSEY_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Aeon Trespass: Odyssey thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Aeon Trespass: Odyssey</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Aeon Trespass: Odyssey • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Track Cycle 1 as an 80-day campaign. Use BG Stats tags like{' '}
            <span class="mono">C1／D1</span> or <span class="mono">D1</span>.
          </div>
        </div>
      </div>

      <div class="finalGirlMetaRow">
        <div class="meta">
          <div class="metaLabel">Days played</div>
          <div class="metaValue mono">
            {playedDayCount().toLocaleString()} / {aeonTrespassOdysseyContent.days.length.toLocaleString()}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Campaign coverage</div>
          <div class="metaValue mono">{completionPercent().toFixed(0)}%</div>
        </div>
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
        <div class="meta">
          <div class="metaLabel">Tagged plays</div>
          <div class="metaValue mono">{taggedPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Untagged plays</div>
          <div class="metaValue mono">{untaggedPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Continuations</div>
          <div class="metaValue mono">{continuationCount().toLocaleString()}</div>
        </div>
      </div>

      <Show when={totalHoursHasAssumed()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has no recorded length.
        </div>
      </Show>

      <CampaignProgressTable
        title="Cycle Days"
        stepLabel="Day"
        sections={cycleSections()}
        onCampaignPlaysClick={(cycle) => {
          const playIds = uniquePlayIds(playIdsByCycle()[cycle] ?? [])
          if (playIds.length === 0) return
          props.onOpenPlays({
            title: `Aeon Trespass: Odyssey • ${cycle}`,
            playIds,
          })
        }}
        onStepPlaysClick={(_cycle, day) => {
          const playIds = uniquePlayIds(playIdsByDay()[day] ?? [])
          if (playIds.length === 0) return
          props.onOpenPlays({
            title: `Aeon Trespass: Odyssey • ${day}`,
            playIds,
          })
        }}
      />

      <CountTable
        title="Cycles"
        plays={cycleCounts()}
        keys={cycleKeys()}
        groupBy={(cycle) => aeonTrespassOdysseyContent.cycleGroupByName.get(cycle)}
        onPlaysClick={(cycle) => {
          const playIds = uniquePlayIds(playIdsByCycle()[cycle] ?? [])
          if (playIds.length === 0) return
          props.onOpenPlays({
            title: `Aeon Trespass: Odyssey • ${cycle}`,
            playIds,
          })
        }}
      />

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          rows={costRows()}
          currencySymbol={aeonTrespassOdysseyContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          averageHoursPerPlay={averageHoursPerPlay()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          title="Cost Per Box"
          onPlaysClick={(box) => {
            const ids = uniquePlayIds(playIdsByBox()[box] ?? [])
            if (ids.length === 0) return
            props.onOpenPlays({
              title: `Aeon Trespass: Odyssey • ${box}`,
              playIds: ids,
            })
          }}
        />
      </Show>

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
