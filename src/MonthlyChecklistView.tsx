import { For, Show, createEffect, createMemo, createResource, createSignal } from 'solid-js'
import { fetchThingSummary, type BggPlay } from './bgg'
import {
  CONFIGURABLE_GAME_MATCH_DEFINITIONS,
  findConfigurableGameIdForOptions,
  normalizeConfigurableGameMatchName,
} from './configurableGameMatching'
import { shouldShowGameInMonthlyChecklist } from './gamePreferences'
import GameOptionsButton from './components/GameOptionsButton'
import { isArkhamHorrorLcgPlay } from './games/arkham-horror-lcg/arkhamHorrorLcgEntries'
import { thingAssumedPlayTimeMinutes } from './playDuration'

type ChecklistItem = {
  id: string
  label: string
  aliases: ReadonlyArray<string>
  objectIds: ReadonlyArray<string>
  useArkhamSpecialMatcher: boolean
}

type MonthlyChecklistRow = {
  key: string
  label: string
  optionsGameId: string | null
  played: boolean
  playCount: number
  totalMinutes: number
  hasAssumedMinutes: boolean
  dateMinutes: Array<{ date: string; minutes: number; assumed: boolean }>
  monthDots: Array<{ monthKey: string; label: string; played: boolean }>
  projectedTimeLeftMinutes: number
  projectedTimeLeftAssumed: boolean
  projectedTimeLeftSource: 'played' | 'history' | 'fallback' | 'none'
  projectedTimeLeftTooltip: string
}

type MonthlyChecklistProjection = {
  remainingGames: number
  projectedMinutes: number
  usesAssumedMinutes: boolean
  historyGames: number
  fallbackGames: number
  unavailableGames: number
}

type ChecklistItemProjection = {
  minutes: number
  assumed: boolean
  source: 'played' | 'history' | 'fallback' | 'none'
  tooltip: string
}

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function playLengthMinutes(play: BggPlay): number {
  const parsed = Number(play.attributes.length || '0')
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours <= 0) return `${mins}m`
  if (mins <= 0) return `${hours}h`
  return `${hours}h${String(mins).padStart(2, '0')}m`
}

function playMinutesWithAssumption(
  play: BggPlay,
  assumedMinutesByObjectId: Map<string, number> | undefined,
): { minutes: number; assumed: boolean } {
  const actual = playLengthMinutes(play)
  if (actual > 0) return { minutes: actual, assumed: false }

  const objectId = play.item?.attributes.objectid || ''
  if (!objectId) return { minutes: 0, assumed: false }
  const assumed = assumedMinutesByObjectId?.get(objectId)
  if (!assumed) return { minutes: 0, assumed: false }
  return { minutes: assumed, assumed: true }
}

function assumedMinutesForChecklistItem(
  item: ChecklistItem,
  assumedMinutesByObjectId: Map<string, number> | undefined,
): number | null {
  for (const objectId of item.objectIds) {
    const assumed = assumedMinutesByObjectId?.get(objectId)
    if (assumed && assumed > 0) return assumed
  }
  return null
}

function projectedTimeLeftForChecklistItem(input: {
  item: ChecklistItem
  plays: BggPlay[]
  maxMonthIndex: number
  assumedMinutesByObjectId: Map<string, number> | undefined
  monthLabel: string
  alreadyPlayed: boolean
}): ChecklistItemProjection {
  if (input.alreadyPlayed) {
    return {
      minutes: 0,
      assumed: false,
      source: 'played',
      tooltip: `Already played in ${input.monthLabel}.\nProjected time left: 0m.`,
    }
  }

  let totalMinutes = 0
  let usedAssumption = false
  const measuredMonthKeys = new Set<string>()

  for (const play of input.plays) {
    if (!isPlayForItem(play, input.item)) continue

    const date = play.attributes.date || ''
    const monthKey = monthKeyFromDate(date)
    const monthIndex = monthKey ? monthIndexFromKey(monthKey) : null
    if (!monthKey || monthIndex === null || monthIndex > input.maxMonthIndex) continue

    const qty = playQuantity(play)
    const resolved = playMinutesWithAssumption(play, input.assumedMinutesByObjectId)
    const minutes = resolved.minutes * qty
    if (minutes <= 0) continue

    totalMinutes += minutes
    measuredMonthKeys.add(monthKey)
    if (resolved.assumed) usedAssumption = true
  }

  if (measuredMonthKeys.size > 0 && totalMinutes > 0) {
    const averageMinutes = Math.round(totalMinutes / measuredMonthKeys.size)
    return {
      minutes: averageMinutes,
      assumed: usedAssumption,
      source: 'history',
      tooltip: [
        `${formatMinutes(averageMinutes)} projected from monthly history.`,
        `Calculation: ${formatMinutes(totalMinutes)} across ${measuredMonthKeys.size} active month${measuredMonthKeys.size === 1 ? '' : 's'} ÷ ${measuredMonthKeys.size} = ${formatMinutes(averageMinutes)}.`,
        usedAssumption ? 'Includes estimated time for zero-length plays.' : 'Uses recorded play lengths only.',
      ].join('\n'),
    }
  }

  const fallbackMinutes = assumedMinutesForChecklistItem(input.item, input.assumedMinutesByObjectId)
  if (fallbackMinutes && fallbackMinutes > 0) {
    return {
      minutes: fallbackMinutes,
      assumed: true,
      source: 'fallback',
      tooltip: [
        `${formatMinutes(fallbackMinutes)} projected from BGG playing time.`,
        'Calculation: no monthly history available, so this falls back to the game\'s BGG playing time.',
      ].join('\n'),
    }
  }

  return {
    minutes: 0,
    assumed: false,
    source: 'none',
    tooltip: [
      'No projected time available.',
      'Calculation: no monthly history and no BGG playing-time estimate were found.',
    ].join('\n'),
  }
}

function isPlayForItem(play: BggPlay, item: ChecklistItem): boolean {
  if (item.useArkhamSpecialMatcher) return isArkhamHorrorLcgPlay(play)

  const objectId = play.item?.attributes.objectid || ''
  if (item.objectIds.includes(objectId)) return true

  const title = normalizeConfigurableGameMatchName(play.item?.attributes.name || '')
  if (!title) return false

  const patterns = item.aliases.map(normalizeConfigurableGameMatchName).filter(Boolean)
  return patterns.some((p) => title.includes(p))
}

function isPlayInChecklist(play: BggPlay, checklist: ReadonlyArray<ChecklistItem>): boolean {
  for (const item of checklist) {
    if (isPlayForItem(play, item)) return true
  }
  return false
}

function currentMonthIndex(now: Date): number {
  return now.getFullYear() * 12 + now.getMonth()
}

function monthInfoFromIndex(index: number): { key: string; prefix: string; label: string } {
  const year = Math.floor(index / 12)
  const monthIndex = index % 12
  const key = monthKeyFromIndex(index)
  const label = new Date(year, monthIndex, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  return { key, prefix: `${key}-`, label }
}

function monthKeyFromDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value.slice(0, 7)
}

function monthIndexFromDate(value: string): number | null {
  const monthKey = monthKeyFromDate(value)
  if (!monthKey) return null
  return monthIndexFromKey(monthKey)
}

function monthIndexFromKey(monthKey: string): number | null {
  const parts = monthKey.split('-')
  if (parts.length !== 2) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return year * 12 + (month - 1)
}

function monthKeyFromIndex(index: number): string {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatMonthKey(monthKey: string): string {
  const index = monthIndexFromKey(monthKey)
  if (index === null) return monthKey
  const year = Math.floor(index / 12)
  const month = index % 12
  return new Date(year, month, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

function buildMonthDots(
  firstMonthKey: string | null,
  monthStatsByKey: Map<string, { count: number; minutes: number }>,
  visibleMonthIndex: number,
  maxMonths = 24,
): Array<{ monthKey: string; label: string; played: boolean }> {
  if (!firstMonthKey) return []
  const firstIndex = monthIndexFromKey(firstMonthKey)
  if (firstIndex === null) return []

  const currentIndex = visibleMonthIndex
  const startIndex = Math.max(firstIndex, currentIndex - (maxMonths - 1))
  const dots: Array<{ monthKey: string; label: string; played: boolean }> = []
  for (let index = startIndex; index <= currentIndex; index += 1) {
    const monthKey = monthKeyFromIndex(index)
    const stats = monthStatsByKey.get(monthKey) || { count: 0, minutes: 0 }
    const played = stats.count > 0
    dots.push({
      monthKey,
      played,
      label: `${formatMonthKey(monthKey)}: ${stats.count} play${stats.count === 1 ? '' : 's'}, ${formatMinutes(stats.minutes)}`,
    })
  }
  return dots
}

export default function MonthlyChecklistView(props: {
  plays: BggPlay[]
  authToken?: string
  onOpenGameOptions: (gameId: string) => void
}) {
  const [onlyUnplayed, setOnlyUnplayed] = createSignal(false)
  const activeChecklist = createMemo(() =>
    CONFIGURABLE_GAME_MATCH_DEFINITIONS.filter((item) => shouldShowGameInMonthlyChecklist(item.id)),
  )

  const nowMonthIndex = createMemo(() => currentMonthIndex(new Date()))
  const monthBounds = createMemo(() => {
    const nowIndex = nowMonthIndex()
    let firstIndex: number | null = null
    let lastIndex: number | null = null

    for (const play of props.plays) {
      const index = monthIndexFromDate(play.attributes.date || '')
      if (index === null) continue
      if (firstIndex === null || index < firstIndex) firstIndex = index
      if (lastIndex === null || index > lastIndex) lastIndex = index
    }

    if (firstIndex === null || lastIndex === null) {
      return { first: nowIndex, last: nowIndex }
    }

    return {
      first: Math.min(firstIndex, nowIndex),
      last: Math.max(lastIndex, nowIndex),
    }
  })
  const [selectedMonthIndex, setSelectedMonthIndex] = createSignal(nowMonthIndex())

  createEffect(() => {
    const bounds = monthBounds()
    const index = selectedMonthIndex()
    if (index < bounds.first) {
      setSelectedMonthIndex(bounds.first)
      return
    }
    if (index > bounds.last) {
      setSelectedMonthIndex(bounds.last)
    }
  })

  const month = createMemo(() => monthInfoFromIndex(selectedMonthIndex()))

  const assumedObjectIds = createMemo(() => {
    const checklist = activeChecklist()
    const monthPrefix = month().prefix
    const ids = new Set<string>()

    for (const item of checklist) {
      for (const objectId of item.objectIds) {
        if (objectId) ids.add(objectId)
      }
    }

    for (const play of props.plays) {
      if (playLengthMinutes(play) > 0) continue
      if (!isPlayInChecklist(play, checklist) && !(play.attributes.date || '').startsWith(monthPrefix)) continue
      const objectId = play.item?.attributes.objectid || ''
      if (objectId) ids.add(objectId)
    }

    return Array.from(ids).sort()
  })

  const [assumedMinutesByObjectId] = createResource(assumedObjectIds, async (ids) => {
    const result = new Map<string, number>()
    for (const objectId of ids) {
      try {
        const thing = await fetchThingSummary(objectId, { authToken: props.authToken })
        const minutes = thingAssumedPlayTimeMinutes(thing.raw)
        if (minutes) result.set(objectId, minutes)
      } catch {
        // ignore missing/rate-limited assumed play time
      }
    }
    return result
  })

  const rows = createMemo<MonthlyChecklistRow[]>(() => {
    const monthPrefix = month().prefix
    const monthLabel = month().label
    const plays = props.plays
    const assumed = assumedMinutesByObjectId()

    return activeChecklist().map((item) => {
      let playCount = 0
      let totalMinutes = 0
      const minutesByDate = new Map<string, number>()
      const assumedByDate = new Map<string, boolean>()
      let hasAssumedMinutes = false
      const monthStatsByKey = new Map<string, { count: number; minutes: number }>()
      let firstMonthKey: string | null = null

      for (const play of plays) {
        if (!isPlayForItem(play, item)) continue
        const date = play.attributes.date || ''
        const playMonthKey = monthKeyFromDate(date)
        const qty = playQuantity(play)
        if (playMonthKey) {
          const existingStats = monthStatsByKey.get(playMonthKey) || { count: 0, minutes: 0 }
          existingStats.count += qty
          existingStats.minutes += playLengthMinutes(play) * qty
          monthStatsByKey.set(playMonthKey, existingStats)
          if (!firstMonthKey || playMonthKey < firstMonthKey) firstMonthKey = playMonthKey
        }
        if (!date.startsWith(monthPrefix)) continue

        const resolved = playMinutesWithAssumption(play, assumed)
        const minutes = resolved.minutes * qty
        playCount += qty
        totalMinutes += minutes
        if (date) {
          minutesByDate.set(date, (minutesByDate.get(date) || 0) + minutes)
          if (resolved.assumed) {
            assumedByDate.set(date, true)
            hasAssumedMinutes = true
          }
        }
      }

      const projected = projectedTimeLeftForChecklistItem({
        item,
        plays,
        maxMonthIndex: selectedMonthIndex(),
        assumedMinutesByObjectId: assumed,
        monthLabel,
        alreadyPlayed: playCount > 0,
      })

      return {
        key: item.id,
        label: item.label,
        optionsGameId: item.id,
        played: playCount > 0,
        playCount,
        totalMinutes,
        hasAssumedMinutes,
        dateMinutes: Array.from(minutesByDate.entries())
          .map(([date, minutes]) => ({ date, minutes, assumed: assumedByDate.get(date) === true }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        monthDots: buildMonthDots(firstMonthKey, monthStatsByKey, selectedMonthIndex(), 24),
        projectedTimeLeftMinutes: projected.minutes,
        projectedTimeLeftAssumed: projected.assumed,
        projectedTimeLeftSource: projected.source,
        projectedTimeLeftTooltip: projected.tooltip,
      }
    })
  })

  const otherRows = createMemo(() => {
    const monthPrefix = month().prefix
    const plays = props.plays.filter((p) => !isPlayInChecklist(p, activeChecklist()))
    const assumed = assumedMinutesByObjectId()

    const byGame = new Map<
      string,
      {
        key: string
        label: string
        objectId: string
        playCount: number
        totalMinutes: number
        minutesByDate: Map<string, number>
        assumedByDate: Map<string, boolean>
        hasAssumedMinutes: boolean
        monthStatsByKey: Map<string, { count: number; minutes: number }>
        firstMonthKey: string | null
      }
    >()

    for (const play of plays) {
      const label = play.item?.attributes.name || 'Unknown game'
      const objectId = play.item?.attributes.objectid || ''
      const key = `${label}|||${objectId}`
      const date = play.attributes.date || ''
      const playMonthKey = monthKeyFromDate(date)
      const qty = playQuantity(play)

      const existing = byGame.get(key) || {
        key,
        label,
        objectId,
        playCount: 0,
        totalMinutes: 0,
        minutesByDate: new Map<string, number>(),
        assumedByDate: new Map<string, boolean>(),
        hasAssumedMinutes: false,
        monthStatsByKey: new Map<string, { count: number; minutes: number }>(),
        firstMonthKey: null,
      }

      if (playMonthKey) {
        const existingStats = existing.monthStatsByKey.get(playMonthKey) || { count: 0, minutes: 0 }
        existingStats.count += qty
        existingStats.minutes += playLengthMinutes(play) * qty
        existing.monthStatsByKey.set(playMonthKey, existingStats)
        if (!existing.firstMonthKey || playMonthKey < existing.firstMonthKey) {
          existing.firstMonthKey = playMonthKey
        }
      }

      if (!date.startsWith(monthPrefix)) {
        byGame.set(key, existing)
        continue
      }

      const resolved = playMinutesWithAssumption(play, assumed)
      const minutes = resolved.minutes * qty

      existing.playCount += qty
      existing.totalMinutes += minutes
      if (date) {
        existing.minutesByDate.set(date, (existing.minutesByDate.get(date) || 0) + minutes)
        if (resolved.assumed) {
          existing.assumedByDate.set(date, true)
          existing.hasAssumedMinutes = true
        }
      }
      byGame.set(key, existing)
    }

    return Array.from(byGame.values())
      .filter((row) => row.playCount > 0)
      .map((row) => ({
        key: row.key,
        label: row.label,
        optionsGameId: findConfigurableGameIdForOptions({ name: row.label, objectId: row.objectId }),
        played: true,
        playCount: row.playCount,
        totalMinutes: row.totalMinutes,
        hasAssumedMinutes: row.hasAssumedMinutes,
        dateMinutes: Array.from(row.minutesByDate.entries())
          .map(([date, minutes]) => ({ date, minutes, assumed: row.assumedByDate.get(date) === true }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        monthDots: buildMonthDots(row.firstMonthKey, row.monthStatsByKey, selectedMonthIndex(), 24),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  const totals = createMemo(() => {
    let checklistMinutes = 0
    let otherMinutes = 0
    let checklistAssumed = false
    let otherAssumed = false

    for (const row of rows()) {
      checklistMinutes += row.totalMinutes
      if (row.hasAssumedMinutes) checklistAssumed = true
    }
    for (const row of otherRows()) {
      otherMinutes += row.totalMinutes
      if (row.hasAssumedMinutes) otherAssumed = true
    }

    const totalMinutes = checklistMinutes + otherMinutes
    return {
      checklistMinutes,
      otherMinutes,
      totalMinutes,
      checklistAssumed,
      otherAssumed,
      totalAssumed: checklistAssumed || otherAssumed,
    }
  })

  const checklistCompletion = createMemo(() => {
    const checklistRows = rows()
    const total = checklistRows.length
    let completed = 0
    for (const row of checklistRows) {
      if (row.played) completed += 1
    }
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { completed, total, percent }
  })

  const checklistProjection = createMemo<MonthlyChecklistProjection>(() => {
    let remainingGames = 0
    let projectedMinutes = 0
    let usesAssumedMinutes = false
    let historyGames = 0
    let fallbackGames = 0
    let unavailableGames = 0

    for (const row of rows()) {
      if (row.played) continue
      remainingGames += 1
      projectedMinutes += row.projectedTimeLeftMinutes
      usesAssumedMinutes ||= row.projectedTimeLeftAssumed

      if (row.projectedTimeLeftSource === 'history') {
        historyGames += 1
        continue
      }
      if (row.projectedTimeLeftSource === 'fallback') {
        fallbackGames += 1
        continue
      }
      if (row.projectedTimeLeftSource === 'none') unavailableGames += 1
    }

    return {
      remainingGames,
      projectedMinutes: Math.round(projectedMinutes),
      usesAssumedMinutes,
      historyGames,
      fallbackGames,
      unavailableGames,
    }
  })

  const visibleRows = createMemo(() => {
    if (!onlyUnplayed()) return rows()
    return rows().filter((row) => !row.played)
  })

  const anyAssumedMinutes = createMemo(() => {
    if (checklistProjection().usesAssumedMinutes) return true
    for (const row of rows()) {
      if (row.hasAssumedMinutes) return true
    }
    for (const row of otherRows()) {
      if (row.hasAssumedMinutes) return true
    }
    return false
  })

  return (
    <div class="finalGirl">
      <div class="monthlyMonthNav">
        <button
          type="button"
          onClick={() => setSelectedMonthIndex((value) => value - 1)}
          disabled={selectedMonthIndex() <= monthBounds().first}
        >
          Prev month
        </button>

        <div class="meta monthlyMonthLabel">
        Month: <span class="mono">{month().label}</span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedMonthIndex((value) => value + 1)}
          disabled={selectedMonthIndex() >= monthBounds().last}
        >
          Next month
        </button>
      </div>

      <div class="monthlySummaryGrid">
        <section class="monthlySummaryCard monthlySummaryCardProgress">
          <div class="monthlySummaryLabel">Monthly checklist</div>
          <div class="monthlyProgressRing" style={{ '--progress': `${checklistCompletion().percent}%` }}>
            <div class="monthlyProgressInner">
              <span class="monthlyProgressValue mono">{checklistCompletion().percent}%</span>
            </div>
          </div>
          <div class="monthlySummarySubtext">
            <span class="mono">{checklistCompletion().completed.toLocaleString()}</span> of{' '}
            <span class="mono">{checklistCompletion().total.toLocaleString()}</span> checklist games played
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Total time</div>
          <div class="monthlySummaryValue mono">
            {formatMinutes(totals().totalMinutes)}
            {totals().totalAssumed ? '*' : ''}
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Checklist time</div>
          <div class="monthlySummaryValue mono">
            {formatMinutes(totals().checklistMinutes)}
            {totals().checklistAssumed ? '*' : ''}
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Projected time left</div>
          <div class="monthlySummaryValue mono">
            {formatMinutes(checklistProjection().projectedMinutes)}
            {checklistProjection().usesAssumedMinutes ? '*' : ''}
          </div>
          <div class="monthlySummarySubtext">
            <Show
              when={checklistProjection().remainingGames > 0}
              fallback={<>Checklist complete for this month.</>}
            >
              <span class="mono">{checklistProjection().remainingGames.toLocaleString()}</span> game
              {checklistProjection().remainingGames === 1 ? '' : 's'} left
              <Show when={checklistProjection().historyGames > 0}>
                {' • '}
                <span class="mono">{checklistProjection().historyGames.toLocaleString()}</span> from history
              </Show>
              <Show when={checklistProjection().fallbackGames > 0}>
                {' • '}
                <span class="mono">{checklistProjection().fallbackGames.toLocaleString()}</span> from BGG time
              </Show>
              <Show when={checklistProjection().unavailableGames > 0}>
                {' • '}
                <span class="mono">{checklistProjection().unavailableGames.toLocaleString()}</span> no estimate
              </Show>
            </Show>
          </div>
        </section>

        <section class="monthlySummaryCard">
          <div class="monthlySummaryLabel">Other time</div>
          <div class="monthlySummaryValue mono">
            {formatMinutes(totals().otherMinutes)}
            {totals().otherAssumed ? '*' : ''}
          </div>
        </section>
      </div>

      <div class="monthlyChecklistControls">
        <label class="control">
          <input
            type="checkbox"
            checked={onlyUnplayed()}
            onChange={(event) => setOnlyUnplayed(event.currentTarget.checked)}
          />
          <span>Show only unplayed checklist games</span>
        </label>
      </div>

      <div class="tableWrap">
        <table class="table tableCompact mobileCardTable">
          <thead>
            <tr>
              <th>Game</th>
              <th>Played</th>
              <th>Play count</th>
              <th>Total time</th>
              <th class="hideOnMobile">Projected time left</th>
              <th class="hideOnMobile">When played</th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={visibleRows().length > 0}
              fallback={
                <tr>
                  <td colspan="6" class="muted">
                    No checklist games match the current filter.
                  </td>
                </tr>
              }
            >
              <For each={visibleRows()}>
                {(row) => (
                  <tr classList={{ monthlyChecklistRowPlayed: row.played }}>
                    <td data-label="Game">
                      <div class="gameTitleRow">
                        <span classList={{ monthlyChecklistGamePlayed: row.played }}>{row.label}</span>
                        <Show when={row.optionsGameId}>
                          {(gameId) => (
                            <GameOptionsButton
                              gameId={gameId()}
                              gameLabel={row.label}
                              onOpenGameOptions={props.onOpenGameOptions}
                            />
                          )}
                        </Show>
                      </div>
                      <Show when={row.monthDots.length > 0}>
                        <div class="monthDots" aria-label={`${row.label} monthly play history`}>
                          <For each={row.monthDots}>
                            {(dot) => (
                              <span
                                classList={{ monthDot: true, monthDotPlayed: dot.played, monthDotMissed: !dot.played }}
                                title={dot.label}
                                aria-label={dot.label}
                              />
                            )}
                          </For>
                        </div>
                      </Show>
                    </td>
                    <td
                      class="mono"
                      classList={{ monthlyChecklistPlayedValue: row.played }}
                      data-label="Played"
                    >
                      {row.played ? '✓' : ''}
                    </td>
                    <td class="mono" data-label="Play count">{row.playCount ? row.playCount.toLocaleString() : '0'}</td>
                    <td class="mono" data-label="Total time">
                      {formatMinutes(row.totalMinutes)}
                      {row.hasAssumedMinutes ? '*' : ''}
                    </td>
                    <td class="mono hideOnMobile" data-label="Projected time left">
                      <details class="calcTooltip">
                        <summary
                          class="calcTooltipSummary"
                          title={row.projectedTimeLeftTooltip}
                          aria-label={row.projectedTimeLeftTooltip}
                        >
                          {row.projectedTimeLeftSource === 'none'
                            ? '—'
                            : formatMinutes(row.projectedTimeLeftMinutes)}
                          {row.projectedTimeLeftAssumed ? '*' : ''}
                        </summary>
                        <div class="calcTooltipBubble">{row.projectedTimeLeftTooltip}</div>
                      </details>
                    </td>
                    <td class="mono hideOnMobile" data-label="When played">
                      {row.dateMinutes.length > 0
                        ? row.dateMinutes
                            .map(
                              (d) =>
                                `${d.date} (${formatMinutes(d.minutes)}${d.assumed ? '*' : ''})`,
                            )
                            .join(', ')
                        : '—'}
                    </td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      <Show when={anyAssumedMinutes()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length, or when the projection needs a fallback estimate.
        </div>
      </Show>

      <div class="meta">
        Other games played: <span class="mono">{otherRows().length.toLocaleString()}</span>
      </div>

      <div class="tableWrap">
        <table class="table tableCompact mobileCardTable">
          <thead>
            <tr>
              <th>Game</th>
              <th>Played</th>
              <th>Play count</th>
              <th>Total time</th>
              <th class="hideOnMobile">When played</th>
            </tr>
          </thead>
          <tbody>
            <For each={otherRows()}>
              {(row) => (
                <tr>
                  <td data-label="Game">
                    <div class="gameTitleRow">
                      <span>{row.label}</span>
                      <Show when={row.optionsGameId}>
                        {(gameId) => (
                          <GameOptionsButton
                            gameId={gameId()}
                            gameLabel={row.label}
                            onOpenGameOptions={props.onOpenGameOptions}
                          />
                        )}
                      </Show>
                    </div>
                    <Show when={row.monthDots.length > 0}>
                      <div class="monthDots" aria-label={`${row.label} monthly play history`}>
                        <For each={row.monthDots}>
                          {(dot) => (
                            <span
                              classList={{ monthDot: true, monthDotPlayed: dot.played, monthDotMissed: !dot.played }}
                              title={dot.label}
                              aria-label={dot.label}
                            />
                          )}
                        </For>
                      </div>
                    </Show>
                  </td>
                  <td class="mono" data-label="Played">{row.played ? '✓' : ''}</td>
                  <td class="mono" data-label="Play count">{row.playCount ? row.playCount.toLocaleString() : '0'}</td>
                  <td class="mono" data-label="Total time">
                    {formatMinutes(row.totalMinutes)}
                    {row.hasAssumedMinutes ? '*' : ''}
                  </td>
                  <td class="mono hideOnMobile" data-label="When played">
                    {row.dateMinutes.length > 0
                      ? row.dateMinutes
                          .map(
                            (d) =>
                              `${d.date} (${formatMinutes(d.minutes)}${d.assumed ? '*' : ''})`,
                          )
                          .join(', ')
                      : '—'}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
