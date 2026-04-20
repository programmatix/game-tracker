import {
  DEFAULT_COST_PER_HOUR_TARGET,
  isCostPerHourTarget,
  type CostPerHourTarget,
} from './costTargets'

export type SaleMode = 'none' | 'sellTwoThirds' | 'sellThreeQuarters'

export const SALE_MODE_OPTIONS: ReadonlyArray<{
  value: SaleMode
  label: string
  resaleRatio: number
}> = [
  { value: 'none', label: 'No sale', resaleRatio: 0 },
  { value: 'sellTwoThirds', label: 'Sell at 2/3', resaleRatio: 2 / 3 },
  { value: 'sellThreeQuarters', label: 'Sell at 3/4', resaleRatio: 3 / 4 },
]

export const COSTS_TARGET_STORAGE_KEY = 'costs.targetCostPerHour'
export const COSTS_SALE_MODE_STORAGE_KEY = 'costs.saleMode'

export function isSaleMode(value: string): value is SaleMode {
  return SALE_MODE_OPTIONS.some((option) => option.value === value)
}

export function readStoredTarget(): CostPerHourTarget {
  if (typeof window === 'undefined') return DEFAULT_COST_PER_HOUR_TARGET
  try {
    const parsed = Number(window.localStorage.getItem(COSTS_TARGET_STORAGE_KEY) || '')
    return isCostPerHourTarget(parsed) ? parsed : DEFAULT_COST_PER_HOUR_TARGET
  } catch {
    return DEFAULT_COST_PER_HOUR_TARGET
  }
}

export function readStoredSaleMode(): SaleMode {
  if (typeof window === 'undefined') return 'none'
  try {
    const stored = window.localStorage.getItem(COSTS_SALE_MODE_STORAGE_KEY) || ''
    return isSaleMode(stored) ? stored : 'none'
  } catch {
    return 'none'
  }
}

export function resaleRatioForMode(mode: SaleMode): number {
  return SALE_MODE_OPTIONS.find((option) => option.value === mode)?.resaleRatio ?? 0
}

export function resaleValueForCost(totalCost: number, saleMode: SaleMode): number {
  return Math.max(0, totalCost) * resaleRatioForMode(saleMode)
}

export function effectiveCostForSaleMode(totalCost: number, saleMode: SaleMode): number {
  return Math.max(0, totalCost - resaleValueForCost(totalCost, saleMode))
}

export function hoursNeededForTarget(totalCost: number, targetCostPerHour: number): number | undefined {
  if (targetCostPerHour <= 0) return undefined
  return Math.max(0, totalCost) / targetCostPerHour
}

export function progressToTarget(
  totalCost: number,
  hours: number,
  targetCostPerHour: number,
): number | undefined {
  const targetHours = hoursNeededForTarget(totalCost, targetCostPerHour)
  if (targetHours == null) return undefined
  if (targetHours <= 0) return 1
  return Math.min(1, Math.max(0, hours) / targetHours)
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function formatDurationHoursMinutes(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0m'

  const totalMinutes = Math.round(hours * 60)
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (wholeHours <= 0) return `${minutes}m`
  if (minutes <= 0) return `${wholeHours}h`
  return `${wholeHours}h${String(minutes).padStart(2, '0')}m`
}

export function formatRoundedDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  return `${Math.round(hours)}h`
}

export function formatMoney(value: number, currencySymbol: string): string {
  return `${currencySymbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}%`
}

export function formatTargetValue(value: number, currencySymbol: string): string {
  return `${currencySymbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}
