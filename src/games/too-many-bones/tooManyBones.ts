import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { tooManyBonesContent } from './content'

export type TooManyBonesPlayerTags = {
  gearloc?: string
  tyrant?: string
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

function stripDecorations(input: string): string {
  let value = normalizeToken(input)
  value = value.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  return normalizeToken(value)
}

export function normalizeTooManyBonesGearloc(input: string): string | undefined {
  const token = stripDecorations(input)
  if (!token) return undefined
  return tooManyBonesContent.gearlocsById.get(normalizeId(token)) ?? token
}

export function normalizeTooManyBonesTyrant(input: string): string | undefined {
  const token = stripDecorations(input)
  if (!token) return undefined
  return tooManyBonesContent.tyrantsById.get(normalizeId(token)) ?? token
}

export function isTooManyBonesGearlocToken(input: string): boolean {
  const normalized = normalizeTooManyBonesGearloc(input)
  if (!normalized) return false
  return tooManyBonesContent.gearlocsById.has(normalizeId(normalized))
}

export function isTooManyBonesTyrantToken(input: string): boolean {
  const normalized = normalizeTooManyBonesTyrant(input)
  if (!normalized) return false
  return tooManyBonesContent.tyrantsById.has(normalizeId(normalized))
}

export function parseTooManyBonesPlayerColor(color: string): TooManyBonesPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const tagValues = tags.map(stripDecorations).filter(Boolean)

  const kvGearloc = getBgStatsValue(parsedKv, ['G', 'Gearloc', 'H', 'Hero', 'C', 'Char', 'Character'])
  const kvTyrant = getBgStatsValue(parsedKv, ['T', 'Tyrant', 'Boss'])

  const tagGearloc = tagValues.find((tag) => isTooManyBonesGearlocToken(tag))
  const tagTyrant = tagValues.find((tag) => isTooManyBonesTyrantToken(tag))

  const gearlocCandidate = kvGearloc ? stripDecorations(kvGearloc) : tagGearloc
  const tyrantCandidate = kvTyrant ? stripDecorations(kvTyrant) : tagTyrant

  const gearloc = gearlocCandidate ? normalizeTooManyBonesGearloc(gearlocCandidate) : undefined
  const tyrant = tyrantCandidate ? normalizeTooManyBonesTyrant(tyrantCandidate) : undefined

  const extraTags = tagValues.filter((tag) => {
    if (gearlocCandidate && normalizeId(tag) === normalizeId(gearlocCandidate)) return false
    if (tyrantCandidate && normalizeId(tag) === normalizeId(tyrantCandidate)) return false
    return true
  })

  return { gearloc, tyrant, extraTags }
}

