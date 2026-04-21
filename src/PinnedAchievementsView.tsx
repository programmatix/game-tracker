import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from './bgg'
import type { Achievement } from './achievements/types'
import { computeAllGameAchievementSummaries } from './achievements/games'
import GameLink from './components/GameLink'
import ProgressBar from './components/ProgressBar'
import {
  GAME_STATUS_OPTIONS,
  gamePreferencesFor,
  gameStatusLabel,
  isGameStatus,
  type GameStatus,
} from './gamePreferences'
import type { SpiritIslandSession } from './games/spirit-island/mindwanderer'

const PINNED_VISIBLE_STATUSES_STORAGE_KEY = 'pinned.visibleStatuses'
const PINNED_CHECKLIST_ONLY_STORAGE_KEY = 'pinned.checklistOnly'

type FilteredGamePins = {
  gameId: string
  gameName: string
  status: GameStatus
  statusLabel: string
  achievements: Achievement[]
}

function allGameStatuses(): GameStatus[] {
  return GAME_STATUS_OPTIONS.map((option) => option.value)
}

function readStoredVisibleStatuses(): GameStatus[] {
  if (typeof window === 'undefined') return allGameStatuses()

  try {
    const raw = window.localStorage.getItem(PINNED_VISIBLE_STATUSES_STORAGE_KEY)
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
    return window.localStorage.getItem(PINNED_CHECKLIST_ONLY_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function comparePinnedAchievements(a: Achievement, b: Achievement): number {
  const aCompleted = a.status === 'completed'
  const bCompleted = b.status === 'completed'
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1
  if (!aCompleted && a.remainingPlays !== b.remainingPlays) return a.remainingPlays - b.remainingPlays
  if (!aCompleted && a.playsSoFar !== b.playsSoFar) return b.playsSoFar - a.playsSoFar
  if (aCompleted && b.level !== a.level) return b.level - a.level
  return a.title.localeCompare(b.title)
}

function toggleStatus(current: GameStatus[], status: GameStatus): GameStatus[] {
  const next = current.includes(status)
    ? current.filter((value) => value !== status)
    : [...current, status]

  return GAME_STATUS_OPTIONS.map((option) => option.value).filter((value) => next.includes(value))
}

export default function PinnedAchievementsView(props: {
  plays: BggPlay[]
  username: string
  spiritIslandSessions?: SpiritIslandSession[]
  pinnedAchievementIds: ReadonlySet<string>
  loading: boolean
  onTogglePin: (achievementId: string) => void
  onOpenGame: (gameKey: string) => void
}) {
  const [visibleStatuses, setVisibleStatuses] = createSignal<GameStatus[]>(readStoredVisibleStatuses())
  const [checklistOnly, setChecklistOnly] = createSignal<boolean>(readStoredChecklistOnly())

  createEffect(() => {
    try {
      window.localStorage.setItem(
        PINNED_VISIBLE_STATUSES_STORAGE_KEY,
        JSON.stringify(visibleStatuses()),
      )
    } catch {
      return
    }
  })

  createEffect(() => {
    try {
      window.localStorage.setItem(PINNED_CHECKLIST_ONLY_STORAGE_KEY, String(checklistOnly()))
    } catch {
      return
    }
  })

  const visibleStatusSet = createMemo(() => new Set(visibleStatuses()))
  const filteredGames = createMemo<FilteredGamePins[]>(() =>
    computeAllGameAchievementSummaries(props.plays, props.username, {
      spiritIslandSessions: props.spiritIslandSessions,
    })
      .map((summary) => {
        const preferences = gamePreferencesFor(summary.gameId)
        return {
          gameId: summary.gameId,
          gameName: summary.gameName,
          status: preferences.status,
          statusLabel: gameStatusLabel(preferences.status),
          showInMonthlyChecklist: preferences.showInMonthlyChecklist,
          achievements: summary.achievements
            .filter((achievement) => props.pinnedAchievementIds.has(achievement.id))
            .slice()
            .sort(comparePinnedAchievements),
        }
      })
      .filter((summary) => {
        if (summary.achievements.length === 0) return false
        if (!visibleStatusSet().has(summary.status)) return false
        if (checklistOnly() && !summary.showInMonthlyChecklist) return false
        return true
      })
      .sort((a, b) => a.gameName.localeCompare(b.gameName)),
  )

  const totalPinnedVisible = createMemo(() =>
    filteredGames().reduce((sum, game) => sum + game.achievements.length, 0),
  )

  return (
    <div class="finalGirl pinnedAchievementsView">
      <div class="costsToolbar">
        <div class="costToolbarGroup">
          <div class="muted">Show statuses</div>
          <div class="costTargetGroup" role="group" aria-label="Visible game statuses">
            <For each={GAME_STATUS_OPTIONS}>
              {(status) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: visibleStatuses().includes(status.value) }}
                  onClick={() => setVisibleStatuses((current) => toggleStatus(current, status.value))}
                >
                  {status.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="costToolbarGroup">
          <div class="muted">Games</div>
          <div class="costTargetGroup" role="group" aria-label="Visible pinned achievement games">
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

      <div class="statsTitleRow">
        <h3 class="statsTitle">Pinned achievements</h3>
        <div class="muted mono">
          <span>Games:</span> {filteredGames().length.toLocaleString()}
          {' • '}
          <span>Pinned:</span> {totalPinnedVisible().toLocaleString()}
        </div>
      </div>

      <Show
        when={!props.loading}
        fallback={
          <div class="pinnedAchievementsLoading" role="status" aria-live="polite" aria-busy="true">
            <span class="loadingSpinner" aria-hidden="true"></span>
            <span class="muted">Loading pinned achievements…</span>
          </div>
        }
      >
        <Show
          when={filteredGames().length > 0}
          fallback={<div class="muted">No pinned achievements match the selected filters.</div>}
        >
          <div class="pinnedAchievementsSections">
            <For each={filteredGames()}>
              {(game) => (
                <section class="gameOptionsCard">
                  <div class="pinnedAchievementsSectionHeader">
                    <div>
                      <h4>
                        <GameLink
                          label={game.gameName}
                          gameKey={game.gameId}
                          onOpenGame={props.onOpenGame}
                        />
                      </h4>
                      <div class="muted pinnedAchievementsMeta">
                        <span class="statusBadge">{game.statusLabel}</span>
                        <span>{game.achievements.length.toLocaleString()} pinned</span>
                      </div>
                    </div>
                  </div>

                  <div class="tableWrap compact">
                    <table class="table compactTable">
                      <thead>
                        <tr>
                          <th class="pinCell" aria-label="Pinned"></th>
                          <th>Achievement</th>
                          <th class="mono">Status</th>
                          <th class="mono">Remaining</th>
                          <th>Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={game.achievements}>
                          {(achievement) => (
                            <tr class="achievementRow">
                              <td class="pinCell">
                                <button
                                  class="pinButton pinButtonActive"
                                  type="button"
                                  onClick={() => props.onTogglePin(achievement.id)}
                                  aria-label={`Unpin achievement ${achievement.title}`}
                                >
                                  ★
                                </button>
                              </td>
                              <td>
                                <div>{achievement.title}</div>
                                <Show when={achievement.completion}>
                                  <div class="achievementCompletion muted">
                                    <span>{achievement.completion!.detail}</span>
                                    <Show when={achievement.completion!.playDate}>
                                      <span class="mono"> {'—'} {achievement.completion!.playDate}</span>
                                    </Show>
                                  </div>
                                </Show>
                              </td>
                              <td class="mono">
                                <span class="statusBadge">
                                  {achievement.status === 'completed' ? 'Unlocked' : 'In progress'}
                                </span>
                              </td>
                              <td class="mono">
                                <Show when={achievement.status === 'available'} fallback={<span class="muted">—</span>}>
                                  {achievement.remainingLabel ?? achievement.remainingPlays.toLocaleString()}
                                </Show>
                              </td>
                              <td>
                                <ProgressBar
                                  value={achievement.progressValue}
                                  target={achievement.progressTarget}
                                  widthPx={240}
                                  label={achievement.progressLabel}
                                />
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}
