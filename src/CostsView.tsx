import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from './bgg'
import ProgressBar from './components/ProgressBar'
import { costRegistry } from './costRegistry'
import { COST_PER_HOUR_TARGET_OPTIONS } from './costTargets'
import {
  COSTS_SALE_MODE_STORAGE_KEY,
  COSTS_TARGET_STORAGE_KEY,
  SALE_MODE_OPTIONS,
  clamp01,
  effectiveCostForSaleMode,
  formatDurationHoursMinutes,
  formatMoney,
  formatPercent,
  formatRoundedDuration,
  formatTargetValue,
  hoursNeededForTarget,
  progressToTarget,
  readStoredSaleMode,
  readStoredTarget,
  resaleValueForCost,
  type SaleMode,
} from './costsShared'
import { totalPlayMinutesWithAssumption } from './playDuration'
import {
  GAME_STATUS_OPTIONS,
  gamePreferencesFor,
  gameStatusLabel,
  isGameStatus,
  type GameStatus,
  shouldShowGameInCostsTable,
} from './gamePreferences'
import { isConfigurableGameId } from './configurableGames'
import GameLink from './components/GameLink'
import GameOptionsButton from './components/GameOptionsButton'
import { playQuantity } from './playsHelpers'

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

type DisplayCostsRow = CostsRow & {
  effectiveCost: number
  estimatedSellPrice: number
  remainingHours?: number
}

type SortKey =
  | 'name'
  | 'status'
  | 'plays'
  | 'hours'
  | 'totalCost'
  | 'costPerHour'
  | 'hoursRemainingToTarget'
  | 'progressToTarget'
type SortDirection = 'asc' | 'desc'

const COSTS_VISIBLE_STATUSES_STORAGE_KEY = 'costs.visibleStatuses'
const COSTS_CHECKLIST_ONLY_STORAGE_KEY = 'costs.checklistOnly'

function normalizeGameName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function matchesNormalizedGameName(normalizedName: string, normalizedAlias: string): boolean {
  if (!normalizedName || !normalizedAlias) return false
  return normalizedName === normalizedAlias || normalizedName.startsWith(`${normalizedAlias} `)
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

function hoursRemainingForTarget(
  totalCost: number,
  hours: number,
  targetCostPerHour: number,
): number | undefined {
  const targetHours = hoursNeededForTarget(totalCost, targetCostPerHour)
  if (targetHours == null) return undefined
  return Math.max(0, targetHours - Math.max(0, hours))
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

function readStoredChecklistOnly(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(COSTS_CHECKLIST_ONLY_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export default function CostsView(props: {
  plays: BggPlay[]
  assumedMinutesByObjectId: ReadonlyMap<string, number>
  onOpenGame: (gameKey: string) => void
  onOpenGameOptions: (gameId: string) => void
  onUpdateGamePreferences: (gameId: string, patch: { status: GameStatus }) => void
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
  const [checklistOnly, setChecklistOnly] = createSignal<boolean>(readStoredChecklistOnly())
  const [saleMode, setSaleMode] = createSignal<SaleMode>(readStoredSaleMode())

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

  createEffect(() => {
    try {
      window.localStorage.setItem(COSTS_CHECKLIST_ONLY_STORAGE_KEY, String(checklistOnly()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(COSTS_SALE_MODE_STORAGE_KEY, saleMode())
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
      if (existing) existing.push(play)
      else playedByAlias.set(name, [play])
    }

    return costRegistry
      .filter((entry) => shouldShowGameInCostsTable(entry.id))
      .map((entry) => {
        const status = isConfigurableGameId(entry.id) ? gamePreferencesFor(entry.id).status : 'active'
        const matchedPlaysById = new Map<number, BggPlay>()
        for (const alias of entry.aliases) {
          const normalizedAlias = normalizeGameName(alias)
          if (!normalizedAlias) continue
          for (const [normalizedName, plays] of playedByAlias.entries()) {
            if (!matchesNormalizedGameName(normalizedName, normalizedAlias)) continue
            for (const play of plays) matchedPlaysById.set(play.id, play)
          }
        }

        const matchedPlays = [...matchedPlaysById.values()]
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
          costPerHour: hours > 0 ? totalCost / hours : undefined,
        }
      })
  })

  const visibleStatusSet = createMemo(() => new Set(visibleStatuses()))
  const filteredRows = createMemo(() =>
    rows().filter((row) => {
      if (!visibleStatusSet().has(row.status)) return false
      if (!checklistOnly()) return true
      return isConfigurableGameId(row.id) && gamePreferencesFor(row.id).showInMonthlyChecklist
    }),
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

  const sortedRows = createMemo<DisplayCostsRow[]>(() => {
    const key = sortKey()
    const direction = sortDirection()
    const selectedSaleMode = saleMode()
    const target = targetCostPerHour()

    return filteredRows()
      .map((row) => {
        const effectiveCost = effectiveCostForSaleMode(row.totalCost, selectedSaleMode)
        return {
          ...row,
          effectiveCost,
          estimatedSellPrice: resaleValueForCost(row.totalCost, selectedSaleMode),
          remainingHours: hoursRemainingForTarget(effectiveCost, row.hours, target),
        }
      })
      .slice()
      .sort((a, b) => {
        if (key === 'name') {
          const compared = a.name.localeCompare(b.name)
          return direction === 'asc' ? compared : -compared
        }
        if (key === 'status') {
          const compared = a.statusLabel.localeCompare(b.statusLabel)
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
        if (key === 'hoursRemainingToTarget') {
          return compareOptionalNumber(a.remainingHours, b.remainingHours, direction)
        }
        return compareOptionalNumber(
          progressToTarget(a.effectiveCost, a.hours, target),
          progressToTarget(b.effectiveCost, b.hours, target),
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

  const formatHours = (value: number): string =>
    value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  const selectedSaleOption = createMemo(
    () => SALE_MODE_OPTIONS.find((option) => option.value === saleMode()) || SALE_MODE_OPTIONS[0],
  )
  const selectedSaleLabel = createMemo(() => selectedSaleOption().label)
  const selectedSaleSuffix = createMemo(() => (saleMode() === 'none' ? '' : ` (${selectedSaleLabel()})`))

  const overallResaleValue = createMemo(() => resaleValueForCost(totals().totalCost, saleMode()))
  const overallEffectiveCost = createMemo(() => effectiveCostForSaleMode(totals().totalCost, saleMode()))

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
    () => `Progress to ${formatTargetValue(targetCostPerHour(), overallCurrencySymbol())}/hour${selectedSaleSuffix()}`,
  )
  const remainingHeading = createMemo(
    () => `Hours left to ${formatTargetValue(targetCostPerHour(), overallCurrencySymbol())}/hour${selectedSaleSuffix()}`,
  )
  const visibleGameCount = createMemo(() => filteredRows().length)

  const overallProjection = createMemo(() => {
    const targetHours = hoursNeededForTarget(overallEffectiveCost(), targetCostPerHour())
    if (targetHours == null) return null

    const remainingHours = Math.max(0, targetHours - totals().hours)
    return {
      targetHours,
      remainingHours,
      isComplete: remainingHours <= 0,
    }
  })

  const overallProgress = createMemo(() => {
    const projection = overallProjection()
    if (!projection) return null

    const progress = projection.targetHours <= 0 ? 1 : clamp01(totals().hours / projection.targetHours)
    return {
      progress,
      percentLabel: formatPercent(progress),
      chartStyle: { '--progress': `${progress * 100}%` },
      splitChartStyle: { '--cost-donut-complete': `${progress * 100}%` },
    }
  })

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

  const renderCostProgress = (
    name: string,
    effectiveCost: number,
    hours: number,
    currencySymbol: string,
    detail?: string,
  ) => {
    const targetHours = hoursNeededForTarget(effectiveCost, targetCostPerHour())
    const progress = progressToTarget(effectiveCost, hours, targetCostPerHour())
    if (targetHours == null || typeof progress !== 'number') return '—'

    const label =
      targetHours <= 0
        ? `${name}: already at or below ${formatTargetValue(targetCostPerHour(), currencySymbol)}/hour${detail ? ` • ${detail}` : ''}`
        : `${name}: ${formatHours(hours)}/${formatHours(targetHours)} hours needed for ${formatTargetValue(
            targetCostPerHour(),
            currencySymbol,
          )}/hour${detail ? ` • ${detail}` : ''}`

    return (
      <div class="costProgressCell">
        <ProgressBar
          value={hours}
          target={targetHours <= 0 ? Math.max(hours, 1) : targetHours}
          widthPx={156}
          label={label}
          showLabel={false}
        />
        <div class="costProgressMeta">
          <span class="mono">{formatPercent(progress)}</span>
          <span class="mono muted">
            {targetHours <= 0 ? 'No hours needed' : `${formatHours(hours)} / ${formatHours(targetHours)}h`}
          </span>
        </div>
      </div>
    )
  }

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

      <Show when={overallProjection()}>
        {(projection) => (
          <div class="monthlySummaryGrid costsSummaryGrid">
            <section class="monthlySummaryCard monthlySummaryCardProgress costsSummaryCardChart">
              <div class="monthlySummaryLabel">
                Progress to {formatTargetValue(targetCostPerHour(), overallCurrencySymbol())}/h
              </div>
              <div
                class="monthlyProgressRing costSummaryRing"
                style={overallProgress()?.chartStyle}
                aria-label={`Overall progress: ${overallProgress()?.percentLabel || '0%'}`}
              >
                <div class="monthlyProgressInner">
                  <span class="monthlyProgressValue mono">{overallProgress()?.percentLabel || '0%'}</span>
                </div>
              </div>
              <div class="monthlySummarySubtext">
                <span class="mono">{formatRoundedDuration(totals().hours)}</span>
                {totals().hasAssumedHours ? '*' : ''}
                {' '}logged of{' '}
                <span class="mono">{formatRoundedDuration(projection().targetHours)}</span>
              </div>
            </section>

            <section class="monthlySummaryCard">
              <div class="monthlySummaryLabel">Current hours</div>
              <div class="monthlySummaryValue mono">
                {formatDurationHoursMinutes(totals().hours)}
                {totals().hasAssumedHours ? '*' : ''}
              </div>
              <div class="monthlySummarySubtext">
                Across <span class="mono">{visibleGameCount().toLocaleString()}</span> visible game
                {visibleGameCount() === 1 ? '' : 's'}
              </div>
            </section>

            <section class="monthlySummaryCard">
              <div class="monthlySummaryLabel">Projected hours left</div>
              <div class="costSummarySplit">
                <div
                  class="costDonutMini"
                  style={overallProgress()?.splitChartStyle}
                  aria-label={`Logged versus remaining hours: ${overallProgress()?.percentLabel || '0%'} logged`}
                >
                  <div class="costDonutMiniInner">
                    <span class="costDonutMiniValue mono">{overallProgress()?.percentLabel || '0%'}</span>
                  </div>
                </div>
                <div class="monthlySummaryValue mono">
                  {formatDurationHoursMinutes(projection().remainingHours)}
                  {totals().hasAssumedHours && projection().remainingHours > 0 ? '*' : ''}
                </div>
              </div>
              <div class="monthlySummarySubtext">
                <Show when={!projection().isComplete} fallback={<>Already at or below the selected target.</>}>
                  <span class="costLegend">
                    <span class="costLegendSwatch costLegendSwatchComplete" />
                    Logged
                  </span>
                  {' • '}
                  <span class="costLegend">
                    <span class="costLegendSwatch costLegendSwatchRemaining" />
                    Remaining
                  </span>
                </Show>
              </div>
            </section>
          </div>
        )}
      </Show>

      <div class="monthlySummaryGrid costsSummaryGrid costsSummaryGridSecondary">
        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Sale assumption</div>
          <div class="monthlySummaryValue mono">{selectedSaleLabel()}</div>
          <div class="monthlySummarySubtext">
            Choose whether to compare against full cost, selling at 2/3, or selling at 3/4.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Estimated sell price</div>
          <div class="monthlySummaryValue mono">{formatMoney(overallResaleValue(), overallCurrencySymbol())}</div>
          <div class="monthlySummarySubtext">
            Estimated resale value for the visible games under the selected assumption.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Effective cost to justify</div>
          <div class="monthlySummaryValue mono">{formatMoney(overallEffectiveCost(), overallCurrencySymbol())}</div>
          <div class="monthlySummarySubtext">Purchase cost minus estimated sell price.</div>
        </section>
      </div>

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
          <div class="muted">Sale assumption</div>
          <div class="costTargetGroup" role="group" aria-label="Sale assumption">
            <For each={SALE_MODE_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: saleMode() === option.value }}
                  onClick={() => setSaleMode(option.value)}
                >
                  {option.label}
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

        <div class="costToolbarGroup">
          <div class="muted">Games</div>
          <div class="costTargetGroup" role="group" aria-label="Visible cost games">
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: !checklistOnly() }}
              onClick={() => setChecklistOnly(false)}
            >
              All
            </button>
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: checklistOnly() }}
              onClick={() => setChecklistOnly(true)}
            >
              Checklist only
            </button>
          </div>
        </div>
      </div>

      <div class="tableWrap">
        <table class="table compactTable mobileCardTable costsTable">
          <thead>
            <tr>
              <th class="mono">#</th>
              <th>
                <button type="button" class="sortButton" onClick={() => toggleSort('name')}>
                  Game{sortIndicator('name')}
                </button>
              </th>
              <th>
                <button type="button" class="sortButton" onClick={() => toggleSort('status')}>
                  Status{sortIndicator('status')}
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
              <th class="mono">
                <button type="button" class="sortButton" onClick={() => toggleSort('hoursRemainingToTarget')}>
                  {remainingHeading()}
                  {sortIndicator('hoursRemainingToTarget')}
                </button>
              </th>
              <th>
                <button type="button" class="sortButton" onClick={() => toggleSort('progressToTarget')}>
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
                  <td colSpan={9} class="muted">
                    No games match the selected filters.
                  </td>
                </tr>
              }
            >
              <>
                <For each={sortedRows()}>
                  {(row, index) => (
                    <tr>
                        <td class="mono" data-label="#">{index() + 1}</td>
                        <td data-label="Game">
                          <div class="gameTitleRow">
                            <GameLink label={row.name} gameKey={row.id} onOpenGame={props.onOpenGame} />
                            <Show when={isConfigurableGameId(row.id) ? row.id : null}>
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
                          <Show
                            when={isConfigurableGameId(row.id) ? row.id : null}
                            fallback={<span class="statusBadge">{row.statusLabel}</span>}
                          >
                            {(gameId) => (
                              <select
                                class="statusBadge statusBadgeSelect costsStatusSelect"
                                value={row.status}
                                aria-label={`Status for ${row.name}`}
                                onChange={(event) => {
                                  const status = event.currentTarget.value
                                  if (!isGameStatus(status)) return
                                  props.onUpdateGamePreferences(gameId(), { status })
                                }}
                              >
                                <For each={GAME_STATUS_OPTIONS}>
                                  {(option) => <option value={option.value}>{option.label}</option>}
                                </For>
                              </select>
                            )}
                          </Show>
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
                        <td class="mono" data-label={remainingHeading()}>
                          {(() => {
                            const remainingHours = row.remainingHours
                            if (remainingHours == null) return '—'
                            return (
                              <span
                                title={`Estimated sell price: ${formatMoney(row.estimatedSellPrice, row.currencySymbol)}`}
                              >
                                {formatDurationHoursMinutes(remainingHours)}
                                {row.hasAssumedHours && remainingHours > 0 ? '*' : ''}
                              </span>
                            )
                          })()}
                        </td>
                        <td class="costProgressTableCell" data-label={progressHeading()}>
                          {renderCostProgress(
                            row.name,
                            row.effectiveCost,
                            row.hours,
                            row.currencySymbol,
                            `Estimated sell price: ${formatMoney(row.estimatedSellPrice, row.currencySymbol)}`,
                          )}
                        </td>
                      </tr>
                  )}
                </For>
                <tr>
                  <td class="mono" data-label="#">—</td>
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
                  <td class="mono" data-label={remainingHeading()}>
                    <Show when={overallProjection()} keyed fallback="—">
                      {(projection) => (
                        <span
                          title={`Estimated sell price: ${formatMoney(overallResaleValue(), overallCurrencySymbol())}`}
                        >
                          {formatDurationHoursMinutes(projection.remainingHours)}
                          {totals().hasAssumedHours && projection.remainingHours > 0 ? '*' : ''}
                        </span>
                      )}
                    </Show>
                  </td>
                  <td class="costProgressTableCell" data-label={progressHeading()}>
                    {renderCostProgress(
                      'Overall',
                      overallEffectiveCost(),
                      totals().hours,
                      overallCurrencySymbol(),
                      `Estimated sell price: ${formatMoney(overallResaleValue(), overallCurrencySymbol())}`,
                    )}
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
