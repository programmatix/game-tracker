export function isMonthKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) return false
  const month = Number(match[2])
  return Number.isInteger(month) && month >= 1 && month <= 12
}

export function monthKeyFromDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value.slice(0, 7)
}

export function monthIndexFromKey(monthKey: string): number | null {
  if (!isMonthKey(monthKey)) return null
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null
  return year * 12 + (month - 1)
}

export function formatMonthKey(monthKey: string, monthFormat: 'long' | 'short' = 'long'): string {
  const index = monthIndexFromKey(monthKey)
  if (index === null) return monthKey

  const year = Math.floor(index / 12)
  const month = index % 12
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: monthFormat,
    year: 'numeric',
  })
}
