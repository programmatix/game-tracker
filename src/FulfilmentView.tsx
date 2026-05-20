import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { CONFIGURABLE_GAME_DEFINITIONS } from './configurableGames'
import type { ResolvedGamePreferencesById } from './gamePreferences'
import { formatMonthKey, monthIndexFromKey } from './monthKey'
import { purchaseGameFamilyById } from './purchaseGameFamilies'

type FulfilmentRow = {
  gameId: string
  label: string
  estimatedDeliveryMonth?: string
  hasProvidedShippingAddress: boolean
  shippingAddressLastCheckedDate?: string
  shippingAddressCheckNote?: string
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

type ShippingAddressFilter = 'all' | 'provided' | 'needed' | 'staleCheck'

const SHIPPING_ADDRESS_FILTER_STORAGE_KEY = 'fulfilment.shippingAddressFilter'

const SHIPPING_ADDRESS_FILTER_OPTIONS: ReadonlyArray<{ value: ShippingAddressFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'provided', label: 'Address provided' },
  { value: 'needed', label: 'Address needed' },
  { value: 'staleCheck', label: 'Not checked 30 days' },
]

function isShippingAddressFilter(value: unknown): value is ShippingAddressFilter {
  return value === 'all' || value === 'provided' || value === 'needed' || value === 'staleCheck'
}

function readStoredShippingAddressFilter(): ShippingAddressFilter {
  if (typeof window === 'undefined') return 'all'

  try {
    const stored = window.localStorage.getItem(SHIPPING_ADDRESS_FILTER_STORAGE_KEY)
    return isShippingAddressFilter(stored) ? stored : 'all'
  } catch {
    return 'all'
  }
}

function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateIndexFromKey(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (
    Number.isNaN(timestamp) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return Math.floor(timestamp / 86_400_000)
}

function formatDateKey(dateKey: string | undefined): string {
  if (!dateKey) return 'Never checked'
  return dateKey
}

export default function FulfilmentView(props: {
  gamePreferencesById: ResolvedGamePreferencesById
  onOpenGame: (gameId: string) => void
  onOpenGameOptions: (gameId: string) => void
}) {
  const [shippingAddressFilter, setShippingAddressFilter] = createSignal<ShippingAddressFilter>(
    readStoredShippingAddressFilter(),
  )

  const currentMonthIndex = createMemo(() => {
    const now = new Date()
    return now.getFullYear() * 12 + now.getMonth()
  })
  const staleCheckThresholdDateIndex = createMemo(() => {
    const todayIndex = dateIndexFromKey(dateKeyFromDate(new Date()))
    return todayIndex === null ? null : todayIndex - 30
  })

  const isOverdue = (row: FulfilmentRow) => {
    const monthIndex = row.estimatedDeliveryMonth ? monthIndexFromKey(row.estimatedDeliveryMonth) : null
    return monthIndex !== null && monthIndex < currentMonthIndex()
  }

  const isShippingCheckStale = (row: FulfilmentRow) => {
    const threshold = staleCheckThresholdDateIndex()
    if (threshold === null) return false
    const checkedIndex = row.shippingAddressLastCheckedDate
      ? dateIndexFromKey(row.shippingAddressLastCheckedDate)
      : null
    return checkedIndex === null || checkedIndex <= threshold
  }

  createEffect(() => {
    try {
      window.localStorage.setItem(SHIPPING_ADDRESS_FILTER_STORAGE_KEY, shippingAddressFilter())
    } catch {
      // Ignore storage failures; the filter still works for the current session.
    }
  })

  const allRows = createMemo<FulfilmentRow[]>(() =>
    CONFIGURABLE_GAME_DEFINITIONS.map<PendingFulfilmentRow>((game) => {
      const preferences = props.gamePreferencesById[game.id]
      const purchaseFamily = purchaseGameFamilyById.get(game.id)
      return {
        gameId: game.id,
        label: game.label,
        estimatedDeliveryMonth: preferences?.estimatedDeliveryMonth,
        hasProvidedShippingAddress: Boolean(preferences?.hasProvidedShippingAddress),
        shippingAddressLastCheckedDate: preferences?.shippingAddressLastCheckedDate,
        shippingAddressCheckNote: preferences?.shippingAddressCheckNote,
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

  const rows = createMemo<FulfilmentRow[]>(() =>
    allRows().filter((row) => {
      if (shippingAddressFilter() === 'provided') return row.hasProvidedShippingAddress
      if (shippingAddressFilter() === 'needed') return !row.hasProvidedShippingAddress
      if (shippingAddressFilter() === 'staleCheck') return isShippingCheckStale(row)
      return true
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
    const withAddress = allRows.filter((row) => row.hasProvidedShippingAddress).length
    const staleChecks = allRows.filter(isShippingCheckStale).length
    const knownMonths = groupedRows()
    const totalValue = allRows.reduce((sum, row) => sum + (row.price || 0), 0)

    return {
      total: allRows.length,
      withEstimate,
      withoutEstimate: allRows.length - withEstimate,
      withAddress,
      withoutAddress: allRows.length - withAddress,
      staleChecks,
      nextMonth: knownMonths[0]?.monthLabel || '—',
      totalValue,
    }
  })

  function FulfilmentShippingStatus(props: { row: FulfilmentRow }) {
    return (
      <div class="fulfilmentStatusStack">
        <span
          class="fulfilmentShippingBadge"
          classList={{
            fulfilmentShippingBadgeProvided: props.row.hasProvidedShippingAddress,
            fulfilmentShippingBadgeNeeded: !props.row.hasProvidedShippingAddress,
          }}
        >
          {props.row.hasProvidedShippingAddress ? 'Shipping provided' : 'Shipping not provided'}
        </span>
        <span
          class="fulfilmentCheckBadge"
          classList={{ fulfilmentCheckBadgeStale: isShippingCheckStale(props.row) }}
        >
          Checked: {formatDateKey(props.row.shippingAddressLastCheckedDate)}
        </span>
      </div>
    )
  }

  function FulfilmentShippingMeta(props: { row: FulfilmentRow }) {
    return (
      <>
        <FulfilmentShippingStatus row={props.row} />
        <Show when={props.row.shippingAddressCheckNote}>
          <div class="muted fulfilmentShippingNote">{props.row.shippingAddressCheckNote}</div>
        </Show>
      </>
    )
  }

  return (
    <div class="statsBlock fulfilmentView">
      <div class="statsTitleRow">
        <h3 class="statsTitle">Fulfilment</h3>
        <div class="muted">Games currently marked as awaiting shipping.</div>
      </div>

      <Show when={allRows().length > 0} fallback={<div class="muted">No games are currently awaiting shipping.</div>}>
        <div class="costToolbarGroup">
          <div class="muted">Shipping address</div>
          <div class="costTargetGroup" role="group" aria-label="Visible games by shipping address state">
            <For each={SHIPPING_ADDRESS_FILTER_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: shippingAddressFilter() === option.value }}
                  onClick={() => setShippingAddressFilter(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <Show when={rows().length > 0} fallback={<div class="muted">No awaiting-shipping games match this filter.</div>}>
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
            <div class="monthlySummaryLabel">Addresses provided</div>
            <div class="monthlySummaryValue mono">
              {totals().withAddress.toLocaleString()}/{totals().total.toLocaleString()}
            </div>
            <div class="monthlySummarySubtext">
              {totals().withoutAddress > 0
                ? `${totals().withoutAddress.toLocaleString()} still need a shipping address.`
                : 'Every visible shipment has a shipping address recorded.'}
            </div>
          </section>

          <section class="monthlySummaryCard">
            <div class="monthlySummaryLabel">Checks stale</div>
            <div class="monthlySummaryValue mono">{totals().staleChecks.toLocaleString()}</div>
            <div class="monthlySummarySubtext">Visible games not checked in the last 30 days.</div>
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
                <div class="gameOptionsCardHeader" classList={{ fulfilmentOverdue: group.rows.some(isOverdue) }}>
                  <h4>{group.monthLabel}</h4>
                  <div class="muted">{group.rows.length.toLocaleString()} game{group.rows.length === 1 ? '' : 's'}</div>
                </div>

                <div class="gameOptionsRows">
                  <For each={group.rows}>
                    {(row) => (
                      <div class="gameOptionRow" classList={{ fulfilmentOverdue: isOverdue(row) }}>
                        <div class="gameOptionCopy">
                          <button
                            class="linkButton fulfilmentGameLink"
                            classList={{ fulfilmentGameLinkOverdue: isOverdue(row) }}
                            type="button"
                            onClick={() => props.onOpenGame(row.gameId)}
                          >
                            {row.label}
                          </button>
                          <Show when={isOverdue(row)}>
                            <div class="fulfilmentOverdueLabel">Overdue</div>
                          </Show>
                          <FulfilmentShippingMeta row={row} />
                        </div>

                        <div class="fulfilmentRowAside">
                          <Show when={typeof row.price === 'number'}>
                            <div class="muted mono">{poundsFormatter.format(row.price || 0)}</div>
                          </Show>
                          <button class="linkButton" type="button" onClick={() => props.onOpenGameOptions(row.gameId)}>
                            Options
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
                        <button
                          class="linkButton fulfilmentGameLink"
                          type="button"
                          onClick={() => props.onOpenGame(row.gameId)}
                        >
                          {row.label}
                        </button>
                        <FulfilmentShippingMeta row={row} />
                      </div>

                      <div class="fulfilmentRowAside">
                        <Show when={typeof row.price === 'number'}>
                          <div class="muted mono">{poundsFormatter.format(row.price || 0)}</div>
                        </Show>
                        <button class="linkButton" type="button" onClick={() => props.onOpenGameOptions(row.gameId)}>
                          Options
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
      </Show>
    </div>
  )
}
