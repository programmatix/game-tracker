import { For, Show, createMemo } from 'solid-js'
import type { Achievement } from '../achievements/types'
import { sortKeysByCountDesc } from '../stats'

export default function CountTable(props: {
  title: string
  plays: Record<string, number>
  wins?: Record<string, number>
  keys?: string[]
  getNextAchievement?: (key: string) => Achievement | undefined
  isOwned?: (key: string) => boolean
  getWarningTitle?: (key: string) => string | undefined
}) {
  const keys = createMemo(() => props.keys ?? sortKeysByCountDesc(props.plays))
  const wins = createMemo(() => props.wins ?? {})
  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title}</h3>
      <div class="tableWrap compact">
        <table class="table compactTable">
          <thead>
            <tr>
              <th>Name</th>
              <th class="mono">Plays</th>
              <th class="mono">Wins</th>
              <th>Next</th>
            </tr>
          </thead>
          <tbody>
            <For each={keys()}>
              {(key) => (
                <tr
                  classList={{
                    dimRow: props.isOwned ? !(props.isOwned(key) ?? true) : false,
                  }}
                >
                  <td>
                    <span class="heatmapRowLabel">
                      <span class="heatmapLabelText">{key}</span>
                      <Show when={props.getWarningTitle?.(key)}>
                        {(warningTitle) => (
                          <span
                            class="contentWarningIcon"
                            title={warningTitle()}
                            aria-label={warningTitle()}
                          >
                            ⚠
                          </span>
                        )}
                      </Show>
                    </span>
                  </td>
                  <td class="mono">{(props.plays[key] ?? 0).toLocaleString()}</td>
                  <td class="mono">{(wins()[key] ?? 0).toLocaleString()}</td>
                  <td class="muted">
                    <Show
                      when={props.getNextAchievement?.(key)}
                      fallback={<span class="muted">—</span>}
                    >
                      {(achievement) => (
                        <span>
                          {achievement().title}
                          <Show when={achievement().remainingPlays > 0}>
                            <span class="mono muted">
                              {' '}
                              ({achievement().remainingPlays.toLocaleString()} left)
                            </span>
                          </Show>
                        </span>
                      )}
                    </Show>
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
