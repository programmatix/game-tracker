import { For, Show, createMemo } from 'solid-js'
import type { Achievement } from '../achievements/types'
import { sortUnlockedAchievements } from '../achievements/engine'
import ProgressBar from './ProgressBar'

function AchievementCompletionRow(props: { achievement: Achievement }) {
  const completion = () => props.achievement.completion
  return (
    <Show when={props.achievement.status === 'completed' && completion()}>
      <div class="achievementCompletion muted">
        <span>{completion()!.detail}</span>
        <Show when={completion()!.playDate}>
          <span class="mono"> {'—'} {completion()!.playDate}</span>
        </Show>
      </div>
    </Show>
  )
}

export default function AchievementsPanel(props: {
  title?: string
  achievements: Achievement[]
  nextLimit: number
  showGameName?: boolean
  pinnedAchievementIds: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  suppressAvailableTrackIds?: ReadonlySet<string>
}) {
  const isPinned = (achievementId: string) => props.pinnedAchievementIds.has(achievementId)

  const filteredAchievements = createMemo(() => {
    const suppress = props.suppressAvailableTrackIds
    if (!suppress || suppress.size === 0) return props.achievements
    return props.achievements.filter(
      (achievement) =>
        !(
          achievement.status === 'available' &&
          suppress.has(achievement.trackId) &&
          !isPinned(achievement.id)
        ),
    )
  })

  const sorted = createMemo(() =>
    sortUnlockedAchievements(filteredAchievements(), {
      pinnedAchievementIds: props.pinnedAchievementIds,
    }),
  )
  const nextLocked = createMemo(() => {
    const available = sorted().available
    const pinned = available.filter((achievement) => isPinned(achievement.id))
    const unpinned = available.filter((achievement) => !isPinned(achievement.id))
    const remainingSlots = Math.max(0, props.nextLimit - pinned.length)
    return [...pinned, ...unpinned.slice(0, remainingSlots)]
  })

  return (
    <div class="statsBlock">
      <div class="statsTitleRow">
        <h3 class="statsTitle">{props.title ?? 'Achievements'}</h3>
        <div class="muted mono">
          <span>Locked:</span> {sorted().available.length.toLocaleString()}
          {' • '}
          <span>Completed:</span> {sorted().completed.length.toLocaleString()}
        </div>
      </div>

      <Show
        when={nextLocked().length > 0}
        fallback={<div class="muted">No locked achievements.</div>}
      >
        <div class="tableWrap compact">
          <table class="table compactTable">
            <thead>
              <tr>
                <th class="pinCell" aria-label="Pinned"></th>
                <th>Next</th>
                <th class="mono">Remaining</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              <For each={nextLocked()}>
                {(achievement) => (
                  <tr>
                    <td class="pinCell">
                      <button
                        class="pinButton"
                        classList={{ pinButtonActive: isPinned(achievement.id) }}
                        type="button"
                        onClick={() => props.onTogglePin(achievement.id)}
                        aria-label={
                          isPinned(achievement.id) ? 'Unpin achievement' : 'Pin achievement'
                        }
                      >
                        {isPinned(achievement.id) ? '★' : '☆'}
                      </button>
                    </td>
                    <td>
                      <Show when={props.showGameName}>
                        <span class="muted">{achievement.gameName} — </span>
                      </Show>
                      <span>{achievement.title}</span>
                      <Show when={isPinned(achievement.id) && achievement.status === 'completed'}>
                        <span class="achievementTag">Unlocked</span>
                      </Show>
                      <AchievementCompletionRow achievement={achievement} />
                    </td>
                    <td class="mono">{achievement.remainingPlays.toLocaleString()}</td>
                    <td>
                      <ProgressBar
                        value={achievement.progressValue}
                        target={achievement.progressTarget}
                        widthPx={220}
                        label={achievement.progressLabel}
                      />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <details class="details">
        <summary>View all achievements</summary>
        <div class="achievementsList">
          <Show
            when={sorted().available.length > 0}
            fallback={<div class="muted">No locked achievements.</div>}
          >
            <h4 class="achievementsSectionTitle">Locked</h4>
            <div class="tableWrap compact">
              <table class="table compactTable">
                <thead>
                  <tr>
                    <th class="pinCell" aria-label="Pinned"></th>
                    <th>Achievement</th>
                    <th class="mono">Remaining</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sorted().available}>
                    {(achievement) => (
                      <tr>
                        <td class="pinCell">
                          <button
                            class="pinButton"
                            classList={{ pinButtonActive: isPinned(achievement.id) }}
                            type="button"
                            onClick={() => props.onTogglePin(achievement.id)}
                            aria-label={
                              isPinned(achievement.id) ? 'Unpin achievement' : 'Pin achievement'
                            }
                          >
                            {isPinned(achievement.id) ? '★' : '☆'}
                          </button>
                        </td>
                        <td>
                          <Show when={props.showGameName}>
                            <span class="muted">{achievement.gameName} — </span>
                          </Show>
                          <span>{achievement.title}</span>
                          <Show when={isPinned(achievement.id) && achievement.status === 'completed'}>
                            <span class="achievementTag">Unlocked</span>
                          </Show>
                          <AchievementCompletionRow achievement={achievement} />
                        </td>
                        <td class="mono">{achievement.remainingPlays.toLocaleString()}</td>
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
          </Show>

          <Show when={sorted().completed.length > 0}>
            <h4 class="achievementsSectionTitle">Completed</h4>
            <div class="tableWrap compact">
              <table class="table compactTable">
                <thead>
                  <tr>
                    <th class="pinCell" aria-label="Pinned"></th>
                    <th>Achievement</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sorted().completed}>
                    {(achievement) => (
                      <tr>
                        <td class="pinCell">
                          <button
                            class="pinButton"
                            classList={{ pinButtonActive: isPinned(achievement.id) }}
                            type="button"
                            onClick={() => props.onTogglePin(achievement.id)}
                            aria-label={
                              isPinned(achievement.id) ? 'Unpin achievement' : 'Pin achievement'
                            }
                          >
                            {isPinned(achievement.id) ? '★' : '☆'}
                          </button>
                        </td>
                        <td>
                          <Show when={props.showGameName}>
                            <span class="muted">{achievement.gameName} — </span>
                          </Show>
                          <span>{achievement.title}</span>
                          <AchievementCompletionRow achievement={achievement} />
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
          </Show>
        </div>
      </details>
    </div>
  )
}
