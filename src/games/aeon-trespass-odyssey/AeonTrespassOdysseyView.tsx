import { For, Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import AchievementsPanel from '../../components/AchievementsPanel'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import GameThingThumb from '../../components/GameThingThumb'
import ProgressBar from '../../components/ProgressBar'
import { computeGameAchievements } from '../../achievements/games'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount } from '../../stats'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { aeonTrespassOdysseyContent } from './content'
import {
  AEON_TRESPASS_ODYSSEY_OBJECT_ID,
  getAeonTrespassOdysseyEntries,
  type AeonTrespassOdysseyEntry,
} from './aeonTrespassOdysseyEntries'

function uniquePlayIds(values: readonly number[]): number[] {
  return [...new Set(values)]
}

function dayCode(day: string): string {
  const number = aeonTrespassOdysseyContent.dayNumberByName.get(day)
  if (number !== undefined) return `D${number}`
  return aeonTrespassOdysseyContent.dayShortLabelByName.get(day) ?? day
}

function sessionRangeLabel(entry: AeonTrespassOdysseyEntry): string {
  const start = dayCode(entry.startDay)
  const end = dayCode(entry.endDay)
  if (start === end) return end
  return `${start}-${end}`
}

function completedDaysInSession(entry: AeonTrespassOdysseyEntry): number | undefined {
  if (entry.startDayNumber === undefined || entry.endDayNumber === undefined) return undefined
  return Math.max(1, entry.endDayNumber - entry.startDayNumber + 1)
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
  const totalCampaignDays = createMemo(() => aeonTrespassOdysseyContent.days.length)

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

  const currentProgressDay = createMemo(() =>
    entries().reduce((max, entry) => Math.max(max, entry.endDayNumber ?? 0), 0),
  )
  const completionPercent = createMemo(() => {
    const totalDays = totalCampaignDays()
    if (totalDays <= 0) return 0
    return (currentProgressDay() / totalDays) * 100
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
        sum +
        (entry.campaign === 'Unknown cycle' &&
        entry.startDay === 'Unknown day' &&
        entry.endDay === 'Unknown day'
          ? 0
          : entry.quantity),
      0,
    ),
  )
  const untaggedPlays = createMemo(() => totalPlays() - taggedPlays())

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const box = aeonTrespassOdysseyContent.dayBoxByName.get(entry.endDay)
      if (!box) continue
      incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const box = aeonTrespassOdysseyContent.dayBoxByName.get(entry.endDay)
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
      const box = aeonTrespassOdysseyContent.dayBoxByName.get(entry.endDay)
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

  const sessionRows = createMemo(() =>
    entries()
      .slice()
      .sort((left, right) => {
        const dateCompare = (right.play.attributes.date || '').localeCompare(left.play.attributes.date || '')
        if (dateCompare !== 0) return dateCompare
        return right.play.id - left.play.id
      })
      .map((entry) => {
        const resolved = totalPlayMinutesWithAssumption({
          attributes: entry.play.attributes,
          quantity: entry.quantity,
          assumedMinutesPerPlay: assumedMinutesPerPlay(),
        })
        return {
          entry,
          rangeLabel: sessionRangeLabel(entry),
          completedDays: completedDaysInSession(entry),
          hours: resolved.minutes / 60,
          hasAssumedHours: resolved.assumed,
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
              Sessions: <span class="mono">{totalPlays().toLocaleString()}</span>
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
            <span class="mono">C1／D10／D13</span> or <span class="mono">D10／D13</span>.
          </div>
        </div>
      </div>

      <div class="finalGirlMetaRow">
        <div class="meta">
          <div class="metaLabel">Latest day</div>
          <div class="metaValue mono">
            {currentProgressDay().toLocaleString()} / {totalCampaignDays().toLocaleString()}
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
          <div class="metaLabel">Avg hours / session</div>
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
          <div class="metaLabel">Tagged sessions</div>
          <div class="metaValue mono">{taggedPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Untagged sessions</div>
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

      <div class="statsBlock">
        <h3 class="statsTitle">Cycle Progress</h3>
        <ProgressBar
          value={currentProgressDay()}
          target={totalCampaignDays()}
          label={`${currentProgressDay().toLocaleString()} / ${totalCampaignDays().toLocaleString()} days`}
        />
        <div class="muted">
          Progress is based on the ending day of each recorded session.
        </div>
      </div>

      <div class="statsBlock">
        <h3 class="statsTitle">Sessions</h3>
        <Show
          when={sessionRows().length > 0}
          fallback={<div class="muted">No Aeon Trespass: Odyssey sessions yet.</div>}
        >
          <div class="tableWrap compact">
            <table class="table compactTable mobileCardTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Cycle</th>
                  <th>Range</th>
                  <th class="mono">Days</th>
                  <th class="mono">Hours</th>
                  <th class="mono">Plays</th>
                </tr>
              </thead>
              <tbody>
                <For each={sessionRows()}>
                  {(row) => (
                    <tr>
                      <td data-label="Date">{row.entry.play.attributes.date || 'Unknown date'}</td>
                      <td data-label="Cycle">{row.entry.campaign}</td>
                      <td data-label="Range">{row.rangeLabel}</td>
                      <td class="mono" data-label="Days">
                        <Show when={row.completedDays !== undefined} fallback="—">
                          {row.completedDays!.toLocaleString()}
                        </Show>
                      </td>
                      <td class="mono" data-label="Hours">
                        {row.hours.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        {row.hasAssumedHours ? '*' : ''}
                      </td>
                      <td class="mono" data-label="Plays">
                        <button
                          type="button"
                          class="countLink"
                          onClick={() =>
                            props.onOpenPlays({
                              title: `Aeon Trespass: Odyssey • ${row.rangeLabel}`,
                              playIds: [row.entry.play.id],
                            })
                          }
                          title="View play"
                        >
                          {row.entry.quantity.toLocaleString()}
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

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
