import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from './bgg'
import ProgressBar from './components/ProgressBar'
import { costRegistry } from './costRegistry'
import {
  COST_PER_HOUR_TARGET_OPTIONS,
  DEFAULT_COST_PER_HOUR_TARGET,
  isCostPerHourTarget,
} from './costTargets'
import { totalPlayMinutesWithAssumption } from './playDuration'
import {
  GAME_STATUS_OPTIONS,
  gamePreferencesFor,
  gameStatusLabel,
  isGameStatus,
  type GameStatus,
  shouldShowGameInCostsTable,
} from './gamePreferences'
import { isGameTab, type GameTab } from './gameCatalog'
import GameOptionsButton from './components/GameOptionsButton'

type CostsRow = {
  id: string
  name: string
  status: GameStatus
  statusLabel: string
  currencySymbol: string
  totalCost: number
  plays: number
  hours: number
  hasAssumedHours: boolean
  costPerHour?: number
}

type SortKey = 'name' | 'plays' | 'hours' | 'totalCost' | 'costPerHour' | 'progressToTarget'
type SortDirection = 'asc' | 'desc'
const COSTS_TARGET_STORAGE_KEY = 'costs.targetCostPerHour'
const COSTS_VISIBLE_STATUSES_STORAGE_KEY = 'costs.visibleStatuses'

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

function hoursNeededForTarget(totalCost: number, targetCostPerHour: number): number | undefined {
  if (totalCost <= 0 || targetCostPerHour <= 0) return undefined
  return totalCost / targetCostPerHour
}

function progressToTarget(totalCost: number, hours: number, targetCostPerHour: number): number | undefined {
  const targetHours = hoursNeededForTarget(totalCost, targetCostPerHour)
  if (targetHours == null || targetHours <= 0) return undefined
  return Math.min(1, hours / targetHours)
}

function readStoredTarget(): number {
  if (typeof window === 'undefined') return DEFAULT_COST_PER_HOUR_TARGET
  try {
    const parsed = Number(window.localStorage.getItem(COSTS_TARGET_STORAGE_KEY) || '')
    return isCostPerHourTarget(parsed) ? parsed : DEFAULT_COST_PER_HOUR_TARGET
  } catch {
    return DEFAULT_COST_PER_HOUR_TARGET
  }
}

function allGameStatuses(): GameStatus[] {
  return GAME_STATUS_OPTIONS.map((option) => option.value)
}

function readStoredVisibleStatuses(): GameStatus[] {
  if (typeof window === 'undefined') return allGameStatuses()

  try {
    const raw = window.localStorage.getItem(COSTS_VISIBLE_STATUSES_STORAGE_KEY)
    if (!raw) return allGameStatuses()

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return allGameStatuses()
    if (parsed.length === 0) return []

    const visibleStatuses = parsed.filter(isGameStatus)
    return visibleStatuses.length > 0 ? Array.from(new Set(visibleStatuses)) : allGameStatuses()
  } catch {
    return allGameStatuses()
  }
}

export default function CostsView(props: {
  plays: BggPlay[]
  assumedMinutesByObjectId: ReadonlyMap<string, number>
  onOpenGameOptions: (gameId: GameTab) => void
  costTimeEstimateStatus: {
    total: number
    complete: number
    assumed: number
    checkedWithoutEstimate: number
    failed: number
    inFlight: number
    queued: number
    pending: number
    active: boolean
  }
}) {
  const [sortKey, setSortKey] = createSignal<SortKey>('costPerHour')
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('asc')
  const [targetCostPerHour, setTargetCostPerHour] = createSignal<number>(readStoredTarget())
  const [visibleStatuses, setVisibleStatuses] = createSignal<GameStatus[]>(readStoredVisibleStatuses())

  createEffect(() => {
    try {
      window.localStorage.setItem(COSTS_TARGET_STORAGE_KEY, String(targetCostPerHour()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(
        COSTS_VISIBLE_STATUSES_STORAGE_KEY,
        JSON.stringify(visibleStatuses()),
      )
    } catch {
      return
    }
  })

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

    return costRegistry
      .filter((entry) => shouldShowGameInCostsTable(entry.id))
      .map((entry) => {
        const status = isGameTab(entry.id) ? gamePreferencesFor(entry.id).status : 'active'
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

        return {
          id: entry.id,
          name: entry.label,
          status,
          statusLabel: gameStatusLabel(status),
          currencySymbol: entry.costs.currencySymbol,
          totalCost,
          plays,
          hours,
          hasAssumedHours,
          costPerHour,
        }
      })
  })

  const visibleStatusSet = createMemo(() => new Set(visibleStatuses()))
  const filteredRows = createMemo(() =>
    rows().filter((row) => visibleStatusSet().has(row.status)),
  )

  const hasAnyAssumedHours = createMemo(() => filteredRows().some((row) => row.hasAssumedHours))
  const overallCurrencySymbol = createMemo(
    () =>
      filteredRows().find((row) => row.totalCost > 0)?.currencySymbol ||
      filteredRows()[0]?.currencySymbol ||
      rows().find((row) => row.totalCost > 0)?.currencySymbol ||
      rows()[0]?.currencySymbol ||
      '£',
  )

  const sortedRows = createMemo(() => {
    const key = sortKey()
    const direction = sortDirection()

    return filteredRows()
      .slice()
      .sort((a, b) => {
        const target = targetCostPerHour()
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
        return compareOptionalNumber(
          progressToTarget(a.totalCost, a.hours, target),
          progressToTarget(b.totalCost, b.hours, target),
          direction,
        )
      })
  })

  const totals = createMemo(() => {
    let totalCost = 0
    let plays = 0
    let hours = 0
    let hasAssumedHours = false
    for (const row of filteredRows()) {
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
  const formatTargetValue = (value: number, currencySymbol: string): string =>
    `${currencySymbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`

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

  const toggleStatusFilter = (status: GameStatus) => {
    setVisibleStatuses((current) => {
      const next = current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status]

      return GAME_STATUS_OPTIONS.map((option) => option.value).filter((value) => next.includes(value))
    })
  }

  const progressHeading = createMemo(
    () => `Progress to ${formatTargetValue(targetCostPerHour(), overallCurrencySymbol())}/hour`,
  )
  const costTimeEstimateLabel = createMemo(() => {
    const status = props.costTimeEstimateStatus
    return `Checked ${status.complete.toLocaleString()} of ${status.total.toLocaleString()} games with missing play times`
  })
  const costTimeEstimateSummary = createMemo(() => {
    const status = props.costTimeEstimateStatus
    const parts: string[] = []
    if (status.pending > 0) parts.push(`${status.pending.toLocaleString()} waiting to queue`)
    if (status.queued > 0) parts.push(`${status.queued.toLocaleString()} queued`)
    if (status.inFlight > 0) parts.push(`${status.inFlight.toLocaleString()} loading from BGG`)
    if (status.assumed > 0) parts.push(`${status.assumed.toLocaleString()} with estimated time found`)
    if (status.checkedWithoutEstimate > 0) {
      parts.push(`${status.checkedWithoutEstimate.toLocaleString()} with no usable play time`)
    }
    if (status.failed > 0) parts.push(`${status.failed.toLocaleString()} failed`)
    return parts.join(' • ')
  })
  const showCostTimeEstimateStatus = createMemo(() => {
    const status = props.costTimeEstimateStatus
    return status.total > 0 && (status.active || status.failed > 0 || status.checkedWithoutEstimate > 0)
  })

  return (
    <div class="statsBlock">
      <h3 class="statsTitle">Costs</h3>
      <Show when={showCostTimeEstimateStatus()}>
        <div class="costLoadingCard">
          <div class="costLoadingHeader">
            <div>
              <div>Estimating missing play times</div>
              <div class="muted">
                The table updates as BGG game metadata comes back for plays with no recorded length.
              </div>
            </div>
            <div class="mono muted">{costTimeEstimateLabel()}</div>
          </div>
          <ProgressBar
            value={props.costTimeEstimateStatus.complete}
            target={Math.max(1, props.costTimeEstimateStatus.total)}
            widthPx={320}
            label={costTimeEstimateLabel()}
          />
          <div class="muted">{costTimeEstimateSummary()}</div>
        </div>
      </Show>
      <div class="costsToolbar">
        <div class="costToolbarGroup">
          <div class="muted">Choose the target cost/hour to compare against.</div>
          <div class="costTargetGroup" role="group" aria-label="Cost per hour target">
            <For each={COST_PER_HOUR_TARGET_OPTIONS}>
              {(target) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: targetCostPerHour() === target }}
                  onClick={() => setTargetCostPerHour(target)}
                >
                  {formatTargetValue(target, overallCurrencySymbol())}/h
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="costToolbarGroup">
          <div class="muted">Show statuses</div>
          <div class="costTargetGroup" role="group" aria-label="Visible game statuses">
            <For each={GAME_STATUS_OPTIONS}>
              {(status) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: visibleStatuses().includes(status.value) }}
                  onClick={() => toggleStatusFilter(status.value)}
                >
                  {status.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>
      <div class="tableWrap">
        <table class="table compactTable mobileCardTable costsTable">
          <thead>
            <tr>
              <th>
                <button type="button" class="sortButton" onClick={() => toggleSort('name')}>
                  Game{sortIndicator('name')}
                </button>
              </th>
              <th>Status</th>
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
                  onClick={() => toggleSort('progressToTarget')}
                >
                  {progressHeading()}
                  {sortIndicator('progressToTarget')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={sortedRows().length > 0}
              fallback={
                <tr>
                  <td colSpan={7} class="muted">
                    No games match the selected statuses.
                  </td>
                </tr>
              }
            >
              <>
                <For each={sortedRows()}>
                  {(row) => (
                    <tr>
                      <td data-label="Game">
                        <div class="gameTitleRow">
                          <span>{row.name}</span>
                          <Show when={isGameTab(row.id) ? row.id : null}>
                            {(gameId) => (
                              <GameOptionsButton
                                gameId={gameId()}
                                gameLabel={row.name}
                                onOpenGameOptions={props.onOpenGameOptions}
                              />
                            )}
                          </Show>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span class="statusBadge">{row.statusLabel}</span>
                      </td>
                      <td class="mono" data-label="Plays">{row.plays.toLocaleString()}</td>
                      <td class="mono" data-label="Hours">
                        {formatHours(row.hours)}
                        {row.hasAssumedHours ? '*' : ''}
                      </td>
                      <td class="mono" data-label="Total cost">
                        {formatMoney(row.totalCost, row.currencySymbol)}
                      </td>
                      <td class="mono" data-label="Cost / hour">
                        <Show when={typeof row.costPerHour === 'number'} fallback="—">
                          {formatMoney(row.costPerHour!, row.currencySymbol)}
                        </Show>
                      </td>
                      <td class="costProgressTableCell" data-label={progressHeading()}>
                        <Show
                          when={typeof progressToTarget(row.totalCost, row.hours, targetCostPerHour()) === 'number'}
                          fallback="—"
                        >
                          <div class="costProgressCell">
                            <ProgressBar
                              value={row.hours}
                              target={hoursNeededForTarget(row.totalCost, targetCostPerHour())!}
                              widthPx={156}
                              label={`${row.name}: ${formatHours(row.hours)}/${formatHours(
                                hoursNeededForTarget(row.totalCost, targetCostPerHour())!,
                              )} hours needed for ${formatTargetValue(targetCostPerHour(), row.currencySymbol)}/hour`}
                              showLabel={false}
                            />
                            <div class="costProgressMeta">
                              <span class="mono">
                                {formatPercent(
                                  progressToTarget(row.totalCost, row.hours, targetCostPerHour())!,
                                )}
                              </span>
                              <span class="mono muted">
                                {formatHours(row.hours)} /{' '}
                                {formatHours(hoursNeededForTarget(row.totalCost, targetCostPerHour())!)}h
                              </span>
                            </div>
                          </div>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
                <tr>
                  <td class="costsSummaryLabel" data-label="Game">Overall</td>
                  <td data-label="Status">—</td>
                  <td class="mono" data-label="Plays">{totals().plays.toLocaleString()}</td>
                  <td class="mono" data-label="Hours">
                    {formatHours(totals().hours)}
                    {totals().hasAssumedHours ? '*' : ''}
                  </td>
                  <td class="mono" data-label="Total cost">
                    {formatMoney(totals().totalCost, overallCurrencySymbol())}
                  </td>
                  <td class="mono" data-label="Cost / hour">
                    <Show when={typeof totals().costPerHour === 'number'} fallback="—">
                      {formatMoney(totals().costPerHour!, overallCurrencySymbol())}
                    </Show>
                  </td>
                  <td class="costProgressTableCell" data-label={progressHeading()}>
                    <Show
                      when={typeof progressToTarget(totals().totalCost, totals().hours, targetCostPerHour()) === 'number'}
                      fallback="—"
                    >
                      <div class="costProgressCell">
                        <ProgressBar
                          value={totals().hours}
                          target={hoursNeededForTarget(totals().totalCost, targetCostPerHour())!}
                          widthPx={156}
                          label={`Overall: ${formatHours(totals().hours)}/${formatHours(
                            hoursNeededForTarget(totals().totalCost, targetCostPerHour())!,
                          )} hours needed for ${formatTargetValue(targetCostPerHour(), overallCurrencySymbol())}/hour`}
                          showLabel={false}
                        />
                        <div class="costProgressMeta">
                          <span class="mono">
                            {formatPercent(
                              progressToTarget(totals().totalCost, totals().hours, targetCostPerHour())!,
                            )}
                          </span>
                          <span class="mono muted">
                            {formatHours(totals().hours)} /{' '}
                            {formatHours(hoursNeededForTarget(totals().totalCost, targetCostPerHour())!)}h
                          </span>
                        </div>
                      </div>
                    </Show>
                  </td>
                </tr>
              </>
            </Show>
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
