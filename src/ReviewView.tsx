import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from './bgg'
import { buildCampaignProgressRows } from './campaignProgress'
import GameLink from './components/GameLink'
import GameOptionsButton from './components/GameOptionsButton'
import ProgressBar from './components/ProgressBar'
import StandardGameFilters from './components/StandardGameFilters'
import { isConfigurableGameId } from './configurableGames'
import { costRegistry } from './costRegistry'
import { COST_PER_HOUR_TARGET_OPTIONS } from './costTargets'
import {
  COSTS_SALE_MODE_STORAGE_KEY,
  COSTS_TARGET_STORAGE_KEY,
  SALE_MODE_OPTIONS,
  effectiveCostForSaleMode,
  formatDurationHoursMinutes,
  formatMoney,
  formatPercent,
  formatTargetValue,
  hoursNeededForTarget,
  progressToTarget,
  readStoredSaleMode,
  readStoredTarget,
  resaleValueForCost,
  type SaleMode,
} from './costsShared'
import {
  GAME_STATUS_OPTIONS,
  gamePreferencesFor,
  gameStatusLabel,
  isGameStatus,
  shouldShowGameInCostsTable,
  type GameStatus,
} from './gamePreferences'
import {
  readStoredChecklistOnly,
  readStoredVisibleGameStatuses,
  toggleVisibleGameStatus,
} from './gameFilters'
import { totalPlayMinutesWithAssumption } from './playDuration'
import { playQuantity } from './playsHelpers'

type ReviewRow = {
  id: string
  name: string
  status: GameStatus
  statusLabel: string
  showInChecklist: boolean
  isCampaignGame: boolean
  isScenarioGame: boolean
  currencySymbol: string
  totalCost: number
  plays: number
  hours: number
  hasAssumedHours: boolean
  costPerHour?: number
  hasProgressTracker: boolean
  completedCount: number
  totalCount: number
  progress: number
  progressLabel: string
}

type DisplayReviewRow = ReviewRow & {
  effectiveCost: number
  estimatedSellPrice: number
  costTargetHours: number
  costProgress: number
  costRemainingHours: number
  timeProgress: number
  timeRemainingHours: number
}

type SortKey =
  | 'name'
  | 'status'
  | 'plays'
  | 'hours'
  | 'totalCost'
  | 'costPerHour'
  | 'hoursRemainingToCostTarget'
  | 'hoursRemainingToTimeTarget'

type SortDirection = 'asc' | 'desc'
type HoursFilter = 'any' | '0' | 'lt5' | 'lt10' | 'lt20'

const REVIEW_VISIBLE_STATUSES_STORAGE_KEY = 'review.visibleStatuses'
const REVIEW_CHECKLIST_ONLY_STORAGE_KEY = 'review.checklistOnly'
const REVIEW_SHOW_CAMPAIGN_STORAGE_KEY = 'review.showCampaign'
const REVIEW_SHOW_SCENARIO_STORAGE_KEY = 'review.showScenario'
const REVIEW_SHOW_NEITHER_STORAGE_KEY = 'review.showNeither'
const REVIEW_HOURS_FILTER_STORAGE_KEY = 'games.hoursFilter'
const TIME_TARGET_STORAGE_KEY = 'time.targetHoursPerGame'
const TIME_TARGET_OPTIONS = [5, 10, 25, 50] as const
const HOURS_FILTER_OPTIONS: ReadonlyArray<{ value: HoursFilter; label: string }> = [
  { value: '0', label: '0' },
  { value: 'lt5', label: '< 5' },
  { value: 'lt10', label: '< 10' },
  { value: 'lt20', label: '< 20' },
  { value: 'any', label: 'Any' },
]

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

function formatHours(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function hoursRemainingForTimeTarget(hours: number, targetHours: number): number {
  if (!Number.isFinite(targetHours) || targetHours <= 0) return 0
  return Math.max(0, targetHours - Math.max(0, hours))
}

function progressToHoursTarget(hours: number, targetHours: number): number {
  if (!Number.isFinite(targetHours) || targetHours <= 0) return 1
  return clamp01(Math.max(0, hours) / targetHours)
}

function isTimeTarget(value: number): value is (typeof TIME_TARGET_OPTIONS)[number] {
  return TIME_TARGET_OPTIONS.includes(value as (typeof TIME_TARGET_OPTIONS)[number])
}

function readStoredTargetHours(): (typeof TIME_TARGET_OPTIONS)[number] {
  if (typeof window === 'undefined') return 10

  try {
    const parsed = Number(window.localStorage.getItem(TIME_TARGET_STORAGE_KEY) || '')
    return isTimeTarget(parsed) ? parsed : 10
  } catch {
    return 10
  }
}

function readStoredBoolean(storageKey: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return fallback
  } catch {
    return fallback
  }
}

function isHoursFilter(value: string): value is HoursFilter {
  return HOURS_FILTER_OPTIONS.some((option) => option.value === value)
}

function readStoredHoursFilter(): HoursFilter {
  if (typeof window === 'undefined') return 'any'

  try {
    const stored = window.localStorage.getItem(REVIEW_HOURS_FILTER_STORAGE_KEY) || ''
    return isHoursFilter(stored) ? stored : 'any'
  } catch {
    return 'any'
  }
}

function matchesHoursFilter(hours: number, filter: HoursFilter): boolean {
  if (filter === 'any') return true
  if (filter === '0') return hours <= 0
  if (filter === 'lt5') return hours < 5
  if (filter === 'lt10') return hours < 10
  return hours < 20
}

export default function ReviewView(props: {
  plays: BggPlay[]
  username: string
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
  const [sortKey, setSortKey] = createSignal<SortKey>('hoursRemainingToCostTarget')
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('asc')
  const [targetCostPerHour, setTargetCostPerHour] = createSignal<number>(readStoredTarget())
  const [saleMode, setSaleMode] = createSignal<SaleMode>(readStoredSaleMode())
  const [targetHoursPerGame, setTargetHoursPerGame] =
    createSignal<(typeof TIME_TARGET_OPTIONS)[number]>(readStoredTargetHours())
  const [visibleStatuses, setVisibleStatuses] = createSignal<GameStatus[]>(
    readStoredVisibleGameStatuses(REVIEW_VISIBLE_STATUSES_STORAGE_KEY),
  )
  const [checklistOnly, setChecklistOnly] = createSignal<boolean>(
    readStoredChecklistOnly(REVIEW_CHECKLIST_ONLY_STORAGE_KEY),
  )
  const [showCampaignGames, setShowCampaignGames] = createSignal<boolean>(
    readStoredBoolean(REVIEW_SHOW_CAMPAIGN_STORAGE_KEY, true),
  )
  const [showScenarioGames, setShowScenarioGames] = createSignal<boolean>(
    readStoredBoolean(REVIEW_SHOW_SCENARIO_STORAGE_KEY, true),
  )
  const [showNeitherGames, setShowNeitherGames] = createSignal<boolean>(
    readStoredBoolean(REVIEW_SHOW_NEITHER_STORAGE_KEY, true),
  )
  const [hoursFilter, setHoursFilter] = createSignal<HoursFilter>(readStoredHoursFilter())

  createEffect(() => {
    try {
      window.localStorage.setItem(COSTS_TARGET_STORAGE_KEY, String(targetCostPerHour()))
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

  createEffect(() => {
    try {
      window.localStorage.setItem(TIME_TARGET_STORAGE_KEY, String(targetHoursPerGame()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(
        REVIEW_VISIBLE_STATUSES_STORAGE_KEY,
        JSON.stringify(visibleStatuses()),
      )
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_CHECKLIST_ONLY_STORAGE_KEY, String(checklistOnly()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_SHOW_CAMPAIGN_STORAGE_KEY, String(showCampaignGames()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_SHOW_SCENARIO_STORAGE_KEY, String(showScenarioGames()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_SHOW_NEITHER_STORAGE_KEY, String(showNeitherGames()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_HOURS_FILTER_STORAGE_KEY, hoursFilter())
    } catch {
      return
    }
  })

  const rows = createMemo<ReviewRow[]>(() => {
    const progressRowsById = new Map(
      buildCampaignProgressRows(
        props.plays,
        props.username,
        props.assumedMinutesByObjectId,
      ).map((row) => [row.id as string, row] as const),
    )

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
        const preferences = isConfigurableGameId(entry.id) ? gamePreferencesFor(entry.id) : null
        const matchedPlaysById = new Map<number, BggPlay>()
        for (const alias of entry.aliases) {
          const normalizedAlias = normalizeGameName(alias)
          if (!normalizedAlias) continue
          for (const [normalizedName, plays] of playedByAlias.entries()) {
            if (!matchesNormalizedGameName(normalizedName, normalizedAlias)) continue
            for (const play of plays) matchedPlaysById.set(play.id, play)
          }
        }

        let plays = 0
        let hours = 0
        let hasAssumedHours = false
        for (const play of matchedPlaysById.values()) {
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

        const progressRow = progressRowsById.get(entry.id)
        const status = preferences?.status || 'active'
        const isTyped = Boolean(preferences?.isCampaignGame || preferences?.isScenarioGame)
        const totalCost = [...entry.costs.boxCostsByName.values()].reduce((sum, cost) => sum + cost, 0)

        return {
          id: entry.id,
          name: entry.label,
          status,
          statusLabel: gameStatusLabel(status),
          showInChecklist: preferences?.showInMonthlyChecklist ?? true,
          isCampaignGame: preferences?.isCampaignGame ?? false,
          isScenarioGame: preferences?.isScenarioGame ?? false,
          currencySymbol: entry.costs.currencySymbol,
          totalCost,
          plays,
          hours,
          hasAssumedHours,
          costPerHour: hours > 0 ? totalCost / hours : undefined,
          hasProgressTracker: Boolean(progressRow),
          completedCount: progressRow?.completedCount ?? 0,
          totalCount: progressRow?.totalCount ?? 0,
          progress: progressRow?.progress ?? 0,
          progressLabel: progressRow?.progressLabel ?? (isTyped ? 'No detailed tracker yet' : '—'),
        }
      })
  })

  const visibleStatusSet = createMemo(() => new Set(visibleStatuses()))
  const filteredRows = createMemo(() =>
    rows().filter((row) => {
      const matchesType =
        (showCampaignGames() && row.isCampaignGame) ||
        (showScenarioGames() && row.isScenarioGame) ||
        (showNeitherGames() && !row.isCampaignGame && !row.isScenarioGame)
      if (!matchesType) return false
      if (!visibleStatusSet().has(row.status)) return false
      if (checklistOnly() && !row.showInChecklist) return false
      if (!matchesHoursFilter(row.hours, hoursFilter())) return false
      return true
    }),
  )

  const overallCurrencySymbol = createMemo(
    () =>
      filteredRows().find((row) => row.totalCost > 0)?.currencySymbol ||
      filteredRows()[0]?.currencySymbol ||
      rows().find((row) => row.totalCost > 0)?.currencySymbol ||
      rows()[0]?.currencySymbol ||
      '£',
  )

  const sortedRows = createMemo<DisplayReviewRow[]>(() => {
    const key = sortKey()
    const direction = sortDirection()
    const selectedSaleMode = saleMode()
    const costTarget = targetCostPerHour()
    const timeTarget = targetHoursPerGame()

    return filteredRows()
      .map((row) => {
        const effectiveCost = effectiveCostForSaleMode(row.totalCost, selectedSaleMode)
        const costTargetHours = hoursNeededForTarget(effectiveCost, costTarget) ?? 0
        return {
          ...row,
          effectiveCost,
          estimatedSellPrice: resaleValueForCost(row.totalCost, selectedSaleMode),
          costTargetHours,
          costProgress: progressToTarget(effectiveCost, row.hours, costTarget) ?? 0,
          costRemainingHours: Math.max(0, costTargetHours - Math.max(0, row.hours)),
          timeProgress: progressToHoursTarget(row.hours, timeTarget),
          timeRemainingHours: hoursRemainingForTimeTarget(row.hours, timeTarget),
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
        if (key === 'hours') {
          if (a.hours !== b.hours) return direction === 'asc' ? a.hours - b.hours : b.hours - a.hours
          return direction === 'asc' ? a.progress - b.progress : b.progress - a.progress
        }
        if (key === 'totalCost') {
          return direction === 'asc' ? a.totalCost - b.totalCost : b.totalCost - a.totalCost
        }
        if (key === 'costPerHour') {
          return compareOptionalNumber(a.costPerHour, b.costPerHour, direction)
        }
        if (key === 'hoursRemainingToCostTarget') {
          return direction === 'asc'
            ? a.costRemainingHours - b.costRemainingHours
            : b.costRemainingHours - a.costRemainingHours
        }
        return direction === 'asc'
          ? a.timeRemainingHours - b.timeRemainingHours
          : b.timeRemainingHours - a.timeRemainingHours
      })
  })

  const totals = createMemo(() => {
    let totalCost = 0
    let plays = 0
    let hours = 0
    let hasAssumedHours = false
    let completedCount = 0
    let totalCount = 0

    for (const row of filteredRows()) {
      totalCost += row.totalCost
      plays += row.plays
      hours += row.hours
      hasAssumedHours ||= row.hasAssumedHours
      completedCount += row.completedCount
      totalCount += row.totalCount
    }

    return {
      totalCost,
      plays,
      hours,
      hasAssumedHours,
      completedCount,
      totalCount,
      costPerHour: hours > 0 ? totalCost / hours : undefined,
    }
  })

  const visibleGameCount = createMemo(() => filteredRows().length)
  const hasAnyAssumedHours = createMemo(() => filteredRows().some((row) => row.hasAssumedHours))
  const selectedSaleOption = createMemo(
    () => SALE_MODE_OPTIONS.find((option) => option.value === saleMode()) || SALE_MODE_OPTIONS[0],
  )
  const selectedSaleSuffix = createMemo(
    () => (saleMode() === 'none' ? '' : ` (${selectedSaleOption().label})`),
  )
  const overallEffectiveCost = createMemo(() => effectiveCostForSaleMode(totals().totalCost, saleMode()))
  const overallEstimatedSellPrice = createMemo(() => resaleValueForCost(totals().totalCost, saleMode()))
  const overallCostTargetHours = createMemo(
    () => hoursNeededForTarget(overallEffectiveCost(), targetCostPerHour()) ?? 0,
  )
  const overallCostRemainingHours = createMemo(() =>
    Math.max(0, overallCostTargetHours() - Math.max(0, totals().hours)),
  )
  const overallCostProgress = createMemo(
    () => progressToTarget(overallEffectiveCost(), totals().hours, targetCostPerHour()) ?? 0,
  )
  const overallTimeTargetHours = createMemo(() => visibleGameCount() * targetHoursPerGame())
  const overallTimeRemainingHours = createMemo(() =>
    hoursRemainingForTimeTarget(totals().hours, overallTimeTargetHours()),
  )
  const overallTimeProgress = createMemo(() =>
    visibleGameCount() <= 0 ? 0 : progressToHoursTarget(totals().hours, overallTimeTargetHours()),
  )
  const overallCompletionProgress = createMemo(() =>
    totals().totalCount > 0 ? totals().completedCount / totals().totalCount : 0,
  )
  const overallCompletionLabel = createMemo(() =>
    totals().totalCount > 0
      ? `${totals().completedCount.toLocaleString()} / ${totals().totalCount.toLocaleString()} tracked steps`
      : '—',
  )

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey() === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection(
      nextKey === 'name' ||
        nextKey === 'status' ||
        nextKey === 'costPerHour' ||
        nextKey === 'hoursRemainingToCostTarget' ||
        nextKey === 'hoursRemainingToTimeTarget'
        ? 'asc'
        : 'desc',
    )
  }

  const sortIndicator = (key: SortKey): string => {
    if (sortKey() !== key) return ''
    return sortDirection() === 'asc' ? ' ▲' : ' ▼'
  }

  const costTargetHeading = createMemo(
    () => `Hours left to ${formatTargetValue(targetCostPerHour(), overallCurrencySymbol())}/h${selectedSaleSuffix()}`,
  )
  const timeTargetHeading = createMemo(() => `Hours left to ${targetHoursPerGame()}h/game`)

  const estimateLabel = createMemo(() => {
    const status = props.costTimeEstimateStatus
    return `Checked ${status.complete.toLocaleString()} of ${status.total.toLocaleString()} games with missing play times`
  })
  const estimateSummary = createMemo(() => {
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
  const showEstimateStatus = createMemo(() => {
    const status = props.costTimeEstimateStatus
    return status.total > 0 && (status.active || status.failed > 0 || status.checkedWithoutEstimate > 0)
  })

  const renderCompletionProgress = (
    name: string,
    completedCount: number,
    totalCount: number,
    progress: number,
    progressLabel: string,
    hasTracker: boolean,
  ) => {
    if (!hasTracker || totalCount <= 0) {
      return <span class="mono muted">{progressLabel === '—' ? '—' : 'No tracker yet'}</span>
    }

    return (
      <div class="costProgressCell">
        <ProgressBar
          value={completedCount}
          target={Math.max(1, totalCount)}
          widthPx={156}
          label={`${name}: ${progressLabel}`}
          showLabel={false}
        />
        <div class="costProgressMeta">
          <span class="mono">{formatPercent(progress)}</span>
          <span class="mono muted">{progressLabel}</span>
        </div>
      </div>
    )
  }

  const renderCostProgress = (
    name: string,
    hours: number,
    targetHours: number,
    progress: number,
    currencySymbol: string,
    estimatedSellPrice: number,
  ) => (
    <div class="costProgressCell">
      <ProgressBar
        value={hours}
        target={targetHours <= 0 ? Math.max(hours, 1) : targetHours}
        widthPx={156}
        label={`${name}: ${formatHours(hours)}/${formatHours(targetHours)} hours needed for ${formatTargetValue(targetCostPerHour(), currencySymbol)}/hour`}
        showLabel={false}
      />
      <div class="costProgressMeta">
        <span class="mono">{formatPercent(progress)}</span>
        <span class="mono muted" title={`Estimated sell price: ${formatMoney(estimatedSellPrice, currencySymbol)}`}>
          {targetHours <= 0 ? 'No hours needed' : `${formatHours(hours)} / ${formatHours(targetHours)}h`}
        </span>
      </div>
    </div>
  )

  const renderTimeProgress = (name: string, hours: number, targetHours: number, progress: number) => (
    <div class="costProgressCell">
      <ProgressBar
        value={hours}
        target={Math.max(1, targetHours)}
        widthPx={156}
        label={`${name}: ${formatHours(hours)}/${formatHours(targetHours)} target hours`}
        showLabel={false}
      />
      <div class="costProgressMeta">
        <span class="mono">{formatPercent(progress)}</span>
        <span class="mono muted">{formatHours(hours)} / {formatHours(targetHours)}h</span>
      </div>
    </div>
  )

  return (
    <div class="statsBlock reviewView">
      <h3 class="statsTitle">Games</h3>

      <Show when={showEstimateStatus()}>
        <div class="costLoadingCard">
          <div class="costLoadingHeader">
            <div>
              <div>Estimating missing play times</div>
              <div class="muted">
                The table updates as BGG game metadata comes back for plays with no recorded length.
              </div>
            </div>
            <div class="mono muted">{estimateLabel()}</div>
          </div>
          <ProgressBar
            value={props.costTimeEstimateStatus.complete}
            target={Math.max(1, props.costTimeEstimateStatus.total)}
            widthPx={320}
            label={estimateLabel()}
          />
          <div class="muted">{estimateSummary()}</div>
        </div>
      </Show>

      <div class="costsToolbar">
        <div class="costToolbarGroup">
          <div class="muted">Cost target</div>
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
          <div class="muted">Time target</div>
          <div class="costTargetGroup" role="group" aria-label="Target hours per game">
            <For each={TIME_TARGET_OPTIONS}>
              {(target) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: targetHoursPerGame() === target }}
                  onClick={() => setTargetHoursPerGame(target)}
                >
                  {target}h
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="costToolbarGroup">
          <div class="muted">Type</div>
          <div class="costTargetGroup" role="group" aria-label="Visible review types">
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: showCampaignGames() }}
              onClick={() => setShowCampaignGames((current) => !current)}
            >
              Campaign
            </button>
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: showScenarioGames() }}
              onClick={() => setShowScenarioGames((current) => !current)}
            >
              Scenario
            </button>
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: showNeitherGames() }}
              onClick={() => setShowNeitherGames((current) => !current)}
            >
              Neither
            </button>
          </div>
        </div>

        <div class="costToolbarGroup">
          <div class="muted">Time played</div>
          <div class="costTargetGroup" role="group" aria-label="Visible games by time played">
            <For each={HOURS_FILTER_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: hoursFilter() === option.value }}
                  onClick={() => setHoursFilter(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <StandardGameFilters
          visibleStatuses={visibleStatuses()}
          onToggleStatus={(status) =>
            setVisibleStatuses((current) => toggleVisibleGameStatus(current, status))
          }
          checklistOnly={checklistOnly()}
          onSetChecklistOnly={setChecklistOnly}
          checklistGroupAriaLabel="Visible review games"
        />
      </div>

      <div class="tableWrap">
        <table class="table compactTable mobileCardTable costsTable reviewTable">
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
              <th>
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
                  onClick={() => toggleSort('hoursRemainingToCostTarget')}
                >
                  {costTargetHeading()}
                  {sortIndicator('hoursRemainingToCostTarget')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  class="sortButton"
                  onClick={() => toggleSort('hoursRemainingToTimeTarget')}
                >
                  {timeTargetHeading()}
                  {sortIndicator('hoursRemainingToTimeTarget')}
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
                        <div class="reviewGameCell">
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
                          <div class="reviewTypeBadges">
                            <Show when={row.isCampaignGame}>
                              <span class="achievementTag reviewTypeBadge">Campaign</span>
                            </Show>
                            <Show when={row.isScenarioGame}>
                              <span class="achievementTag reviewTypeBadge">Scenario</span>
                            </Show>
                            <Show when={!row.isCampaignGame && !row.isScenarioGame}>
                              <span class="achievementTag reviewTypeBadge">Neither</span>
                            </Show>
                          </div>
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
                      <td data-label="Hours">
                        <div class="reviewMetricCell">
                          <div class="mono reviewMetricNumber">
                            {formatHours(row.hours)}
                            {row.hasAssumedHours ? '*' : ''}
                          </div>
                          {renderCompletionProgress(
                            row.name,
                            row.completedCount,
                            row.totalCount,
                            row.progress,
                            row.progressLabel,
                            row.hasProgressTracker,
                          )}
                        </div>
                      </td>
                      <td class="mono" data-label="Total cost">
                        {formatMoney(row.totalCost, row.currencySymbol)}
                      </td>
                      <td class="mono" data-label="Cost / hour">
                        <Show when={typeof row.costPerHour === 'number'} fallback="—">
                          {formatMoney(row.costPerHour!, row.currencySymbol)}
                        </Show>
                      </td>
                      <td data-label={costTargetHeading()}>
                        <div class="reviewMetricCell">
                          <div class="mono reviewMetricNumber">
                            {formatDurationHoursMinutes(row.costRemainingHours)}
                            {row.hasAssumedHours && row.costRemainingHours > 0 ? '*' : ''}
                          </div>
                          {renderCostProgress(
                            row.name,
                            row.hours,
                            row.costTargetHours,
                            row.costProgress,
                            row.currencySymbol,
                            row.estimatedSellPrice,
                          )}
                        </div>
                      </td>
                      <td data-label={timeTargetHeading()}>
                        <div class="reviewMetricCell">
                          <div class="mono reviewMetricNumber">
                            {formatDurationHoursMinutes(row.timeRemainingHours)}
                            {row.hasAssumedHours && row.timeRemainingHours > 0 ? '*' : ''}
                          </div>
                          {renderTimeProgress(
                            row.name,
                            row.hours,
                            targetHoursPerGame(),
                            row.timeProgress,
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
                <tr>
                  <td class="mono" data-label="#">—</td>
                  <td class="costsSummaryLabel" data-label="Game">Overall</td>
                  <td data-label="Status">—</td>
                  <td class="mono" data-label="Plays">{totals().plays.toLocaleString()}</td>
                  <td data-label="Hours">
                    <div class="reviewMetricCell">
                      <div class="mono reviewMetricNumber">
                        {formatHours(totals().hours)}
                        {totals().hasAssumedHours ? '*' : ''}
                      </div>
                      {renderCompletionProgress(
                        'Overall',
                        totals().completedCount,
                        totals().totalCount,
                        overallCompletionProgress(),
                        overallCompletionLabel(),
                        totals().totalCount > 0,
                      )}
                    </div>
                  </td>
                  <td class="mono" data-label="Total cost">
                    {formatMoney(totals().totalCost, overallCurrencySymbol())}
                  </td>
                  <td class="mono" data-label="Cost / hour">
                    <Show when={typeof totals().costPerHour === 'number'} fallback="—">
                      {formatMoney(totals().costPerHour!, overallCurrencySymbol())}
                    </Show>
                  </td>
                  <td data-label={costTargetHeading()}>
                    <div class="reviewMetricCell">
                      <div class="mono reviewMetricNumber">
                        {formatDurationHoursMinutes(overallCostRemainingHours())}
                        {totals().hasAssumedHours && overallCostRemainingHours() > 0 ? '*' : ''}
                      </div>
                      {renderCostProgress(
                        'Overall',
                        totals().hours,
                        overallCostTargetHours(),
                        overallCostProgress(),
                        overallCurrencySymbol(),
                        overallEstimatedSellPrice(),
                      )}
                    </div>
                  </td>
                  <td data-label={timeTargetHeading()}>
                    <div class="reviewMetricCell">
                      <div class="mono reviewMetricNumber">
                        {formatDurationHoursMinutes(overallTimeRemainingHours())}
                        {totals().hasAssumedHours && overallTimeRemainingHours() > 0 ? '*' : ''}
                      </div>
                      <Show when={visibleGameCount() > 0} fallback={<span class="mono muted">—</span>}>
                        {renderTimeProgress(
                          'Overall',
                          totals().hours,
                          overallTimeTargetHours(),
                          overallTimeProgress(),
                        )}
                      </Show>
                    </div>
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
