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
