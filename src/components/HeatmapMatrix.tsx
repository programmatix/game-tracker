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
              {(col) => (
                <th class="heatmapColHead">
                  <div class="heatmapColLabel" title={col}>
                    {col}
                  </div>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => (
              <tr>
                <th class="heatmapRowHead" title={row}>
                  {row}
                </th>
                <For each={props.cols}>
                  {(col) => {
                    const count = () => props.getCount(row, col)
                    const intensity = () =>
                      props.maxCount > 0 ? count() / props.maxCount : 0
                    const label = () => `${row} × ${col}: ${count()}`
                    return (
                      <td>
                        <div
                          class="heatmapCell"
                          classList={{ heatmapCellZero: count() === 0 }}
                          style={{
                            'background-color':
                              count() === 0 ? 'transparent' : heatColor(intensity()),
                          }}
                          aria-label={label()}
                          title={label()}
                        >
                          {props.hideCounts ? '' : count() === 0 ? '—' : String(count())}
                        </div>
                      </td>
                    )
                  }}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

