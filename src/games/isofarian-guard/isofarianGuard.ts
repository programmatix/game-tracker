import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { isofarianGuardContent } from './content'

export type IsofarianGuardPlayerTags = {
  campaign?: string
  chapter?: string
  guards: string[]
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

function resolveCampaign(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return isofarianGuardContent.campaignsById.get(normalizeId(token))
}

function resolveChapter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return isofarianGuardContent.chaptersById.get(normalizeId(token))
}

function resolveGuard(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return isofarianGuardContent.guardsById.get(normalizeId(token))
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

function addGuardTokens(target: string[], value: string) {
  for (const part of value.split(/[,+/&]/g)) {
    const resolved = resolveGuard(part)
    if (resolved) target.push(resolved)
  }
}

export function parseIsofarianGuardPlayerColor(color: string): IsofarianGuardPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  let campaign = resolveCampaign(getBgStatsValue(parsedKv, ['C', 'Camp', 'Campaign']) || '')
  let chapter = resolveChapter(getBgStatsValue(parsedKv, ['Ch', 'Chapter', 'Story']) || '')
  const guards: string[] = []
  let continuePrevious = false
  let continueNext = false

  const guardKv = getBgStatsValue(parsedKv, ['G', 'Guard', 'Guards', 'Char', 'Character', 'Party'])
  if (guardKv) addGuardTokens(guards, guardKv)

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

    if (!chapter) {
      const resolvedChapter = resolveChapter(normalized)
      if (resolvedChapter) {
        chapter = resolvedChapter
        continue
      }
    }

    if (!campaign) {
      const resolvedCampaign = resolveCampaign(normalized)
      if (resolvedCampaign) {
        campaign = resolvedCampaign
        continue
      }
    }

    const resolvedGuard = resolveGuard(normalized)
    if (resolvedGuard) {
      guards.push(resolvedGuard)
      continue
    }

    extraTags.push(normalized)
  }

  if (!campaign && chapter) {
    campaign = isofarianGuardContent.chapterCampaignByName.get(chapter)
  }

  return {
    campaign,
    chapter,
    guards: [...new Set(guards)],
    continuePrevious,
    continueNext,
    extraTags,
  }
}
