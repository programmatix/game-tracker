import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import GameLink from './components/GameLink'
import GameOptionsButton from './components/GameOptionsButton'
import ProgressBar from './components/ProgressBar'
import StandardGameFilters from './components/StandardGameFilters'
import { buildCampaignProgressRows } from './campaignProgress'
import {
  GAME_STATUS_OPTIONS,
  gamePreferencesFor,
  gameStatusLabel,
  isGameStatus,
  type GameStatus,
} from './gamePreferences'
import {
  readStoredChecklistOnly,
  readStoredVisibleGameStatuses,
  toggleVisibleGameStatus,
} from './gameFilters'
import type { BggPlay } from './bgg'

type CampaignRow = ReturnType<typeof buildCampaignProgressRows>[number] & {
  status: GameStatus
  statusLabel: string
  isCampaignGame: boolean
  isScenarioGame: boolean
}

type SortKey = 'name' | 'type' | 'status' | 'plays' | 'hours' | 'progress'
type SortDirection = 'asc' | 'desc'

const CAMPAIGNS_VISIBLE_STATUSES_STORAGE_KEY = 'campaigns.visibleStatuses'
const CAMPAIGNS_CHECKLIST_ONLY_STORAGE_KEY = 'campaigns.checklistOnly'

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}%`
}

function formatHours(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatTypeLabel(row: { isCampaignGame: boolean; isScenarioGame: boolean }): string {
  if (row.isCampaignGame && row.isScenarioGame) return 'Campaign + Scenario'
  if (row.isCampaignGame) return 'Campaign'
  if (row.isScenarioGame) return 'Scenario'
  return '—'
}

export default function CampaignsView(props: {
  plays: BggPlay[]
  username: string
  assumedMinutesByObjectId: ReadonlyMap<string, number>
  onOpenGame: (gameKey: string) => void
  onOpenGameOptions: (gameId: string) => void
  onUpdateGamePreferences: (gameId: string, patch: { status: GameStatus }) => void
}) {
  const [sortKey, setSortKey] = createSignal<SortKey>('progress')
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('asc')
  const [visibleStatuses, setVisibleStatuses] = createSignal<GameStatus[]>(
    readStoredVisibleGameStatuses(CAMPAIGNS_VISIBLE_STATUSES_STORAGE_KEY),
  )
  const [checklistOnly, setChecklistOnly] = createSignal<boolean>(
    readStoredChecklistOnly(CAMPAIGNS_CHECKLIST_ONLY_STORAGE_KEY),
  )

  createEffect(() => {
    try {
      window.localStorage.setItem(
        CAMPAIGNS_VISIBLE_STATUSES_STORAGE_KEY,
        JSON.stringify(visibleStatuses()),
      )
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(
        CAMPAIGNS_CHECKLIST_ONLY_STORAGE_KEY,
        String(checklistOnly()),
      )
    } catch {
      return
    }
  })

  const rows = createMemo<CampaignRow[]>(() =>
    buildCampaignProgressRows(
      props.plays,
      props.username,
      props.assumedMinutesByObjectId,
    ).map((row) => {
      const preferences = gamePreferencesFor(row.id)
      const status = preferences.status
      return {
        ...row,
        status,
        statusLabel: gameStatusLabel(status),
        isCampaignGame: preferences.isCampaignGame,
        isScenarioGame: preferences.isScenarioGame,
      }
    }),
  )

  const visibleStatusSet = createMemo(() => new Set(visibleStatuses()))
  const filteredRows = createMemo(() =>
    rows().filter((row) => {
      if (!row.isCampaignGame && !row.isScenarioGame) return false
      if (!visibleStatusSet().has(row.status)) return false
      if (!checklistOnly()) return true
      return gamePreferencesFor(row.id).showInMonthlyChecklist
    }),
  )

  const sortedRows = createMemo(() => {
    const key = sortKey()
    const direction = sortDirection()
    const directionMultiplier = direction === 'asc' ? 1 : -1

    return filteredRows()
      .slice()
      .sort((a, b) => {
        if (key === 'name') return a.name.localeCompare(b.name) * directionMultiplier
        if (key === 'type') return formatTypeLabel(a).localeCompare(formatTypeLabel(b)) * directionMultiplier
        if (key === 'status') return a.statusLabel.localeCompare(b.statusLabel) * directionMultiplier
        if (key === 'plays') return (a.plays - b.plays) * directionMultiplier
        if (key === 'hours') return (a.hours - b.hours) * directionMultiplier
        if (a.progress !== b.progress) return (a.progress - b.progress) * directionMultiplier
        if (a.remainingCount !== b.remainingCount) {
          return (a.remainingCount - b.remainingCount) * directionMultiplier
        }
        return a.name.localeCompare(b.name)
      })
  })

  const totals = createMemo(() => {
    let plays = 0
    let completedCount = 0
    let totalCount = 0
    let completedGames = 0
    let inProgressGames = 0
    let campaignGames = 0
    let scenarioGames = 0
    let hours = 0
    let hasAssumedHours = false

    for (const row of filteredRows()) {
      plays += row.plays
      hours += row.hours
      hasAssumedHours ||= row.hasAssumedHours
      completedCount += row.completedCount
      totalCount += row.totalCount
      if (row.isCampaignGame) campaignGames += 1
      if (row.isScenarioGame) scenarioGames += 1
      if (row.progress >= 1) completedGames += 1
      else if (row.progress > 0) inProgressGames += 1
    }

    return {
      plays,
      completedCount,
      totalCount,
      completedGames,
      inProgressGames,
      campaignGames,
      scenarioGames,
      hours,
      hasAssumedHours,
      visibleGames: filteredRows().length,
    }
  })

  const overallProgress = createMemo(() => {
    const totalCount = totals().totalCount
    return totalCount > 0 ? totals().completedCount / totalCount : 0
  })
  const overallProgressPercent = createMemo(() => formatPercent(overallProgress()))
  const overallProgressChartStyle = createMemo(() => ({
    '--progress': `${overallProgress() * 100}%`,
  }))

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey() === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === 'name' || nextKey === 'type' || nextKey === 'status' ? 'asc' : 'desc')
  }

  const sortIndicator = (key: SortKey): string => {
    if (sortKey() !== key) return ''
    return sortDirection() === 'asc' ? ' ▲' : ' ▼'
  }

  const renderCampaignProgress = (row: CampaignRow) => (
    <div class="costProgressCell">
      <ProgressBar
        value={row.completedCount}
        target={Math.max(1, row.totalCount)}
        widthPx={156}
        label={`${row.name}: ${row.progressLabel}`}
        showLabel={false}
      />
      <div class="costProgressMeta">
        <span class="mono">{formatPercent(row.progress)}</span>
        <span class="mono muted">{row.progressLabel}</span>
      </div>
    </div>
  )

  const renderTypeCell = (row: CampaignRow) => (
    <div class="achievementTypeGroup">
      <Show when={row.isCampaignGame}>
        <span class="achievementTag">Campaign</span>
      </Show>
      <Show when={row.isScenarioGame}>
        <span class="achievementTag">Scenario</span>
      </Show>
    </div>
  )

  return (
    <div class="statsBlock">
      <h3 class="statsTitle">Campaigns & scenarios</h3>
      <div class="muted">
        Progress trackers selected in Game options, ranked by completion.
      </div>

      <div class="monthlySummaryGrid costsSummaryGrid">
        <section class="monthlySummaryCard monthlySummaryCardProgress costsSummaryCardChart">
          <div class="monthlySummaryLabel">Overall completion</div>
          <div
            class="monthlyProgressRing costSummaryRing"
            style={overallProgressChartStyle()}
            aria-label={`Overall campaign completion: ${overallProgressPercent()}`}
          >
            <div class="monthlyProgressInner">
              <span class="monthlyProgressValue mono">{overallProgressPercent()}</span>
            </div>
          </div>
          <div class="monthlySummarySubtext">
            Across <span class="mono">{totals().visibleGames.toLocaleString()}</span> visible campaign
            {totals().visibleGames === 1 ? '' : 's'}.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Games complete</div>
          <div class="monthlySummaryValue mono">
            {totals().completedGames.toLocaleString()} / {totals().visibleGames.toLocaleString()}
          </div>
          <div class="monthlySummarySubtext">
            <span class="mono">{totals().inProgressGames.toLocaleString()}</span> currently in progress.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Tagged games</div>
          <div class="monthlySummaryValue mono">
            {totals().campaignGames.toLocaleString()} campaign / {totals().scenarioGames.toLocaleString()} scenario
          </div>
          <div class="monthlySummarySubtext">
            A game can be tagged as both.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Tracked steps</div>
          <div class="monthlySummaryValue mono">
            {totals().completedCount.toLocaleString()} / {totals().totalCount.toLocaleString()}
          </div>
          <div class="monthlySummarySubtext">
            Across the currently visible tracked games.
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Logged hours</div>
          <div class="monthlySummaryValue mono">
            {formatHours(totals().hours)}
            {totals().hasAssumedHours ? '*' : ''}
          </div>
          <div class="monthlySummarySubtext">Across the currently visible tracked games.</div>
        </section>
      </div>

      <div class="costsToolbar">
        <StandardGameFilters
          visibleStatuses={visibleStatuses()}
          onToggleStatus={(status) =>
            setVisibleStatuses((current) => toggleVisibleGameStatus(current, status))
          }
          checklistOnly={checklistOnly()}
          onSetChecklistOnly={setChecklistOnly}
          checklistGroupAriaLabel="Visible campaign and scenario games"
        />
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
                <button type="button" class="sortButton" onClick={() => toggleSort('type')}>
                  Type{sortIndicator('type')}
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
              <th>
                <button type="button" class="sortButton" onClick={() => toggleSort('progress')}>
                  Completion{sortIndicator('progress')}
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
                          <GameOptionsButton
                            gameId={row.id}
                            gameLabel={row.name}
                            onOpenGameOptions={props.onOpenGameOptions}
                          />
                        </div>
                      </td>
                      <td data-label="Type">{renderTypeCell(row)}</td>
                      <td data-label="Status">
                        <select
                          class="statusBadge statusBadgeSelect costsStatusSelect"
                          value={row.status}
                          aria-label={`Status for ${row.name}`}
                          onChange={(event) => {
                            const status = event.currentTarget.value
                            if (!isGameStatus(status)) return
                            props.onUpdateGamePreferences(row.id, { status })
                          }}
                        >
                          <For each={GAME_STATUS_OPTIONS}>
                            {(option) => <option value={option.value}>{option.label}</option>}
                          </For>
                        </select>
                      </td>
                      <td class="mono" data-label="Plays">{row.plays.toLocaleString()}</td>
                      <td class="mono" data-label="Hours">
                        {formatHours(row.hours)}
                        {row.hasAssumedHours ? '*' : ''}
                      </td>
                      <td class="costProgressTableCell" data-label="Completion">
                        {renderCampaignProgress(row)}
                      </td>
                    </tr>
                  )}
                </For>
              </>
            </Show>
          </tbody>
        </table>
      </div>

      <Show when={totals().hasAssumedHours}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length.
        </div>
      </Show>
    </div>
  )
}
