import { For, Show, createMemo } from 'solid-js'
import { sortKeysByCountDesc } from '../stats'
import ProgressBar from './ProgressBar'

export default function CountTable(props: {
  title: string
  counts: Record<string, number>
  keys?: string[]
  targetPlays?: number
  progressWidthPx?: number
  isOwned?: (key: string) => boolean
  getWarningTitle?: (key: string) => string | undefined
}) {
  const keys = createMemo(() => props.keys ?? sortKeysByCountDesc(props.counts))
  const targetPlays = createMemo(() => (props.targetPlays === undefined ? 5 : props.targetPlays))
  const shouldShowTarget = createMemo(() => targetPlays() > 0)
  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title}</h3>
      <div class="tableWrap compact">
        <table class="table compactTable">
          <thead>
            <tr>
              <th>Name</th>
              <th class="mono">Plays</th>
              <Show when={shouldShowTarget()}>
                <th class="mono">Target</th>
              </Show>
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
                  <td class="mono">{(props.counts[key] ?? 0).toLocaleString()}</td>
                  <Show when={shouldShowTarget()}>
                    <td>
                      <ProgressBar
                        value={props.counts[key] ?? 0}
                        target={targetPlays()}
                        widthPx={props.progressWidthPx ?? 160}
                      />
                    </td>
                  </Show>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
