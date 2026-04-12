import { For, Show, createMemo } from 'solid-js'
import type { BggPlay } from './bgg'
import { totalPlayMinutesWithAssumption } from './playDuration'
import { playQuantity } from './playsHelpers'

type MonthlySummaryRow = {
  monthKey: string
  monthLabel: string
  plays: number
  minutes: number
  hasAssumedHours: boolean
}

const FIRST_MONTH_KEY = '2025-10'

function monthKeyFromDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value.slice(0, 7)
}

function formatMonthKey(monthKey: string): string {
  const parts = monthKey.split('-')
  if (parts.length !== 2) return monthKey

  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return monthKey
  }

  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function formatShortMonthKey(monthKey: string): string {
  const parts = monthKey.split('-')
  if (parts.length !== 2) return monthKey

  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return monthKey
  }

  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: 'short',
  })
}

function monthIndexFromKey(monthKey: string): number | null {
  const parts = monthKey.split('-')
  if (parts.length !== 2) return null

  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return year * 12 + (month - 1)
}

function monthKeyFromIndex(index: number): string {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatHours(minutes: number): string {
  return (minutes / 60).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours <= 0) return `${mins}m`
  if (mins <= 0) return `${hours}h`
  return `${hours}h${String(mins).padStart(2, '0')}m`
}

export default function MonthlySummaryView(props: {
  plays: BggPlay[]
  assumedMinutesByObjectId: ReadonlyMap<string, number>
}) {
  const rowsByMonthKey = createMemo(() => {
    const rows = new Map<string, MonthlySummaryRow>()

    for (const play of props.plays) {
      const monthKey = monthKeyFromDate(play.attributes.date || '')
      if (!monthKey) continue

      const objectid = play.item?.attributes.objectid || ''
      const assumedMinutesPerPlay = objectid ? props.assumedMinutesByObjectId.get(objectid) : undefined
      const resolved = totalPlayMinutesWithAssumption({
        attributes: play.attributes,
        quantity: playQuantity(play),
        assumedMinutesPerPlay,
      })

      const existing = rows.get(monthKey)
      if (existing) {
        existing.plays += playQuantity(play)
        existing.minutes += resolved.minutes
        existing.hasAssumedHours ||= resolved.assumed
        continue
      }

      rows.set(monthKey, {
        monthKey,
        monthLabel: formatMonthKey(monthKey),
        plays: playQuantity(play),
        minutes: resolved.minutes,
        hasAssumedHours: resolved.assumed,
      })
    }

    return rows
  })

  const rows = createMemo<MonthlySummaryRow[]>(() => {
    const startIndex = monthIndexFromKey(FIRST_MONTH_KEY)
    if (startIndex === null) return []

    const now = new Date()
    const currentIndex = now.getFullYear() * 12 + now.getMonth()

    let endIndex = currentIndex
    for (const monthKey of rowsByMonthKey().keys()) {
      const monthIndex = monthIndexFromKey(monthKey)
      if (monthIndex !== null) endIndex = Math.max(endIndex, monthIndex)
    }

    const filledRows: MonthlySummaryRow[] = []
    for (let index = endIndex; index >= startIndex; index -= 1) {
      const monthKey = monthKeyFromIndex(index)
      filledRows.push(
        rowsByMonthKey().get(monthKey) || {
          monthKey,
          monthLabel: formatMonthKey(monthKey),
          plays: 0,
          minutes: 0,
          hasAssumedHours: false,
        },
      )
    }

    return filledRows
  })

  const chartRows = createMemo<MonthlySummaryRow[]>(() => [...rows()].reverse())

  const maxChartHours = createMemo(() => {
    let maxHours = 0
    for (const row of chartRows()) {
      maxHours = Math.max(maxHours, row.minutes / 60)
    }
    return maxHours
  })

  const chartUpperBoundHours = createMemo(() => {
    const rawMax = maxChartHours()
    if (rawMax <= 0) return 5
    return Math.max(5, Math.ceil(rawMax / 5) * 5)
  })

  const chartTicks = createMemo(() => {
    const upper = chartUpperBoundHours()
    return [upper, upper * 0.75, upper * 0.5, upper * 0.25, 0]
  })

  const totals = createMemo(() => {
    let plays = 0
    let minutes = 0
    let hasAssumedHours = false

    for (const row of rows()) {
      plays += row.plays
      minutes += row.minutes
      hasAssumedHours ||= row.hasAssumedHours
    }

    return {
      plays,
      minutes,
      hasAssumedHours,
    }
  })

  return (
    <div class="statsBlock">
      <div class="meta">
        Months shown: <span class="mono">{rows().length.toLocaleString()}</span>
        {' • '}
        Total hours: <span class="mono">{formatHours(totals().minutes)}</span>
        {' • '}
        Total plays: <span class="mono">{totals().plays.toLocaleString()}</span>
      </div>

      <Show when={chartRows().length > 0}>
        <div
          aria-label="Monthly hours played bar chart"
          role="img"
          style={{
            display: 'grid',
            gap: '10px',
            'margin-bottom': '12px',
            padding: '14px',
            'border-radius': '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015))',
          }}
        >
          <div class="monthlySummaryLabel">Hours played by month</div>
          <div
            class="tableWrap"
            style={{
              padding: '10px',
              background: 'linear-gradient(180deg, rgba(9, 12, 22, 0.36), rgba(9, 12, 22, 0.2))',
            }}
          >
            <svg
              viewBox={`0 0 ${Math.max(680, chartRows().length * 84)} 260`}
              preserveAspectRatio="none"
              style={{
                display: 'block',
                width: '100%',
                height: '260px',
                overflow: 'visible',
              }}
            >
              {(() => {
                const svgWidth = Math.max(680, chartRows().length * 84)
                const svgHeight = 260
                const marginTop = 16
                const marginRight = 16
                const marginBottom = 52
                const marginLeft = 52
                const plotWidth = svgWidth - marginLeft - marginRight
                const plotHeight = svgHeight - marginTop - marginBottom
                const slotWidth = plotWidth / Math.max(chartRows().length, 1)
                const barWidth = Math.max(20, Math.min(slotWidth - 18, 44))

                return (
                  <>
                    <rect
                      x={marginLeft}
                      y={marginTop}
                      width={plotWidth}
                      height={plotHeight}
                      rx="12"
                      fill="rgba(255, 255, 255, 0.018)"
                      stroke="rgba(255, 255, 255, 0.06)"
                    />

                    <For each={chartTicks()}>
                      {(tick) => {
                        const y = marginTop + plotHeight - (tick / chartUpperBoundHours()) * plotHeight
                        return (
                          <>
                            <line
                              x1={marginLeft}
                              y1={y}
                              x2={marginLeft + plotWidth}
                              y2={y}
                              stroke="rgba(255, 255, 255, 0.08)"
                              stroke-width="1"
                            />
                            <text
                              x={marginLeft - 10}
                              y={y + 4}
                              text-anchor="end"
                              fill="var(--muted)"
                              font-size="12"
                              font-weight="500"
                            >
                              {tick.toFixed(tick % 1 === 0 ? 0 : 1)}h
                            </text>
                          </>
                        )
                      }}
                    </For>

                    <For each={chartRows()}>
                      {(row, index) => {
                        const hours = row.minutes / 60
                        const x = marginLeft + slotWidth * index() + (slotWidth - barWidth) / 2
                        const barHeight = (hours / chartUpperBoundHours()) * plotHeight
                        const y = marginTop + plotHeight - barHeight
                        const monthLabel = formatShortMonthKey(row.monthKey)

                        return (
                          <g>
                            <title>
                              {`${row.monthLabel}: ${formatHours(row.minutes)}h across ${row.plays.toLocaleString()} play${row.plays === 1 ? '' : 's'}`}
                            </title>
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={Math.max(barHeight, 0)}
                              rx="8"
                              fill={row.minutes > 0 ? 'rgba(91, 191, 241, 0.92)' : 'rgba(255, 255, 255, 0.07)'}
                            />
                            <Show when={row.minutes > 0}>
                              <text
                                x={x + barWidth / 2}
                                y={Math.max(y - 10, marginTop + 14)}
                                text-anchor="middle"
                                fill="rgba(214, 238, 250, 0.98)"
                                font-size="12"
                                font-weight="600"
                                letter-spacing="0.01em"
                              >
                                {`${formatHours(row.minutes)}h`}
                              </text>
                            </Show>
                            <text
                              x={x + barWidth / 2}
                              y={marginTop + plotHeight + 20}
                              text-anchor="middle"
                              fill="var(--text)"
                              font-size="12"
                              font-weight="600"
                            >
                              {monthLabel}
                            </text>
                            <text
                              x={x + barWidth / 2}
                              y={marginTop + plotHeight + 36}
                              text-anchor="middle"
                              fill="var(--muted)"
                              font-size="11"
                              font-weight="500"
                            >
                              {`'${row.monthKey.slice(2, 4)}`}
                            </text>
                          </g>
                        )
                      }}
                    </For>
                  </>
                )
              })()}
            </svg>
          </div>
        </div>
      </Show>

      <div class="tableWrap">
        <table class="table mobileCardTable">
          <thead>
            <tr>
              <th>Month</th>
              <th class="mono">Hours played</th>
              <th class="mono">Plays</th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={rows().length > 0}
              fallback={
                <tr>
                  <td colSpan={3} class="muted">
                    No plays found yet.
                  </td>
                </tr>
              }
            >
              <For each={rows()}>
                {(row) => (
                  <tr>
                    <td data-label="Month">{row.monthLabel}</td>
                    <td class="mono" data-label="Hours played" title={formatMinutes(row.minutes)}>
                      {formatHours(row.minutes)}
                      <Show when={row.hasAssumedHours}>
                        <span class="muted"> *</span>
                      </Show>
                    </td>
                    <td class="mono" data-label="Plays">
                      {row.plays.toLocaleString()}
                    </td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      <Show when={totals().hasAssumedHours}>
        <div class="meta">
          <span class="mono">*</span> Estimated from BGG average play time when length is missing.
        </div>
      </Show>
    </div>
  )
}
