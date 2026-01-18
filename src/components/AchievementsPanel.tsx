import { For, Show, createMemo } from 'solid-js'
import type { Achievement } from '../achievements/types'
import { sortUnlockedAchievements } from '../achievements/engine'
import ProgressBar from './ProgressBar'

export default function AchievementsPanel(props: {
  title?: string
  achievements: Achievement[]
  nextLimit: number
  showGameName?: boolean
}) {
  const sorted = createMemo(() => sortUnlockedAchievements(props.achievements))
  const nextAvailable = createMemo(() => sorted().available.slice(0, Math.max(0, props.nextLimit)))

  return (
    <div class="statsBlock">
      <div class="statsTitleRow">
        <h3 class="statsTitle">{props.title ?? 'Achievements'}</h3>
        <div class="muted mono">
          <span>Available:</span> {sorted().available.length.toLocaleString()}
          {' • '}
          <span>Completed:</span> {sorted().completed.length.toLocaleString()}
        </div>
      </div>

      <Show
        when={nextAvailable().length > 0}
        fallback={<div class="muted">No available achievements.</div>}
      >
        <div class="tableWrap compact">
          <table class="table compactTable">
            <thead>
              <tr>
                <th>Next</th>
                <th class="mono">Remaining</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              <For each={nextAvailable()}>
                {(achievement) => (
                  <tr>
                    <td>
                      <Show when={props.showGameName}>
                        <span class="muted">{achievement.gameName} — </span>
                      </Show>
                      <span>{achievement.title}</span>
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
        <summary>View all unlocked achievements</summary>
        <div class="achievementsList">
          <Show
            when={sorted().available.length > 0}
            fallback={<div class="muted">No available achievements.</div>}
          >
            <h4 class="achievementsSectionTitle">Available</h4>
            <div class="tableWrap compact">
              <table class="table compactTable">
                <thead>
                  <tr>
                    <th>Achievement</th>
                    <th class="mono">Remaining</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sorted().available}>
                    {(achievement) => (
                      <tr>
                        <td>
                          <Show when={props.showGameName}>
                            <span class="muted">{achievement.gameName} — </span>
                          </Show>
                          <span>{achievement.title}</span>
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
                    <th>Achievement</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sorted().completed}>
                    {(achievement) => (
                      <tr>
                        <td>
                          <Show when={props.showGameName}>
                            <span class="muted">{achievement.gameName} — </span>
                          </Show>
                          <span>{achievement.title}</span>
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

