import { For } from 'solid-js'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function heatColor(intensity: number): string {
  const t = clamp(intensity, 0, 1)
  const lightness = 18 + t * 38
  const saturation = 58
  const hue = 152
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export default function HeatmapMatrix(props: {
  rows: string[]
  cols: string[]
  getCount: (row: string, col: string) => number
  rowHeader: string
  colHeader: string
  maxCount: number
  hideCounts?: boolean
  getRowWarningTitle?: (row: string) => string | undefined
  getColWarningTitle?: (col: string) => string | undefined
  onCellClick?: (row: string, col: string) => void
}) {
  return (
    <div class="heatmapWrap">
      <table class="heatmapTable">
        <thead>
          <tr>
            <th class="heatmapCorner">
              {props.rowHeader} \ {props.colHeader}
            </th>
            <For each={props.cols}>
              {(col) => {
                const warningTitle = () => props.getColWarningTitle?.(col)
                return (
                  <th class="heatmapColHead">
                    <div class="heatmapColLabel" title={col}>
                      <span class="heatmapLabelText">{col}</span>
                      {warningTitle() ? (
                        <span
                          class="contentWarningIcon"
                          title={warningTitle()}
                          aria-label={warningTitle()}
                        >
                          ⚠
                        </span>
                      ) : null}
                    </div>
                  </th>
                )
              }}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => {
              const warningTitle = () => props.getRowWarningTitle?.(row)
              return (
                <tr>
                  <th class="heatmapRowHead" title={row}>
                    <div class="heatmapRowLabel">
                      <span class="heatmapLabelText">{row}</span>
                      {warningTitle() ? (
                        <span
                          class="contentWarningIcon"
                          title={warningTitle()}
                          aria-label={warningTitle()}
                        >
                          ⚠
                        </span>
                      ) : null}
                    </div>
                  </th>
                  <For each={props.cols}>
                    {(col) => {
                      const count = () => props.getCount(row, col)
                      const intensity = () =>
                        props.maxCount > 0 ? count() / props.maxCount : 0
                      const label = () => `${row} × ${col}: ${count()}`
                      const isClickable = () => Boolean(props.onCellClick) && count() > 0
                      return (
                        <td>
                          <button
                            type="button"
                            class="heatmapCell"
                            classList={{
                              heatmapCellZero: count() === 0,
                              heatmapCellClickable: isClickable(),
                            }}
                            style={{
                              'background-color':
                                count() === 0 ? 'transparent' : heatColor(intensity()),
                            }}
                            aria-label={
                              isClickable() ? `${label()}. Click to view plays.` : label()
                            }
                            title={isClickable() ? `${label()} (view plays)` : label()}
                            disabled={!isClickable()}
                            onClick={() => props.onCellClick?.(row, col)}
                          >
                            {props.hideCounts ? '' : count() === 0 ? '—' : String(count())}
                          </button>
                        </td>
                      )
                    }}
                  </For>
                </tr>
              )
            }}
          </For>
        </tbody>
      </table>
    </div>
  )
}
