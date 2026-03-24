import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { elderScrollsContent } from './content'

export type ElderScrollsPlayerTags = {
  province?: string
  race?: string
  heroClass?: string
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

function resolveProvince(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return elderScrollsContent.provincesById.get(normalizeId(token))
}

function resolveRace(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return elderScrollsContent.racesById.get(normalizeId(token))
}

function resolveClass(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return elderScrollsContent.classesById.get(normalizeId(token))
}

export function parseElderScrollsPlayerColor(color: string): ElderScrollsPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const provinceKv = getBgStatsValue(parsedKv, ['P', 'Province', 'Map'])
  const raceKv = getBgStatsValue(parsedKv, ['R', 'Race'])
  const classKv = getBgStatsValue(parsedKv, ['C', 'Class'])

  let province = provinceKv ? resolveProvince(provinceKv) : undefined
  let race = raceKv ? resolveRace(raceKv) : undefined
  let heroClass = classKv ? resolveClass(classKv) : undefined

  const extraTags: string[] = []

  for (const tag of tags) {
    if (!province) {
      const resolved = resolveProvince(tag)
      if (resolved) {
        province = resolved
        continue
      }
    }

    if (!heroClass) {
      const resolved = resolveClass(tag)
      if (resolved) {
        heroClass = resolved
        continue
      }
    }

    if (!race) {
      const resolved = resolveRace(tag)
      if (resolved) {
        race = resolved
        continue
      }
    }

    const normalized = normalizeToken(tag)
    if (normalized) extraTags.push(normalized)
  }

  return { province, race, heroClass, extraTags }
}
