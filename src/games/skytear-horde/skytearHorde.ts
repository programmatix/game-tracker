import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { skytearHordeContent } from './content'

export type SkytearHordePlayerTags = {
  heroPrecon?: string
  enemyPrecon?: string
  enemyLevel?: number
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

function resolveHeroPrecon(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return skytearHordeContent.heroPreconsById.get(normalizeId(token)) ?? token
}

function resolveEnemyPrecon(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return skytearHordeContent.enemyPreconsById.get(normalizeId(token)) ?? token
}

function parseEnemyLevelToken(value: string): number | undefined {
  const trimmed = normalizeToken(value)
  if (!trimmed) return undefined
  const match = trimmed.match(/^(?:l|lvl|level)\s*([0-9]+)$/i)
  if (!match?.[1]) return undefined
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function splitEnemyTokenAndLevel(value: string): { token: string; level?: number } {
  const trimmed = normalizeToken(value)
  if (!trimmed) return { token: '' }

  // Common formats: "Sinklings L2", "Sinklings lvl 2", "Sinklings Level 2"
  const suffix = trimmed.match(/^(.*?)(?:\s+(?:l|lvl|level)\s*([0-9]+))$/i)
  if (suffix?.[1] && suffix[2]) {
    const parsed = Number(suffix[2])
    const level = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
    return { token: normalizeToken(suffix[1]), level }
  }

  return { token: trimmed }
}

export function parseSkytearHordePlayerColor(color: string): SkytearHordePlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const heroKv = getBgStatsValue(parsedKv, [
    'H',
    'Hero',
    'HeroPrecon',
    'HP',
    'Sanctuary',
    'Castle',
  ])
  const enemyKv = getBgStatsValue(parsedKv, ['E', 'Enemy', 'EnemyPrecon', 'EP', 'Horde', 'HordeSet'])

  let heroPrecon = heroKv ? resolveHeroPrecon(heroKv) : undefined
  let enemyPrecon: string | undefined
  let enemyLevel: number | undefined
  if (enemyKv) {
    const split = splitEnemyTokenAndLevel(enemyKv)
    enemyPrecon = split.token ? resolveEnemyPrecon(split.token) : undefined
    enemyLevel = split.level
  }

  const used = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (!enemyLevel) {
      const parsedLevel = parseEnemyLevelToken(normalized)
      if (parsedLevel) {
        enemyLevel = parsedLevel
        used.add(normalized)
        continue
      }
    }

    if (!heroPrecon) {
      const resolvedHero = resolveHeroPrecon(normalized)
      if (resolvedHero && skytearHordeContent.heroPreconsById.has(normalizeId(normalized))) {
        heroPrecon = resolvedHero
        used.add(normalized)
        continue
      }
    }

    if (!enemyPrecon) {
      const split = splitEnemyTokenAndLevel(normalized)
      const resolvedEnemy = split.token ? resolveEnemyPrecon(split.token) : undefined
      if (split.level && !enemyLevel) enemyLevel = split.level

      if (
        resolvedEnemy &&
        split.token &&
        skytearHordeContent.enemyPreconsById.has(normalizeId(split.token))
      ) {
        enemyPrecon = resolvedEnemy
        used.add(normalized)
        continue
      }
    }
  }

  if (!heroPrecon && tags[0]) heroPrecon = resolveHeroPrecon(tags[0])
  if (!enemyPrecon && tags[1]) {
    const split = splitEnemyTokenAndLevel(tags[1])
    enemyPrecon = split.token ? resolveEnemyPrecon(split.token) : undefined
    if (split.level && !enemyLevel) enemyLevel = split.level
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { heroPrecon, enemyPrecon, enemyLevel, extraTags }
}

