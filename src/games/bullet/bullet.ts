import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { bulletContent } from './content'

export type BulletPlayerTags = {
  heroine?: string
  boss?: string
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
  let value = input.trim()

  value = value
    .replace(/\s*[\u2665\u2661\u2605\u2606\u2B50\u2764\uFE0F]+\s*$/u, '')
    .replace(/\s*[\u2665\u2661\u2605\u2606\u2B50\u2764\uFE0F]+\s*/gu, ' ')
    .trim()

  value = value.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  return normalizeToken(value)
}

export function normalizeBulletHeroine(input: string): string | undefined {
  const token = stripDecorations(input)
  if (!token) return undefined

  const byId = bulletContent.heroinesById.get(normalizeId(token))
  if (byId) return byId

  return token
}

export function normalizeBulletBoss(input: string): string | undefined {
  const token = stripDecorations(input)
  if (!token) return undefined

  const byId = bulletContent.bossesById.get(normalizeId(token))
  if (byId) return byId

  return token
}

export function isBulletHeroineToken(input: string): boolean {
  const normalized = normalizeBulletHeroine(input)
  if (!normalized) return false
  return bulletContent.heroinesById.has(normalizeId(normalized))
}

export function isBulletBossToken(input: string): boolean {
  const normalized = normalizeBulletBoss(input)
  if (!normalized) return false
  return bulletContent.bossesById.has(normalizeId(normalized))
}

export function parseBulletPlayerColor(color: string): BulletPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const tagValues = tags.map(stripDecorations).filter(Boolean)

  const kvHeroine = getBgStatsValue(parsedKv, ['H', 'Heroine', 'C', 'Char', 'Character'])
  const kvBoss = getBgStatsValue(parsedKv, ['B', 'Boss'])

  const tagHeroine = tagValues.find((tag) => isBulletHeroineToken(tag))
  const tagBoss = tagValues.find((tag) => isBulletBossToken(tag))

  const heroineCandidate = kvHeroine ? stripDecorations(kvHeroine) : tagHeroine
  const bossCandidate = kvBoss ? stripDecorations(kvBoss) : tagBoss

  const heroine = heroineCandidate ? normalizeBulletHeroine(heroineCandidate) : undefined
  const boss = bossCandidate ? normalizeBulletBoss(bossCandidate) : undefined

  const extraTags = tagValues.filter((tag) => {
    if (heroineCandidate && normalizeId(tag) === normalizeId(heroineCandidate)) return false
    if (bossCandidate && normalizeId(tag) === normalizeId(bossCandidate)) return false
    return true
  })

  return { heroine, boss, extraTags }
}
