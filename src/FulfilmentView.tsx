import { For, Show, createMemo } from 'solid-js'
import { CONFIGURABLE_GAME_DEFINITIONS } from './configurableGames'
import type { ResolvedGamePreferencesById } from './gamePreferences'
import { formatMonthKey, monthIndexFromKey } from './monthKey'
import { purchaseGameFamilyById } from './purchaseGameFamilies'

type FulfilmentRow = {
  gameId: string
  label: string
  estimatedDeliveryMonth?: string
  price?: number
}

type PendingFulfilmentRow = FulfilmentRow & {
  status?: string
}

type FulfilmentGroup = {
  monthKey: string
  monthLabel: string
  rows: FulfilmentRow[]
}

const poundsFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

export default function FulfilmentView(props: {
  gamePreferencesById: ResolvedGamePreferencesById
  onOpenGameOptions: (gameId: string) => void
}) {
  const rows = createMemo<FulfilmentRow[]>(() =>
    CONFIGURABLE_GAME_DEFINITIONS.map<PendingFulfilmentRow>((game) => {
      const preferences = props.gamePreferencesById[game.id]
      const purchaseFamily = purchaseGameFamilyById.get(game.id)
      return {
        gameId: game.id,
        label: game.label,
        estimatedDeliveryMonth: preferences?.estimatedDeliveryMonth,
        price: purchaseFamily?.price,
        status: preferences?.status,
      }
    })
      .filter((row) => row.status === 'waitingOnShipping')
      .map(({ status: _status, ...row }) => row)
      .sort((left, right) => {
        const leftIndex = left.estimatedDeliveryMonth ? monthIndexFromKey(left.estimatedDeliveryMonth) : null
        const rightIndex = right.estimatedDeliveryMonth ? monthIndexFromKey(right.estimatedDeliveryMonth) : null

        if (leftIndex !== null && rightIndex !== null && leftIndex !== rightIndex) {
          return leftIndex - rightIndex
        }
        if (leftIndex !== null) return -1
        if (rightIndex !== null) return 1
        return left.label.localeCompare(right.label)
      }),
  )

  const groupedRows = createMemo<FulfilmentGroup[]>(() => {
    const groups = new Map<string, FulfilmentGroup>()

    for (const row of rows()) {
      if (!row.estimatedDeliveryMonth) continue
      const existing = groups.get(row.estimatedDeliveryMonth)
      if (existing) {
        existing.rows.push(row)
        continue
      }
      groups.set(row.estimatedDeliveryMonth, {
        monthKey: row.estimatedDeliveryMonth,
        monthLabel: formatMonthKey(row.estimatedDeliveryMonth),
        rows: [row],
      })
    }

    return [...groups.values()]
  })

  const rowsWithoutEstimate = createMemo(() => rows().filter((row) => !row.estimatedDeliveryMonth))

  const totals = createMemo(() => {
    const allRows = rows()
    const withEstimate = allRows.filter((row) => row.estimatedDeliveryMonth).length
    const knownMonths = groupedRows()
    const totalValue = allRows.reduce((sum, row) => sum + (row.price || 0), 0)

    return {
      total: allRows.length,
      withEstimate,
      withoutEstimate: allRows.length - withEstimate,
      nextMonth: knownMonths[0]?.monthLabel || '—',
      totalValue,
    }
  })

  return (
    <div class="statsBlock fulfilmentView">
      <div class="statsTitleRow">
        <h3 class="statsTitle">Fulfilment</h3>
        <div class="muted">Games currently marked as awaiting shipping.</div>
      </div>

      <Show when={rows().length > 0} fallback={<div class="muted">No games are currently awaiting shipping.</div>}>
        <div class="monthlySummaryGrid">
          <section class="monthlySummaryCard">
            <div class="monthlySummaryLabel">Awaiting shipping</div>
            <div class="monthlySummaryValue mono">{totals().total.toLocaleString()}</div>
            <div class="monthlySummarySubtext">All configurable games currently in the fulfilment pipeline.</div>
          </section>

          <section class="monthlySummaryCard">
            <div class="monthlySummaryLabel">Estimates set</div>
            <div class="monthlySummaryValue mono">
              {totals().withEstimate.toLocaleString()}/{totals().total.toLocaleString()}
            </div>
            <div class="monthlySummarySubtext">
              {totals().withoutEstimate > 0
                ? `${totals().withoutEstimate.toLocaleString()} still need a delivery month.`
                : 'Every awaiting shipment has an estimated month.'}
            </div>
          </section>

          <section class="monthlySummaryCard">
            <div class="monthlySummaryLabel">Next estimated month</div>
            <div class="monthlySummaryValue">{totals().nextMonth}</div>
            <div class="monthlySummarySubtext">Earliest delivery month currently recorded.</div>
          </section>

          <section class="monthlySummaryCard">
            <div class="monthlySummaryLabel">Tracked value</div>
            <div class="monthlySummaryValue mono">{poundsFormatter.format(totals().totalValue)}</div>
            <div class="monthlySummarySubtext">Purchase value across the awaiting-shipping games.</div>
          </section>
        </div>

        <div class="fulfilmentGroups">
          <For each={groupedRows()}>
            {(group) => (
              <section class="gameOptionsCard">
                <div class="gameOptionsCardHeader">
                  <h4>{group.monthLabel}</h4>
                  <div class="muted">{group.rows.length.toLocaleString()} game{group.rows.length === 1 ? '' : 's'}</div>
                </div>

                <div class="gameOptionsRows">
                  <For each={group.rows}>
                    {(row) => (
                      <div class="gameOptionRow">
                        <div class="gameOptionCopy">
                          <div class="gameOptionTitle">{row.label}</div>
                          <div class="muted mono">{row.gameId}</div>
                        </div>

                        <div class="fulfilmentRowAside">
                          <Show when={typeof row.price === 'number'}>
                            <div class="muted mono">{poundsFormatter.format(row.price || 0)}</div>
                          </Show>
                          <button class="linkButton" type="button" onClick={() => props.onOpenGameOptions(row.gameId)}>
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>

          <Show when={rowsWithoutEstimate().length > 0}>
            <section class="gameOptionsCard">
              <div class="gameOptionsCardHeader">
                <h4>Estimated month missing</h4>
                <div class="muted">{rowsWithoutEstimate().length.toLocaleString()} game{rowsWithoutEstimate().length === 1 ? '' : 's'}</div>
              </div>

              <div class="gameOptionsRows">
                <For each={rowsWithoutEstimate()}>
                  {(row) => (
                    <div class="gameOptionRow">
                      <div class="gameOptionCopy">
                        <div class="gameOptionTitle">{row.label}</div>
                        <div class="muted mono">{row.gameId}</div>
                      </div>

                      <div class="fulfilmentRowAside">
                        <Show when={typeof row.price === 'number'}>
                          <div class="muted mono">{poundsFormatter.format(row.price || 0)}</div>
                        </Show>
                        <button class="linkButton" type="button" onClick={() => props.onOpenGameOptions(row.gameId)}>
                          Set month
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </section>
          </Show>
        </div>
      </Show>
    </div>
  )
}
