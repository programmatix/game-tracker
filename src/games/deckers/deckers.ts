import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { deckersContent } from './content'

export type DeckersPlayerTags = {
  smc?: string
  deckers: string[]
  extraTags: string[]
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function cleanSmcToken(value: string): string {
  return normalizeToken(value).replace(/\s*\([^)]*\)\s*$/, '')
}

function resolveDecker(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return deckersContent.deckersById.get(normalizeId(token))
}

function resolveSmc(value: string): string | undefined {
  const token = cleanSmcToken(value)
  if (!token) return undefined
  return deckersContent.smcsById.get(normalizeId(token))
}

export function parseDeckersPlayerColor(color: string): DeckersPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const rawSegments = splitBgStatsSegments(color)
  const freeformSegments = rawSegments.filter((segment) => !/[:：]/.test(segment))

  const deckers: string[] = []
  const extraTags: string[] = []
  let smc = getBgStatsValue(parsedKv, ['SMC', 'Smc', 'Enemy', 'Boss', 'AI'])
  smc = smc ? resolveSmc(smc) ?? cleanSmcToken(smc) : undefined

  const deckerKv = getBgStatsValue(parsedKv, ['D', 'Decker', 'Decker1', 'Deckers'])
  if (deckerKv) {
    for (const token of deckerKv.split(/[,+&]/g)) {
      const resolved = resolveDecker(token)
      if (resolved) deckers.push(resolved)
      else extraTags.push(normalizeToken(token))
    }
  }

  for (const rawSegment of freeformSegments) {
    const segment = normalizeToken(rawSegment)
    if (!segment) continue

    const resolvedDecker = resolveDecker(segment)
    if (resolvedDecker) {
      deckers.push(resolvedDecker)
      continue
    }

    const resolvedSmc = resolveSmc(segment)
    if (!smc && resolvedSmc) {
      smc = resolvedSmc
      continue
    }

    extraTags.push(segment)
  }

  return {
    smc,
    deckers: [...new Set(deckers)],
    extraTags,
  }
}
