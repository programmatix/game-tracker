import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { taintedGrailContent } from './content'

export type TaintedGrailPlayerTags = {
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

function resolveChapter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return taintedGrailContent.chaptersById.get(normalizeId(token)) ?? token
}

function isKnownChapterToken(value: string): boolean {
  return taintedGrailContent.chaptersById.has(normalizeId(value))
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

  const chapterKv = getBgStatsValue(parsedKv, ['C', 'Ch', 'Chap', 'Chapter'])
  let chapter = chapterKv ? resolveChapter(chapterKv) : undefined
  let continuePrevious = false
  let continueNext = false

  const used = new Set<string>()
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
    if (!chapter && isKnownChapterToken(normalized)) {
      chapter = resolveChapter(normalized)
      used.add(normalized)
      break
    }
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { chapter, continuePrevious, continueNext, extraTags }
}
