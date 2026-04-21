import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from './bgg'
import { costRegistry } from './costRegistry'
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
import ProgressBar from './components/ProgressBar'
import { totalPlayMinutesWithAssumption } from './playDuration'
import { playQuantity } from './playsHelpers'

type TimeRow = {
  id: string
  name: string
  status: GameStatus
  statusLabel: string
  plays: number
  hours: number
  hasAssumedHours: boolean
}

type DisplayTimeRow = TimeRow & {
  remainingHours: number
  progress: number
}

type SortKey =
  | 'name'
  | 'status'
  | 'plays'
  | 'hours'
  | 'hoursRemainingToTarget'
  | 'progressToTarget'
type SortDirection = 'asc' | 'desc'
type HoursFilter =
  | 'all'
  | '0'
  | 'lte2'
  | 'lte5'
  | 'lte10'
  | 'lte20'
  | 'gte2'
  | 'gte5'
  | 'gte10'
  | 'gte20'

const TIME_VISIBLE_STATUSES_STORAGE_KEY = 'time.visibleStatuses'
const TIME_CHECKLIST_ONLY_STORAGE_KEY = 'time.checklistOnly'
const TIME_HOURS_FILTER_STORAGE_KEY = 'time.hoursFilter'
const TIME_TARGET_STORAGE_KEY = 'time.targetHoursPerGame'

const HOURS_FILTER_OPTIONS: ReadonlyArray<{ value: HoursFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '0', label: '0h' },
  { value: 'lte2', label: '<= 2h' },
  { value: 'lte5', label: '<= 5h' },
  { value: 'lte10', label: '<= 10h' },
  { value: 'lte20', label: '<= 20h' },
  { value: 'gte2', label: '>= 2h' },
  { value: 'gte5', label: '>= 5h' },
  { value: 'gte10', label: '>= 10h' },
  { value: 'gte20', label: '>= 20h' },
]
const TIME_TARGET_OPTIONS = [5, 10, 25, 50] as const

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

function allGameStatuses(): GameStatus[] {
  return GAME_STATUS_OPTIONS.map((option) => option.value)
}

function readStoredVisibleStatuses(): GameStatus[] {
  if (typeof window === 'undefined') return allGameStatuses()

  try {
    const raw = window.localStorage.getItem(TIME_VISIBLE_STATUSES_STORAGE_KEY)
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
    return window.localStorage.getItem(TIME_CHECKLIST_ONLY_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function isHoursFilter(value: string): value is HoursFilter {
  return HOURS_FILTER_OPTIONS.some((option) => option.value === value)
}

function readStoredHoursFilter(): HoursFilter {
  if (typeof window === 'undefined') return 'all'

  try {
    const stored = window.localStorage.getItem(TIME_HOURS_FILTER_STORAGE_KEY) || ''
    return isHoursFilter(stored) ? stored : 'all'
  } catch {
    return 'all'
  }
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

function formatDurationHoursMinutes(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0m'

  const totalMinutes = Math.round(hours * 60)
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (wholeHours <= 0) return `${minutes}m`
  if (minutes <= 0) return `${wholeHours}h`
  return `${wholeHours}h${String(minutes).padStart(2, '0')}m`
}

function formatHours(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatRoundedDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  return `${Math.round(hours)}h`
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}%`
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function hoursRemainingForTarget(hours: number, targetHours: number): number {
  if (!Number.isFinite(targetHours) || targetHours <= 0) return 0
  return Math.max(0, targetHours - Math.max(0, hours))
}

function progressToHoursTarget(hours: number, targetHours: number): number {
  if (!Number.isFinite(targetHours) || targetHours <= 0) return 1
  return clamp01(Math.max(0, hours) / targetHours)
}

function matchesHoursFilter(hours: number, filter: HoursFilter): boolean {
  if (filter === 'all') return true
  if (filter === '0') return hours <= 0
  if (filter === 'lte2') return hours <= 2
  if (filter === 'lte5') return hours <= 5
  if (filter === 'lte10') return hours <= 10
  if (filter === 'lte20') return hours <= 20
  if (filter === 'gte2') return hours >= 2
  if (filter === 'gte5') return hours >= 5
  if (filter === 'gte10') return hours >= 10
  return hours >= 20
}

export default function TimeView(props: {
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
  const [sortKey, setSortKey] = createSignal<SortKey>('hours')
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('desc')
  const [targetHoursPerGame, setTargetHoursPerGame] =
    createSignal<(typeof TIME_TARGET_OPTIONS)[number]>(readStoredTargetHours())
  const [visibleStatuses, setVisibleStatuses] = createSignal<GameStatus[]>(readStoredVisibleStatuses())
  const [checklistOnly, setChecklistOnly] = createSignal<boolean>(readStoredChecklistOnly())
  const [hoursFilter, setHoursFilter] = createSignal<HoursFilter>(readStoredHoursFilter())

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
        TIME_VISIBLE_STATUSES_STORAGE_KEY,
        JSON.stringify(visibleStatuses()),
      )
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(TIME_CHECKLIST_ONLY_STORAGE_KEY, String(checklistOnly()))
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(TIME_HOURS_FILTER_STORAGE_KEY, hoursFilter())
    } catch {
      return
    }
  })

  const rows = createMemo<TimeRow[]>(() => {
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

        return {
          id: entry.id,
          name: entry.label,
          status,
          statusLabel: gameStatusLabel(status),
          plays,
          hours,
          hasAssumedHours,
        }
      })
  })

  const visibleStatusSet = createMemo(() => new Set(visibleStatuses()))
  const filteredRows = createMemo(() =>
    rows().filter((row) => {
      if (!visibleStatusSet().has(row.status)) return false
      if (checklistOnly() && (!isConfigurableGameId(row.id) || !gamePreferencesFor(row.id).showInMonthlyChecklist)) {
        return false
      }
      return matchesHoursFilter(row.hours, hoursFilter())
    }),
  )

  const sortedRows = createMemo<DisplayTimeRow[]>(() => {
    const key = sortKey()
    const direction = sortDirection()
    const target = targetHoursPerGame()

    return filteredRows()
      .map((row) => ({
        ...row,
        remainingHours: hoursRemainingForTarget(row.hours, target),
        progress: progressToHoursTarget(row.hours, target),
      }))
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
        if (key === 'hoursRemainingToTarget') {
          return direction === 'asc' ? a.remainingHours - b.remainingHours : b.remainingHours - a.remainingHours
        }
        return direction === 'asc' ? a.progress - b.progress : b.progress - a.progress
      })
  })

  const totals = createMemo(() => {
    let plays = 0
    let hours = 0
    let hasAssumedHours = false
    for (const row of filteredRows()) {
      plays += row.plays
      hours += row.hours
      hasAssumedHours ||= row.hasAssumedHours
    }

    return {
      plays,
      hours,
      hasAssumedHours,
    }
  })

  const visibleGameCount = createMemo(() => filteredRows().length)
  const averageHoursPerGame = createMemo(() => {
    const count = visibleGameCount()
    if (count <= 0) return undefined
    return totals().hours / count
  })
  const hasAnyAssumedHours = createMemo(() => filteredRows().some((row) => row.hasAssumedHours))
  const overallTargetHours = createMemo(() => visibleGameCount() * targetHoursPerGame())
  const overallRemainingHours = createMemo(() =>
    hoursRemainingForTarget(totals().hours, overallTargetHours()),
  )
  const overallProgressValue = createMemo(() =>
    visibleGameCount() <= 0 ? 0 : progressToHoursTarget(totals().hours, overallTargetHours()),
  )
  const overallProgressPercent = createMemo(() => formatPercent(overallProgressValue()))
  const overallProgressChartStyle = createMemo(() => ({ '--progress': `${overallProgressValue() * 100}%` }))
  const overallProgressSplitChartStyle = createMemo(() => ({
    '--cost-donut-complete': `${overallProgressValue() * 100}%`,
  }))
  const progressHeading = createMemo(() => `Progress to ${targetHoursPerGame()}h/game`)
  const remainingHeading = createMemo(() => `Hours left to ${targetHoursPerGame()}h/game`)

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey() === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection(
      nextKey === 'name' || nextKey === 'status' || nextKey === 'hoursRemainingToTarget'
        ? 'asc'
        : 'desc',
    )
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

  const timeEstimateLabel = createMemo(() => {
    const status = props.costTimeEstimateStatus
    return `Checked ${status.complete.toLocaleString()} of ${status.total.toLocaleString()} games with missing play times`
  })
  const timeEstimateSummary = createMemo(() => {
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
  const showTimeEstimateStatus = createMemo(() => {
    const status = props.costTimeEstimateStatus
    return status.total > 0 && (status.active || status.failed > 0 || status.checkedWithoutEstimate > 0)
  })
  const renderTimeProgress = (
    name: string,
    hours: number,
    target: number,
    hasAssumedHours: boolean,
  ) => {
    const progress = progressToHoursTarget(hours, target)
    const label = `${name}: ${formatHours(hours)}/${formatHours(target)} target hours`

    return (
      <div class="costProgressCell">
        <ProgressBar
          value={hours}
          target={target}
          widthPx={156}
          label={label}
          showLabel={false}
        />
        <div class="costProgressMeta">
          <span class="mono">{formatPercent(progress)}</span>
          <span class="mono muted">
            {formatHours(hours)} / {formatHours(target)}h
            {hasAssumedHours && hours < target ? '*' : ''}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div class="statsBlock">
      <h3 class="statsTitle">Time</h3>
      <Show when={showTimeEstimateStatus()}>
        <div class="costLoadingCard">
          <div class="costLoadingHeader">
            <div>
              <div>Estimating missing play times</div>
              <div class="muted">
                The table updates as BGG game metadata comes back for plays with no recorded length.
              </div>
            </div>
            <div class="mono muted">{timeEstimateLabel()}</div>
          </div>
          <ProgressBar
            value={props.costTimeEstimateStatus.complete}
            target={Math.max(1, props.costTimeEstimateStatus.total)}
            widthPx={320}
            label={timeEstimateLabel()}
          />
          <div class="muted">{timeEstimateSummary()}</div>
        </div>
      </Show>

      <div class="monthlySummaryGrid costsSummaryGrid">
        <section class="monthlySummaryCard monthlySummaryCardProgress costsSummaryCardChart">
          <div class="monthlySummaryLabel">{progressHeading()}</div>
          <div
            class="monthlyProgressRing costSummaryRing"
            style={overallProgressChartStyle()}
            aria-label={`Overall progress: ${overallProgressPercent()}`}
          >
            <div class="monthlyProgressInner">
              <span class="monthlyProgressValue mono">{overallProgressPercent()}</span>
            </div>
          </div>
          <div class="monthlySummarySubtext">
            <span class="mono">{formatRoundedDuration(totals().hours)}</span>
            {totals().hasAssumedHours ? '*' : ''}
            {' '}logged of{' '}
            <span class="mono">{formatRoundedDuration(overallTargetHours())}</span>
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Average hours / game</div>
          <div class="monthlySummaryValue mono">
            <Show when={typeof averageHoursPerGame() === 'number'} fallback="—">
              {formatHours(averageHoursPerGame()!)}
              {totals().hasAssumedHours ? '*' : ''}
            </Show>
          </div>
          <div class="monthlySummarySubtext">
            Across <span class="mono">{visibleGameCount().toLocaleString()}</span> visible game
            {visibleGameCount() === 1 ? '' : 's'} with a <span class="mono">{targetHoursPerGame()}h</span> target.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Total hours</div>
          <div class="monthlySummaryValue mono">
            {formatDurationHoursMinutes(totals().hours)}
            {totals().hasAssumedHours ? '*' : ''}
          </div>
          <div class="monthlySummarySubtext">
            Across <span class="mono">{totals().plays.toLocaleString()}</span> filtered plays.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">{remainingHeading()}</div>
          <div class="costSummarySplit">
            <div
              class="costDonutMini"
              style={overallProgressSplitChartStyle()}
              aria-label={`Logged versus remaining hours: ${overallProgressPercent()} logged`}
            >
              <div class="costDonutMiniInner">
                <span class="costDonutMiniValue mono">{overallProgressPercent()}</span>
              </div>
            </div>
            <div class="monthlySummaryValue mono">
              {formatDurationHoursMinutes(overallRemainingHours())}
              {totals().hasAssumedHours && overallRemainingHours() > 0 ? '*' : ''}
            </div>
          </div>
          <div class="monthlySummarySubtext">
            <Show when={visibleGameCount() > 0} fallback={<>No visible games match the current filters.</>}>
              <Show when={overallRemainingHours() > 0} fallback={<>Target met for the visible games.</>}>
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
            </Show>
          </div>
        </section>
      </div>

      <div class="costsToolbar">
        <div class="costToolbarGroup">
          <div class="muted">Choose the target hours/game to compare against.</div>
          <div class="costTargetGroup" role="group" aria-label="Time target per game">
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
          <div class="costTargetGroup" role="group" aria-label="Visible time games">
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

        <div class="costToolbarGroup">
          <div class="muted">Hours played</div>
          <div class="costTargetGroup" role="group" aria-label="Filtered hours played">
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
                  <td colSpan={7} class="muted">
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
                      <td class="mono" data-label={remainingHeading()}>
                        {formatDurationHoursMinutes(row.remainingHours)}
                        {row.hasAssumedHours && row.remainingHours > 0 ? '*' : ''}
                      </td>
                      <td class="costProgressTableCell" data-label={progressHeading()}>
                        {renderTimeProgress(row.name, row.hours, targetHoursPerGame(), row.hasAssumedHours)}
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
                  <td class="mono" data-label={remainingHeading()}>
                    {formatDurationHoursMinutes(overallRemainingHours())}
                    {totals().hasAssumedHours && overallRemainingHours() > 0 ? '*' : ''}
                  </td>
                  <td class="costProgressTableCell" data-label={progressHeading()}>
                    {renderTimeProgress('Overall', totals().hours, overallTargetHours(), totals().hasAssumedHours)}
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
