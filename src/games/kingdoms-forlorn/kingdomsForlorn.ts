import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { kingdomsForlornContent } from './content'

export type KingdomsForlornPlayerTags = {
  kingdom?: string
  knight?: string
  continuePrevious: boolean
  continueNext: boolean
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

function resolveKingdom(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return kingdomsForlornContent.kingdomsById.get(normalizeId(token))
}

function resolveKnight(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return kingdomsForlornContent.knightsById.get(normalizeId(token))
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

export function parseKingdomsForlornPlayerColor(color: string): KingdomsForlornPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  let kingdom = resolveKingdom(
    getBgStatsValue(parsedKv, ['Kg', 'Kingdom', 'Kdm', 'Region', 'Map']) || '',
  )
  let knight = resolveKnight(
    getBgStatsValue(parsedKv, ['K', 'Knight', 'Char', 'Character', 'Hero', 'Player']) || '',
  )
  let continuePrevious = false
  let continueNext = false
  const extraTags: string[] = []

  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (isContinuePreviousToken(normalized)) {
      continuePrevious = true
      continue
    }
    if (isContinueNextToken(normalized)) {
      continueNext = true
      continue
    }

    const kingdomFromTag = resolveKingdom(normalized)
    if (!kingdom && kingdomFromTag) {
      kingdom = kingdomFromTag
      continue
    }

    const knightFromTag = resolveKnight(normalized)
    if (!knight && knightFromTag) {
      knight = knightFromTag
      continue
    }

    extraTags.push(normalized)
  }

  return {
    kingdom,
    knight,
    continuePrevious,
    continueNext,
    extraTags,
  }
}
