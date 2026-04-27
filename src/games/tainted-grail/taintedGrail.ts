import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { taintedGrailContent } from './content'

export type TaintedGrailPlayerTags = {
  campaign?: string
  chapter?: string
  continuePrevious: boolean
  continueNext: boolean
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

function resolveCampaign(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return taintedGrailContent.campaignsById.get(normalizeId(token))
}

function resolveChapter(value: string, campaign?: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  const normalized = normalizeId(token)
  if (campaign) {
    const campaignLookup = taintedGrailContent.chapterLookupByCampaignName.get(campaign)
    const resolved = campaignLookup?.get(normalized)
    if (resolved) return resolved
  }
  return taintedGrailContent.chaptersById.get(normalized) ?? token
}

function isKnownChapterToken(value: string, campaign?: string): boolean {
  const normalized = normalizeId(value)
  if (campaign) {
    const campaignLookup = taintedGrailContent.chapterLookupByCampaignName.get(campaign)
    if (campaignLookup?.has(normalized)) return true
  }
  return taintedGrailContent.chaptersById.has(normalized)
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious' || normalized === 'continue'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

export function parseTaintedGrailPlayerColor(color: string): TaintedGrailPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const campaignKv = getBgStatsValue(parsedKv, ['P', 'Camp', 'Campaign', 'Story'])
  let campaign = campaignKv ? resolveCampaign(campaignKv) : undefined
  const chapterKv = getBgStatsValue(parsedKv, ['C', 'Ch', 'Chap', 'Chapter'])
  let chapter = chapterKv ? resolveChapter(chapterKv, campaign) : undefined
  let continuePrevious = false
  let continueNext = false

  const used = new Set<string>()
  if (!campaign) {
    for (const tag of tags) {
      const normalized = normalizeToken(tag)
      if (!normalized) continue
      const resolvedCampaign = resolveCampaign(normalized)
      if (!resolvedCampaign) continue
      campaign = resolvedCampaign
      if (chapterKv && !chapter) chapter = resolveChapter(chapterKv, campaign)
      break
    }
  }
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
    if (!campaign) {
      const resolvedCampaign = resolveCampaign(normalized)
      if (resolvedCampaign) {
        campaign = resolvedCampaign
        if (chapterKv && !chapter) chapter = resolveChapter(chapterKv, campaign)
        used.add(normalized)
        continue
      }
    }
    if (!chapter && isKnownChapterToken(normalized, campaign)) {
      chapter = resolveChapter(normalized, campaign)
      used.add(normalized)
      break
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { campaign, chapter, continuePrevious, continueNext, extraTags }
}
