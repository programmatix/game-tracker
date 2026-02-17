import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { skytearHordeContent } from './content'

export type SkytearHordePlayerTags = {
  heroPrecon?: string
  enemyPrecon?: string
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
  let enemyPrecon = enemyKv ? resolveEnemyPrecon(enemyKv) : undefined

  const used = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (!heroPrecon) {
      const resolvedHero = resolveHeroPrecon(normalized)
      if (resolvedHero && skytearHordeContent.heroPreconsById.has(normalizeId(normalized))) {
        heroPrecon = resolvedHero
        used.add(normalized)
        continue
      }
    }

    if (!enemyPrecon) {
      const resolvedEnemy = resolveEnemyPrecon(normalized)
      if (resolvedEnemy && skytearHordeContent.enemyPreconsById.has(normalizeId(normalized))) {
        enemyPrecon = resolvedEnemy
        used.add(normalized)
        continue
      }
    }
  }

  if (!heroPrecon && tags[0]) heroPrecon = resolveHeroPrecon(tags[0])
  if (!enemyPrecon && tags[1]) enemyPrecon = resolveEnemyPrecon(tags[1])

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { heroPrecon, enemyPrecon, extraTags }
}

