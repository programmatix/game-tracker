import { For, Show } from 'solid-js'

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
  getCellDisplayText?: (row: string, col: string, count: number) => string
  getCellBackgroundColor?: (
    row: string,
    col: string,
    count: number,
    intensity: number,
  ) => string | undefined
  getCellLabel?: (row: string, col: string, count: number) => string
  rowGroupBy?: (row: string) => string | undefined
  colGroupBy?: (col: string) => string | undefined
  getRowWarningTitle?: (row: string) => string | undefined
  getColWarningTitle?: (col: string) => string | undefined
  onCellClick?: (row: string, col: string) => void
}) {
  const colGroupSegments = () => {
    const groupBy = props.colGroupBy
    if (!groupBy) return []

    const segments: Array<{ label: string; span: number }> = []
    let currentLabel: string | null = null
    let currentSpan = 0

    for (const col of props.cols) {
      const label = groupBy(col) ?? ''
      if (currentLabel === null) {
        currentLabel = label
        currentSpan = 1
        continue
      }
      if (label === currentLabel) {
        currentSpan += 1
        continue
      }
      segments.push({ label: currentLabel, span: currentSpan })
      currentLabel = label
      currentSpan = 1
    }

    if (currentLabel !== null) segments.push({ label: currentLabel, span: currentSpan })
    const hasAnyLabel = segments.some((segment) => segment.label.trim().length > 0)
    return hasAnyLabel ? segments : []
  }

  const showColGroups = () => colGroupSegments().length > 0

  const rowGroupSpans = () => {
    const groupBy = props.rowGroupBy
    if (!groupBy) return null

    const spans = new Map<number, { label: string; span: number }>()
    let i = 0
    const rows = props.rows
    while (i < rows.length) {
      const label = groupBy(rows[i]!) ?? ''
      const startIndex = i
      let count = 1
      i++
      while (i < rows.length && (groupBy(rows[i]!) ?? '') === label) {
        count++
        i++
      }
      spans.set(startIndex, { label, span: count })
    }

    const hasLabels = [...spans.values()].some((s) => s.label.trim().length > 0)
    return hasLabels ? spans : null
  }

  const hasRowGroups = () => rowGroupSpans() !== null
  const cornerColSpan = () => (hasRowGroups() ? 2 : 1)

  return (
    <div
      class="heatmapWrap"
      style={{
        '--heatmap-row-group-width': hasRowGroups() ? '28px' : '0px',
        '--heatmap-col-group-height': showColGroups() ? '28px' : '0px',
      }}
    >
      <table class="heatmapTable">
        <thead>
          <Show when={showColGroups()} fallback={
            <tr>
              <th class="heatmapCorner" colSpan={cornerColSpan()}>
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
          }>
            <tr>
              <th class="heatmapCorner" rowSpan={2} colSpan={cornerColSpan()}>
                {props.rowHeader} \ {props.colHeader}
              </th>
              <For each={colGroupSegments()}>
                {(segment) => (
                  <th class="heatmapColGroupHead" colSpan={segment.span} title={segment.label || undefined}>
                    <div class="heatmapColGroupLabel">{segment.label}</div>
                  </th>
                )}
              </For>
            </tr>
            <tr>
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
          </Show>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row, index) => {
              const warningTitle = () => props.getRowWarningTitle?.(row)
              const groupSpan = () => rowGroupSpans()?.get(index()) ?? null

              return (
                <tr>
                  {groupSpan() !== null ? (
                    <th
                      class="heatmapRowGroupCell"
                      rowSpan={groupSpan()!.span}
                      title={groupSpan()!.label.trim() || undefined}
                    >
                      {groupSpan()!.label.trim() ? (
                        <div class="heatmapRowGroupLabel">{groupSpan()!.label}</div>
                      ) : null}
                    </th>
                  ) : null}
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
                      const label = () =>
                        props.getCellLabel?.(row, col, count()) ?? `${row} × ${col}: ${count()}`
                      const isClickable = () => Boolean(props.onCellClick) && count() > 0
                      const displayText = () => {
                        if (props.getCellDisplayText) return props.getCellDisplayText(row, col, count())
                        if (props.hideCounts) return ''
                        return count() === 0 ? '—' : String(count())
                      }
                      const backgroundColor = () =>
                        props.getCellBackgroundColor?.(row, col, count(), intensity()) ??
                        (count() === 0 ? 'transparent' : heatColor(intensity()))
                      return (
                        <td class="heatmapCellWrap">
                          <button
                            type="button"
                            class="heatmapCell"
                            classList={{
                              heatmapCellZero: count() === 0,
                              heatmapCellClickable: isClickable(),
                            }}
                            style={{
                              'background-color': backgroundColor(),
                            }}
                            aria-label={
                              isClickable() ? `${label()}. Click to view plays.` : label()
                            }
                            title={isClickable() ? `${label()} (view plays)` : label()}
                            disabled={!isClickable()}
                            onClick={() => props.onCellClick?.(row, col)}
                          >
                            {displayText()}
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
