export type BgStatsKeyValue = Record<string, string>

const SEGMENT_SPLIT_RE = /[／\/|]+/g
const KEY_VALUE_SPLIT_RE = /[:：]/

export function splitBgStatsSegments(input: string): string[] {
  const text = input.trim()
  if (!text) return []
  return text
    .split(SEGMENT_SPLIT_RE)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function parseBgStatsKeyValueSegments(input: string): BgStatsKeyValue {
  const parsed: BgStatsKeyValue = {}
  for (const segment of splitBgStatsSegments(input)) {
    const match = segment.match(KEY_VALUE_SPLIT_RE)
    if (!match || match.index == null || match.index === 0) continue
    const key = segment.slice(0, match.index).trim()
    const value = segment.slice(match.index + match[0].length).trim()
    if (!key || !value) continue
    parsed[key] = value
  }
  return parsed
}

export function getBgStatsValue(
  parsed: BgStatsKeyValue,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = parsed[key]
    if (value) return value
  }
  return undefined
}
