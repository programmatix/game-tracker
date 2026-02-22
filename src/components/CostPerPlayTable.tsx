import { For, Show, createMemo } from 'solid-js'

export type CostPerPlayRow = {
  box: string
  cost: number
  plays: number
  hoursPlayed: number
}

export default function CostPerPlayTable(props: {
  rows: CostPerPlayRow[]
  currencySymbol: string
  overallPlays: number
  overallHours?: number
  overallCost?: number
  title?: string
  onPlaysClick?: (box: string) => void
}) {
  const rows = createMemo(() => props.rows)
  const overallCost = createMemo(() =>
    typeof props.overallCost === 'number'
      ? props.overallCost
      : rows().reduce((sum, row) => sum + row.cost, 0),
  )
  const overallHours = createMemo(() =>
    typeof props.overallHours === 'number'
      ? props.overallHours
      : rows().reduce((sum, row) => sum + row.hoursPlayed, 0),
  )

  const formatMoney = (value: number): string => {
    const amount = value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${props.currencySymbol}${amount}`
  }

  const formatCostPerPlay = (cost: number, plays: number): string =>
    plays > 0 ? formatMoney(cost / plays) : '—'
  const formatCostPerHour = (cost: number, hours: number): string =>
    hours > 0 ? formatMoney(cost / hours) : '—'
  const formatHours = (hours: number): string =>
    hours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title ?? 'Cost Per Play'}</h3>
      <div class="tableWrap compact">
        <table class="table compactTable">
          <thead>
            <tr>
              <th>Box / Expansion</th>
              <th class="mono">Cost</th>
              <th class="mono">Plays</th>
              <th class="mono">Hours</th>
              <th class="mono">Cost / play</th>
              <th class="mono">Cost / hour</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => (
                <tr>
                  <td>{row.box}</td>
                  <td class="mono">{formatMoney(row.cost)}</td>
                  <td class="mono">
                    <Show
                      when={Boolean(props.onPlaysClick) && row.plays > 0}
                      fallback={row.plays.toLocaleString()}
                    >
                      <button
                        type="button"
                        class="countLink"
                        onClick={() => props.onPlaysClick?.(row.box)}
                        title="View plays"
                      >
                        {row.plays.toLocaleString()}
                      </button>
                    </Show>
                  </td>
                  <td class="mono">{formatHours(row.hoursPlayed)}</td>
                  <td class="mono">{formatCostPerPlay(row.cost, row.plays)}</td>
                  <td class="mono">{formatCostPerHour(row.cost, row.hoursPlayed)}</td>
                </tr>
              )}
            </For>
            <tr>
              <th>Overall</th>
              <th class="mono">{formatMoney(overallCost())}</th>
              <th class="mono">{props.overallPlays.toLocaleString()}</th>
              <th class="mono">{formatHours(overallHours())}</th>
              <th class="mono">{formatCostPerPlay(overallCost(), props.overallPlays)}</th>
              <th class="mono">{formatCostPerHour(overallCost(), overallHours())}</th>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
