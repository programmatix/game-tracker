export const COST_PER_HOUR_TARGET_OPTIONS = [1, 2, 5, 10] as const

export type CostPerHourTarget = (typeof COST_PER_HOUR_TARGET_OPTIONS)[number]

export const DEFAULT_COST_PER_HOUR_TARGET: CostPerHourTarget = 1

export function isCostPerHourTarget(value: number): value is CostPerHourTarget {
  return COST_PER_HOUR_TARGET_OPTIONS.includes(value as CostPerHourTarget)
}
