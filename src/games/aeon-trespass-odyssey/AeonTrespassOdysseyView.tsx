import { For, Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import AchievementsPanel from '../../components/AchievementsPanel'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import GameThingThumb from '../../components/GameThingThumb'
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

type SessionDisplayRow = {
  entry: AeonTrespassOdysseyEntry
  rangeLabel: string
  completedDays?: number
  hours: number
  hasAssumedHours: boolean
}

function uniquePlayIds(values: readonly number[]): number[] {
  return [...new Set(values)]
}

function dayCode(day: string): string {
  const number = aeonTrespassOdysseyContent.dayNumberByName.get(day)
  if (number !== undefined) return `D${number}`
  return aeonTrespassOdysseyContent.dayShortLabelByName.get(day) ?? day
}

function sessionRangeLabel(entry: AeonTrespassOdysseyEntry): string {
  if (entry.isLearnToPlay) return 'LTP'
  const start = dayCode(entry.startDay)
  const end = dayCode(entry.endDay)
  if (start === end) return end
  return `${start}-${end}`
}

function completedDaysInSession(entry: AeonTrespassOdysseyEntry): number | undefined {
  if (entry.isLearnToPlay) return undefined
  if (entry.startDayNumber === undefined || entry.endDayNumber === undefined) return undefined
  return Math.max(1, entry.endDayNumber - entry.startDayNumber + 1)
}

function sumQuantities(entries: readonly AeonTrespassOdysseyEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0)
}

function formatHours(value: number | undefined): string {
  if (value === undefined) return '—'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function HourMetric(props: { value: number | undefined; hasAssumedHours: boolean }) {
  return (
    <Show when={props.value !== undefined} fallback="—">
      {formatHours(props.value)}
      {props.hasAssumedHours ? '*' : ''}
      <span class="aeonProgressUnit"> h</span>
    </Show>
  )
}

function entryBox(entry: AeonTrespassOdysseyEntry): string | undefined {
  return (
    aeonTrespassOdysseyContent.dayBoxByName.get(entry.endDay) ||
    aeonTrespassOdysseyContent.cycleBoxByName.get(entry.campaign) ||
    aeonTrespassOdysseyContent.boxCostsByName.keys().next().value
  )
}

function SessionTable(props: {
  title: string
  emptyText: string
  rows: readonly SessionDisplayRow[]
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title}</h3>
      <Show when={props.rows.length > 0} fallback={<div class="muted">{props.emptyText}</div>}>
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
              <For each={props.rows}>
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
  )
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
  const campaignEntries = createMemo(() => entries().filter((entry) => !entry.isLearnToPlay))
  const learnToPlayEntries = createMemo(() => entries().filter((entry) => entry.isLearnToPlay))
  const allPlayIds = createMemo(() => uniquePlayIds(entries().map((entry) => entry.play.id)))
  const achievements = createMemo(() =>
    computeGameAchievements('aeonTrespassOdyssey', props.plays, props.username),
  )
  const assumedMinutesPerPlay = createMemo(() => thingAssumedPlayTimeMinutes(thing()?.raw) ?? undefined)
  const totalCampaignDays = createMemo(() => aeonTrespassOdysseyContent.days.length)

  function summarizeHoursFor(inputEntries: readonly AeonTrespassOdysseyEntry[]) {
    let hours = 0
    let hasAssumedHours = false

    for (const entry of inputEntries) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      hours += resolved.minutes / 60
      hasAssumedHours ||= resolved.assumed
    }

    return { hours, hasAssumedHours }
  }

  const totalPlays = createMemo(() => sumQuantities(entries()))
  const campaignPlays = createMemo(() => sumQuantities(campaignEntries()))
  const learnToPlayPlays = createMemo(() => sumQuantities(learnToPlayEntries()))
  const totalHoursSummary = createMemo(() => summarizeHoursFor(entries()))
  const campaignHoursSummary = createMemo(() => summarizeHoursFor(campaignEntries()))
  const learnToPlayHoursSummary = createMemo(() => summarizeHoursFor(learnToPlayEntries()))
  const totalHours = createMemo(() => totalHoursSummary().hours)
  const totalHoursHasAssumed = createMemo(() => totalHoursSummary().hasAssumedHours)
  const averageCampaignHoursPerSession = createMemo(() => {
    const plays = campaignPlays()
    if (plays <= 0) return undefined
    const hours = campaignHoursSummary().hours
    if (hours <= 0) return undefined
    return hours / plays
  })
  const averageHoursPerPlay = createMemo(() => {
    const plays = totalPlays()
    if (plays <= 0) return undefined
    const hours = totalHours()
    if (hours <= 0) return undefined
    return hours / plays
  })

  const currentProgressDay = createMemo(() =>
    campaignEntries().reduce((max, entry) => Math.max(max, entry.endDayNumber ?? 0), 0),
  )
  const completionPercent = createMemo(() => {
    const totalDays = totalCampaignDays()
    if (totalDays <= 0) return 0
    return (currentProgressDay() / totalDays) * 100
  })
  const boundedCompletionPercent = createMemo(() => Math.max(0, Math.min(100, completionPercent())))
  const averageCampaignHoursPerDay = createMemo(() => {
    const completedDays = currentProgressDay()
    if (completedDays <= 0) return undefined
    const hours = campaignHoursSummary().hours
    if (hours <= 0) return undefined
    return hours / completedDays
  })
  const projectedCampaignHours = createMemo(() => {
    const average = averageCampaignHoursPerDay()
    if (average === undefined) return undefined
    return average * totalCampaignDays()
  })
  const projectedRemainingCampaignHours = createMemo(() => {
    const projected = projectedCampaignHours()
    if (projected === undefined) return undefined
    return Math.max(0, projected - campaignHoursSummary().hours)
  })

  const continuationCount = createMemo(() =>
    entries().reduce(
      (sum, entry) =>
        sum + (entry.continuedFromPrevious || entry.continuedToNext ? entry.quantity : 0),
      0,
    ),
  )

  const taggedPlays = createMemo(() =>
    entries().reduce((sum, entry) => {
      const hasCampaignDay = entry.startDay !== 'Unknown day' || entry.endDay !== 'Unknown day'
      return sum + (entry.isLearnToPlay || hasCampaignDay ? entry.quantity : 0)
    }, 0),
  )
  const untaggedPlays = createMemo(() => totalPlays() - taggedPlays())

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const box = entryBox(entry)
      if (!box) continue
      incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const box = entryBox(entry)
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
      const box = entryBox(entry)
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

  function buildSessionRows(inputEntries: readonly AeonTrespassOdysseyEntry[]): SessionDisplayRow[] {
    return inputEntries
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
      })
  }

  const campaignSessionRows = createMemo(() => buildSessionRows(campaignEntries()))
  const learnToPlaySessionRows = createMemo(() => buildSessionRows(learnToPlayEntries()))

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
            <span class="mono">C1／D10／D13</span>, <span class="mono">D10／D13</span>, or{' '}
            <span class="mono">LTP</span>.
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
          <div class="metaLabel">Campaign sessions</div>
          <div class="metaValue mono">{campaignPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Campaign hours</div>
          <div class="metaValue mono">
            {campaignHoursSummary().hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {campaignHoursSummary().hasAssumedHours ? '*' : ''}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Avg campaign hours</div>
          <div class="metaValue mono">
            <Show when={averageCampaignHoursPerSession() !== undefined} fallback="—">
              {averageCampaignHoursPerSession()!.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              {campaignHoursSummary().hasAssumedHours ? '*' : ''}
            </Show>
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">LTP sessions</div>
          <div class="metaValue mono">{learnToPlayPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">LTP hours</div>
          <div class="metaValue mono">
            {learnToPlayHoursSummary().hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {learnToPlayHoursSummary().hasAssumedHours ? '*' : ''}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Total hours</div>
          <div class="metaValue mono">
            {totalHours().toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {totalHoursHasAssumed() ? '*' : ''}
          </div>
        </div>
      </div>

      <Show when={untaggedPlays() > 0 || continuationCount() > 0}>
        <div class="muted">
          Untagged sessions: <span class="mono">{untaggedPlays().toLocaleString()}</span>
          {' • '}
          Continuations: <span class="mono">{continuationCount().toLocaleString()}</span>
        </div>
      </Show>

      <Show when={totalHoursHasAssumed()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has no recorded length.
        </div>
      </Show>

      <div class="statsBlock aeonProgressBlock">
        <div class="aeonProgressHeader">
          <div>
            <h3 class="statsTitle">Cycle Progress</h3>
            <div class="muted">
              Progress is based on the ending day of each campaign session. LTP sessions are excluded.
            </div>
          </div>
          <div class="aeonProgressPercent mono">{boundedCompletionPercent().toFixed(0)}%</div>
        </div>
        <div
          class="aeonProgressTrack"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax={totalCampaignDays()}
          aria-valuenow={currentProgressDay()}
          aria-label={`Cycle progress: ${currentProgressDay()} of ${totalCampaignDays()} days`}
        >
          <div
            class="aeonProgressFill"
            style={{ width: `${boundedCompletionPercent().toFixed(2)}%` }}
          />
          <div class="aeonProgressBarLabel mono">
            Day {currentProgressDay().toLocaleString()} / {totalCampaignDays().toLocaleString()}
          </div>
        </div>
        <div class="aeonProgressTicks mono" aria-hidden="true">
          <span>D0</span>
          <span>D20</span>
          <span>D40</span>
          <span>D60</span>
          <span>D80</span>
        </div>
        <div class="aeonProgressStats">
          <div class="aeonProgressStat">
            <div class="metaLabel">Avg / day</div>
            <div class="metaValue mono">
              <HourMetric
                value={averageCampaignHoursPerDay()}
                hasAssumedHours={campaignHoursSummary().hasAssumedHours}
              />
            </div>
          </div>
          <div class="aeonProgressStat">
            <div class="metaLabel">Projected remaining</div>
            <div class="metaValue mono">
              <HourMetric
                value={projectedRemainingCampaignHours()}
                hasAssumedHours={campaignHoursSummary().hasAssumedHours}
              />
            </div>
          </div>
          <div class="aeonProgressStat">
            <div class="metaLabel">Projected total</div>
            <div class="metaValue mono">
              <HourMetric
                value={projectedCampaignHours()}
                hasAssumedHours={campaignHoursSummary().hasAssumedHours}
              />
            </div>
          </div>
        </div>
        <div class="muted">
          Projection uses campaign hours divided by completed days, then extrapolates to the full
          80-day cycle.
        </div>
      </div>

      <SessionTable
        title="Campaign Sessions"
        emptyText="No Aeon Trespass: Odyssey campaign sessions yet."
        rows={campaignSessionRows()}
        onOpenPlays={props.onOpenPlays}
      />

      <SessionTable
        title="Learn To Play Sessions"
        emptyText="No Aeon Trespass: Odyssey learn-to-play sessions yet."
        rows={learnToPlaySessionRows()}
        onOpenPlays={props.onOpenPlays}
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
