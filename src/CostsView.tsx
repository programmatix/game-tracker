import { For, Show, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from './bgg'
import ProgressBar from './components/ProgressBar'
import { costRegistry } from './costRegistry'
import { totalPlayMinutesWithAssumption } from './playDuration'

type CostsRow = {
  id: string
  name: string
  currencySymbol: string
  totalCost: number
  plays: number
  hours: number
  hasAssumedHours: boolean
  costPerHour?: number
  progressToOnePerHour?: number
}

type SortKey = 'name' | 'plays' | 'hours' | 'totalCost' | 'costPerHour' | 'progressToOnePerHour'
type SortDirection = 'asc' | 'desc'

function normalizeGameName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function compareOptionalNumber(
  a: number | undefined,
  b: number | undefined,
  direction: SortDirection,
): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return direction === 'asc' ? a - b : b - a
}

export default function CostsView(props: {
  plays: BggPlay[]
  assumedMinutesByObjectId: ReadonlyMap<string, number>
}) {
  const [sortKey, setSortKey] = createSignal<SortKey>('costPerHour')
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('asc')

  const rows = createMemo<CostsRow[]>(() => {
    const playedByAlias = new Map<string, BggPlay[]>()
    for (const play of props.plays) {
      const name = normalizeGameName(play.item?.attributes.name || '')
      if (!name) continue
      const existing = playedByAlias.get(name)
      if (existing) {
        existing.push(play)
      } else {
        playedByAlias.set(name, [play])
      }
    }

    return costRegistry.map((entry) => {
      const matchedPlays = entry.aliases.flatMap(
        (alias) => playedByAlias.get(normalizeGameName(alias)) || [],
      )
      const totalCost = [...entry.costs.boxCostsByName.values()].reduce((sum, cost) => sum + cost, 0)

      let plays = 0
      let hours = 0
      let hasAssumedHours = false

      for (const play of matchedPlays) {
        const quantity = playQuantity(play)
        const assumedMinutesPerPlay = play.item?.attributes.objectid
          ? props.assumedMinutesByObjectId.get(play.item.attributes.objectid)
          : undefined
        const resolved = totalPlayMinutesWithAssumption({
          attributes: play.attributes,
          quantity,
          assumedMinutesPerPlay,
        })
        plays += quantity
        hours += resolved.minutes / 60
        hasAssumedHours ||= resolved.assumed
      }

      const costPerHour = hours > 0 ? totalCost / hours : undefined
      const progressToOnePerHour = totalCost > 0 ? Math.min(1, hours / totalCost) : undefined

      return {
        id: entry.id,
        name: entry.label,
        currencySymbol: entry.costs.currencySymbol,
        totalCost,
        plays,
        hours,
        hasAssumedHours,
        costPerHour,
        progressToOnePerHour,
      }
    })
  })

  const hasAnyAssumedHours = createMemo(() => rows().some((row) => row.hasAssumedHours))
  const overallCurrencySymbol = createMemo(
    () => rows().find((row) => row.totalCost > 0)?.currencySymbol || rows()[0]?.currencySymbol || '£',
  )

  const sortedRows = createMemo(() => {
    const key = sortKey()
    const direction = sortDirection()

    return rows()
      .slice()
      .sort((a, b) => {
        if (key === 'name') {
          const compared = a.name.localeCompare(b.name)
          return direction === 'asc' ? compared : -compared
        }
        if (key === 'plays') return direction === 'asc' ? a.plays - b.plays : b.plays - a.plays
        if (key === 'hours') return direction === 'asc' ? a.hours - b.hours : b.hours - a.hours
        if (key === 'totalCost') {
          return direction === 'asc' ? a.totalCost - b.totalCost : b.totalCost - a.totalCost
        }
        if (key === 'costPerHour') {
          return compareOptionalNumber(a.costPerHour, b.costPerHour, direction)
        }
        return compareOptionalNumber(a.progressToOnePerHour, b.progressToOnePerHour, direction)
      })
  })

  const totals = createMemo(() => {
    let totalCost = 0
    let plays = 0
    let hours = 0
    let hasAssumedHours = false
    for (const row of rows()) {
      totalCost += row.totalCost
      plays += row.plays
      hours += row.hours
      hasAssumedHours ||= row.hasAssumedHours
    }
    return {
      totalCost,
      plays,
      hours,
      hasAssumedHours,
      costPerHour: hours > 0 ? totalCost / hours : undefined,
      progressToOnePerHour: totalCost > 0 ? Math.min(1, hours / totalCost) : undefined,
    }
  })

  const formatMoney = (value: number, currencySymbol: string): string =>
    `${currencySymbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  const formatHours = (value: number): string =>
    value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const formatPercent = (value: number): string =>
    `${(value * 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}%`

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey() === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection(nextKey === 'costPerHour' ? 'asc' : 'desc')
  }

  const sortIndicator = (key: SortKey): string => {
    if (sortKey() !== key) return ''
    return sortDirection() === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div class="statsBlock">
      <h3 class="statsTitle">Costs</h3>
      <div class="tableWrap">
        <table class="table">
          <thead>
            <tr>
              <th>
                <button type="button" class="sortButton" onClick={() => toggleSort('name')}>
                  Game{sortIndicator('name')}
                </button>
              </th>
              <th class="mono">
                <button type="button" class="sortButton" onClick={() => toggleSort('plays')}>
                  Plays{sortIndicator('plays')}
                </button>
              </th>
              <th class="mono">
                <button type="button" class="sortButton" onClick={() => toggleSort('hours')}>
                  Hours{sortIndicator('hours')}
                </button>
              </th>
              <th class="mono">
                <button type="button" class="sortButton" onClick={() => toggleSort('totalCost')}>
                  Total cost{sortIndicator('totalCost')}
                </button>
              </th>
              <th class="mono">
                <button type="button" class="sortButton" onClick={() => toggleSort('costPerHour')}>
                  Cost / hour{sortIndicator('costPerHour')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  class="sortButton"
                  onClick={() => toggleSort('progressToOnePerHour')}
                >
                  Progress to £1/hour{sortIndicator('progressToOnePerHour')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={sortedRows()}>
              {(row) => (
                <tr>
                  <td>{row.name}</td>
                  <td class="mono">{row.plays.toLocaleString()}</td>
                  <td class="mono">
                    {formatHours(row.hours)}
                    {row.hasAssumedHours ? '*' : ''}
                  </td>
                  <td class="mono">{formatMoney(row.totalCost, row.currencySymbol)}</td>
                  <td class="mono">
                    <Show when={typeof row.costPerHour === 'number'} fallback="—">
                      {formatMoney(row.costPerHour!, row.currencySymbol)}
                    </Show>
                  </td>
                  <td>
                    <Show when={typeof row.progressToOnePerHour === 'number'} fallback="—">
                      <div class="costProgressCell">
                        <ProgressBar
                          value={row.hours}
                          target={row.totalCost}
                          widthPx={120}
                          label={`${row.name}: ${formatHours(row.hours)}/${formatHours(
                            row.totalCost,
                          )} hours needed for £1/hour`}
                          showLabel={false}
                        />
                        <span class="mono muted">{formatPercent(row.progressToOnePerHour!)}</span>
                      </div>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
            <tr>
              <th>Overall</th>
              <th class="mono">{totals().plays.toLocaleString()}</th>
              <th class="mono">
                {formatHours(totals().hours)}
                {totals().hasAssumedHours ? '*' : ''}
              </th>
              <th class="mono">{formatMoney(totals().totalCost, overallCurrencySymbol())}</th>
              <th class="mono">
                <Show when={typeof totals().costPerHour === 'number'} fallback="—">
                  {formatMoney(totals().costPerHour!, overallCurrencySymbol())}
                </Show>
              </th>
              <th>
                <Show when={typeof totals().progressToOnePerHour === 'number'} fallback="—">
                  <div class="costProgressCell">
                    <ProgressBar
                      value={totals().hours}
                      target={totals().totalCost}
                      widthPx={120}
                      label={`Overall: ${formatHours(totals().hours)}/${formatHours(
                        totals().totalCost,
                      )} hours needed for £1/hour`}
                      showLabel={false}
                    />
                    <span class="mono muted">{formatPercent(totals().progressToOnePerHour!)}</span>
                  </div>
                </Show>
              </th>
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
    </div>
  )
}
