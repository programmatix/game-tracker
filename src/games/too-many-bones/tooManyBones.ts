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
  const tagCandidates = tagValues.map((tag, index) => {
    const id = normalizeId(tag)
    return {
      index,
      tag,
      id,
      isGearloc: tooManyBonesContent.gearlocsById.has(id),
      isTyrant: tooManyBonesContent.tyrantsById.has(id),
    }
  })

  const kvGearloc = getBgStatsValue(parsedKv, ['G', 'Gearloc', 'H', 'Hero', 'C', 'Char', 'Character'])
  const kvTyrant = getBgStatsValue(parsedKv, ['T', 'Tyrant', 'Boss'])

  const usedTagIndexes = new Set<number>()

  const scoreRoleMatch = (
    candidate: { isGearloc: boolean; isTyrant: boolean },
    role: 'gearloc' | 'tyrant',
  ): number => {
    if (role === 'gearloc') {
      if (!candidate.isGearloc) return 0
      return candidate.isTyrant ? 1 : 2
    }
    if (!candidate.isTyrant) return 0
    return candidate.isGearloc ? 1 : 2
  }

  const pickBestTagForRole = (
    role: 'gearloc' | 'tyrant',
    exclude: ReadonlySet<number>,
  ): string | undefined => {
    let best:
      | {
          index: number
          tag: string
          score: number
        }
      | undefined

    for (const candidate of tagCandidates) {
      if (exclude.has(candidate.index)) continue
      const score = scoreRoleMatch(candidate, role)
      if (score === 0) continue

      if (!best || score > best.score || (score === best.score && candidate.index < best.index)) {
        best = { index: candidate.index, tag: candidate.tag, score }
      }
    }

    if (best) {
      usedTagIndexes.add(best.index)
      return best.tag
    }
    return undefined
  }

  let gearlocCandidate = kvGearloc ? stripDecorations(kvGearloc) : undefined
  let tyrantCandidate = kvTyrant ? stripDecorations(kvTyrant) : undefined

  if (!gearlocCandidate && !tyrantCandidate) {
    let bestPair:
      | {
          gearlocIndex: number
          tyrantIndex: number
          gearlocTag: string
          tyrantTag: string
          score: number
        }
      | undefined

    for (const gearloc of tagCandidates) {
      if (!gearloc.isGearloc) continue
      const gearlocScore = scoreRoleMatch(gearloc, 'gearloc')
      if (gearlocScore === 0) continue
      for (const tyrant of tagCandidates) {
        if (tyrant.index === gearloc.index || !tyrant.isTyrant) continue
        const tyrantScore = scoreRoleMatch(tyrant, 'tyrant')
        if (tyrantScore === 0) continue

        const score = gearlocScore + tyrantScore
        if (
          !bestPair ||
          score > bestPair.score ||
          (score === bestPair.score &&
            (gearloc.index < bestPair.gearlocIndex ||
              (gearloc.index === bestPair.gearlocIndex && tyrant.index < bestPair.tyrantIndex)))
        ) {
          bestPair = {
            gearlocIndex: gearloc.index,
            tyrantIndex: tyrant.index,
            gearlocTag: gearloc.tag,
            tyrantTag: tyrant.tag,
            score,
          }
        }
      }
    }

    if (bestPair) {
      gearlocCandidate = bestPair.gearlocTag
      tyrantCandidate = bestPair.tyrantTag
      usedTagIndexes.add(bestPair.gearlocIndex)
      usedTagIndexes.add(bestPair.tyrantIndex)
    }
  }

  if (!tyrantCandidate) tyrantCandidate = pickBestTagForRole('tyrant', usedTagIndexes)
  if (!gearlocCandidate) gearlocCandidate = pickBestTagForRole('gearloc', usedTagIndexes)

  const gearloc = gearlocCandidate ? normalizeTooManyBonesGearloc(gearlocCandidate) : undefined
  const tyrant = tyrantCandidate ? normalizeTooManyBonesTyrant(tyrantCandidate) : undefined

  const extraTags = tagValues.filter((_, index) => !usedTagIndexes.has(index))

  return { gearloc, tyrant, extraTags }
}
