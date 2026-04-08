import { For, Show, createMemo } from 'solid-js'
import { COST_PER_HOUR_TARGET_OPTIONS } from '../costTargets'
import ProgressBar from './ProgressBar'

export type CostPerPlayRow = {
  box: string
  cost: number
  plays: number
  hoursPlayed: number
  hasAssumedHours?: boolean
}

export default function CostPerPlayTable(props: {
  rows: CostPerPlayRow[]
  currencySymbol: string
  overallPlays: number
  overallHours?: number
  averageHoursPerPlay?: number
  overallHoursHasAssumed?: boolean
  overallCost?: number
  title?: string
  onPlaysClick?: (box: string) => void
}) {
  const rows = createMemo(() => props.rows)
  const overallCost = createMemo(() =>
    typeof props.overallCost === 'number'
      ? props.overallCost
      : rows().reduce((sum, row) => sum + row.cost, 0),
  )
  const overallHours = createMemo(() =>
    typeof props.overallHours === 'number'
      ? props.overallHours
      : rows().reduce((sum, row) => sum + row.hoursPlayed, 0),
  )
  const hasAnyAssumedHours = createMemo(
    () => Boolean(props.overallHoursHasAssumed) || rows().some((row) => row.hasAssumedHours),
  )

  const formatMoney = (value: number): string => {
    const amount = value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${props.currencySymbol}${amount}`
  }

  const formatCostPerPlay = (cost: number, plays: number): string =>
    plays > 0 ? formatMoney(cost / plays) : '—'
  const formatCostPerHour = (cost: number, hours: number): string =>
    hours > 0 ? formatMoney(cost / hours) : '—'
  const formatHours = (hours: number): string =>
    hours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const formatPercent = (value: number): string =>
    `${(value * 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}%`
  const costPerHourTargets = [...COST_PER_HOUR_TARGET_OPTIONS].reverse()
  const overallCostPerHour = createMemo(() => {
    const hours = overallHours()
    if (hours <= 0) return undefined
    return overallCost() / hours
  })
  const averageHoursPerPlay = createMemo(() => {
    if (typeof props.averageHoursPerPlay === 'number' && props.averageHoursPerPlay > 0) {
      return props.averageHoursPerPlay
    }
    if (props.overallPlays <= 0) return undefined
    const hours = overallHours()
    if (hours <= 0) return undefined
    return hours / props.overallPlays
  })
  const playsRemainingForTarget = (targetCostPerHour: number): number | undefined => {
    const current = overallCostPerHour()
    const plays = props.overallPlays
    if (!current || current <= 0 || plays <= 0 || targetCostPerHour <= 0) return undefined
    if (current <= targetCostPerHour) return 0
    return Math.ceil(plays * (current / targetCostPerHour - 1))
  }
  const totalPlaysForTarget = (targetCostPerHour: number): number | undefined => {
    const remaining = playsRemainingForTarget(targetCostPerHour)
    if (typeof remaining !== 'number') return undefined
    return props.overallPlays + remaining
  }
  const formatTargetValue = (value: number): string =>
    `${props.currencySymbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  const costPerHourAchievementRows = createMemo(() =>
    costPerHourTargets.map((target) => {
      const current = overallCostPerHour()
      const completed = typeof current === 'number' && current <= target
      const remaining = playsRemainingForTarget(target)
      const totalTargetPlays = totalPlaysForTarget(target)
      const avgHours = averageHoursPerPlay()
      const tooltip =
        typeof totalTargetPlays === 'number' &&
        typeof current === 'number' &&
        typeof avgHours === 'number'
          ? [
              `${props.overallPlays.toLocaleString()}/${totalTargetPlays.toLocaleString()} plays`,
              `Current cost/hour: ${formatMoney(current)}`,
              `Target cost/hour: ${formatTargetValue(target)}`,
              `Assumption: ${avgHours.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}h per play (same as current average)`,
            ].join(' • ')
          : undefined

      return { target, completed, remaining, totalTargetPlays, tooltip }
    }),
  )

  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title ?? 'Cost Per Play'}</h3>
      <div class="tableWrap compact">
        <table class="table compactTable mobileCardTable">
          <thead>
            <tr>
              <th>Box / Expansion</th>
              <th class="mono">Cost</th>
              <th class="mono">Plays</th>
              <th class="mono">Hours</th>
              <th class="mono">Cost / play</th>
              <th class="mono">Cost / hour</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => (
                <tr>
                  <td data-label="Box / Expansion">{row.box}</td>
                  <td class="mono" data-label="Cost">{formatMoney(row.cost)}</td>
                  <td class="mono" data-label="Plays">
                    <Show
                      when={Boolean(props.onPlaysClick) && row.plays > 0}
                      fallback={row.plays.toLocaleString()}
                    >
                      <button
                        type="button"
                        class="countLink"
                        onClick={() => props.onPlaysClick?.(row.box)}
                        title="View plays"
                      >
                        {row.plays.toLocaleString()}
                      </button>
                    </Show>
                  </td>
                  <td class="mono" data-label="Hours">
                    {formatHours(row.hoursPlayed)}
                    {row.hasAssumedHours ? '*' : ''}
                  </td>
                  <td class="mono" data-label="Cost / play">{formatCostPerPlay(row.cost, row.plays)}</td>
                  <td class="mono" data-label="Cost / hour">{formatCostPerHour(row.cost, row.hoursPlayed)}</td>
                </tr>
              )}
            </For>
            <tr>
              <td class="costsSummaryLabel" data-label="Box / Expansion">Overall</td>
              <td class="mono" data-label="Cost">{formatMoney(overallCost())}</td>
              <td class="mono" data-label="Plays">{props.overallPlays.toLocaleString()}</td>
              <td class="mono" data-label="Hours">
                {formatHours(overallHours())}
                {hasAnyAssumedHours() ? '*' : ''}
              </td>
              <td class="mono" data-label="Cost / play">{formatCostPerPlay(overallCost(), props.overallPlays)}</td>
              <td class="mono" data-label="Cost / hour">{formatCostPerHour(overallCost(), overallHours())}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Show when={hasAnyAssumedHours()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length.
        </div>
      </Show>
      <div class="tableWrap compact">
        <table class="table compactTable mobileCardTable">
          <thead>
            <tr>
              <th>Cost/hour achievement</th>
              <th class="mono">Target</th>
              <th class="mono">Progress</th>
              <th class="mono">Status</th>
              <th class="mono">Plays remaining</th>
            </tr>
          </thead>
          <tbody>
            <For each={costPerHourAchievementRows()}>
              {(row) => {
                const progress =
                  typeof row.totalTargetPlays === 'number' && row.totalTargetPlays > 0
                    ? Math.min(1, props.overallPlays / row.totalTargetPlays)
                    : undefined
                return (
                  <tr>
                    <td data-label="Cost/hour achievement">
                      Bring cost/hour to {formatTargetValue(row.target)}
                    </td>
                    <td class="mono" data-label="Target">{formatTargetValue(row.target)}</td>
                    <td class="costProgressTableCell" data-label="Progress">
                      <Show when={typeof row.totalTargetPlays === 'number'} fallback="—">
                        <div class="costProgressCell">
                          <ProgressBar
                            value={props.overallPlays}
                            target={row.totalTargetPlays!}
                            widthPx={156}
                            label={row.tooltip}
                            showLabel={false}
                          />
                          <div class="costProgressMeta">
                            <span class="mono">{typeof progress === 'number' ? formatPercent(progress) : '—'}</span>
                            <span class="mono muted">
                              {props.overallPlays.toLocaleString()}/{row.totalTargetPlays!.toLocaleString()} plays
                            </span>
                          </div>
                        </div>
                      </Show>
                    </td>
                    <td data-label="Status">{row.completed ? 'Unlocked' : 'In progress'}</td>
                    <td class="mono" data-label="Plays remaining">
                      {typeof row.remaining === 'number' ? row.remaining.toLocaleString() : '—'}
                    </td>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
