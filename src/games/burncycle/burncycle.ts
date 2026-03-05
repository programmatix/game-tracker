import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { burncycleContent } from './content'

export type BurncyclePlayerTags = {
  bot?: string
  corporation?: string
  captain?: string
  extraTags: string[]
}

function normalizeToken(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function resolveBot(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return burncycleContent.botsById.get(normalizeId(token)) ?? token
}

function resolveCorporation(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return burncycleContent.corporationsById.get(normalizeId(token)) ?? token
}

function resolveCaptain(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return burncycleContent.captainsById.get(normalizeId(token)) ?? token
}

function isKnownBotToken(value: string): boolean {
  return burncycleContent.botsById.has(normalizeId(value))
}

function isKnownCorporationToken(value: string): boolean {
  return burncycleContent.corporationsById.has(normalizeId(value))
}

function isKnownCaptainToken(value: string): boolean {
  return burncycleContent.captainsById.has(normalizeId(value))
}

export function parseBurncyclePlayerColor(color: string): BurncyclePlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const botKv = getBgStatsValue(parsedKv, ['B', 'Bot', 'A', 'Agent'])
  const corporationKv = getBgStatsValue(parsedKv, ['C', 'Corp', 'Corporation'])
  const captainKv = getBgStatsValue(parsedKv, ['CP', 'Cap', 'Captain'])

  let bot = botKv ? resolveBot(botKv) : undefined
  let corporation = corporationKv ? resolveCorporation(corporationKv) : undefined
  let captain = captainKv ? resolveCaptain(captainKv) : undefined

  const used = new Set<string>()

  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (!captain && /^c[a-z0-9]/i.test(normalized)) {
      const compactCaptain = normalized.slice(1)
      if (compactCaptain && isKnownCaptainToken(compactCaptain)) {
        captain = resolveCaptain(compactCaptain)
        used.add(normalized)
        continue
      }
    }

    if (!corporation && isKnownCorporationToken(normalized)) {
      corporation = resolveCorporation(normalized)
      used.add(normalized)
      continue
    }

    if (!bot && isKnownBotToken(normalized)) {
      bot = resolveBot(normalized)
      used.add(normalized)
      continue
    }

    if (!captain && isKnownCaptainToken(normalized)) {
      captain = resolveCaptain(normalized)
      used.add(normalized)
      continue
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { bot, corporation, captain, extraTags }
}
