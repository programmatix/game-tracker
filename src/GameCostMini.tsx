import { For, createEffect, createMemo, createSignal } from 'solid-js'
import type { BggPlay } from './bgg'
import { findConfigurableGameIdForOptions } from './configurableGameMatching'
import { costRegistry } from './costRegistry'
import {
  COSTS_SALE_MODE_STORAGE_KEY,
  SALE_MODE_OPTIONS,
  clamp01,
  effectiveCostForSaleMode,
  formatMoney,
  formatPercent,
  formatRoundedDuration,
  formatTargetValue,
  hoursNeededForTarget,
  progressToTarget,
  readStoredSaleMode,
  readStoredTarget,
  resaleValueForCost,
  type SaleMode,
} from './costsShared'
import { totalPlayMinutesWithAssumption } from './playDuration'
import { playQuantity } from './playsHelpers'

export default function GameCostMini(props: {
  gameId: string
  plays: BggPlay[]
  assumedMinutesByObjectId: ReadonlyMap<string, number>
}) {
  const [saleMode, setSaleMode] = createSignal<SaleMode>(readStoredSaleMode())
  const targetCostPerHour = createMemo(() => readStoredTarget())

  createEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(COSTS_SALE_MODE_STORAGE_KEY, saleMode())
    } catch {
      return
    }
  })

  const summary = createMemo(() => {
    const costEntry = costRegistry.find((entry) => entry.id === props.gameId)
    if (!costEntry) return null

    const matchedPlays = props.plays.filter(
      (play) =>
        findConfigurableGameIdForOptions({
          name: play.item?.attributes.name || null,
          objectId: play.item?.attributes.objectid || null,
        }) === props.gameId,
    )

    let plays = 0
    let hours = 0
    let hasAssumedHours = false

    for (const play of matchedPlays) {
      const quantity = playQuantity(play)
      const assumedMinutesPerPlay = play.item?.attributes.objectid
        ? props.assumedMinutesByObjectId.get(play.item.attributes.objectid)
        : undefined
      const resolved = totalPlayMinutesWithAssumption({
        attributes: play.attributes,
        quantity,
        assumedMinutesPerPlay,
      })
      plays += quantity
      hours += resolved.minutes / 60
      hasAssumedHours ||= resolved.assumed
    }

    const totalCost = [...costEntry.costs.boxCostsByName.values()].reduce((sum, cost) => sum + cost, 0)
    const effectiveCost = effectiveCostForSaleMode(totalCost, saleMode())
    const estimatedSellPrice = resaleValueForCost(totalCost, saleMode())
    const targetHours = hoursNeededForTarget(effectiveCost, targetCostPerHour()) ?? 0
    const progress = clamp01(progressToTarget(effectiveCost, hours, targetCostPerHour()) ?? 0)
    const remainingHours = Math.max(0, targetHours - hours)

    return {
      label: costEntry.label,
      currencySymbol: costEntry.costs.currencySymbol,
      plays,
      hours,
      hasAssumedHours,
      effectiveCost,
      estimatedSellPrice,
      targetHours,
      progress,
      remainingHours,
    }
  })

  const selectedSaleOption = createMemo(
    () => SALE_MODE_OPTIONS.find((option) => option.value === saleMode()) || SALE_MODE_OPTIONS[0],
  )

  return (
    <section class="statsBlock">
      <div class="statsTitleRow">
        <h3 class="statsTitle">Cost progress</h3>
        <div class="muted mono">{selectedSaleOption().label}</div>
      </div>

      <div class="monthlySummaryGrid gameCostMiniGrid">
        <section class="monthlySummaryCard costsSummaryCardChart gameCostMiniProgressCard">
          <div class="monthlySummaryLabel">
            Progress to {formatTargetValue(targetCostPerHour(), summary()?.currencySymbol || '£')}/h
          </div>
          <div
            class="monthlyProgressRing costSummaryRing"
            style={{ '--progress': `${(summary()?.progress || 0) * 100}%` }}
            aria-label={`${summary()?.label || 'Game'} progress: ${formatPercent(summary()?.progress || 0)}`}
          >
            <div class="monthlyProgressInner">
              <span class="monthlyProgressValue mono">{formatPercent(summary()?.progress || 0)}</span>
            </div>
          </div>
          <div class="monthlySummarySubtext">
            <span class="mono">{formatRoundedDuration(summary()?.hours || 0)}</span>
            {summary()?.hasAssumedHours ? '*' : ''}
            {' '}logged of{' '}
            <span class="mono">{formatRoundedDuration(summary()?.targetHours || 0)}</span>
          </div>
          <div class="monthlySummarySubtext">
            <span class="mono">{summary()?.plays.toLocaleString() || '0'}</span> tracked play
            {summary()?.plays === 1 ? '' : 's'}
            {' • '}
            <span class="mono">{formatRoundedDuration(summary()?.remainingHours || 0)}</span> left
          </div>
        </section>

        <section class="monthlySummaryCard gameCostMiniControls">
          <div class="monthlySummaryLabel">Sale assumption</div>
          <div class="costTargetGroup" role="group" aria-label="Sale assumption">
            <For each={SALE_MODE_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  class="tabButton"
                  classList={{ tabButtonActive: saleMode() === option.value }}
                  onClick={() => setSaleMode(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>
          <div class="monthlySummarySubtext">
            Effective cost:{' '}
            <span class="mono">
              {formatMoney(summary()?.effectiveCost || 0, summary()?.currencySymbol || '£')}
            </span>
          </div>
          <div class="monthlySummarySubtext">
            Estimated sell price:{' '}
            <span class="mono">
              {formatMoney(summary()?.estimatedSellPrice || 0, summary()?.currencySymbol || '£')}
            </span>
          </div>
        </section>
      </div>
    </section>
  )
}
