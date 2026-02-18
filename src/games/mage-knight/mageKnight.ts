import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { mageKnightContent } from './content'

export type MageKnightPlayerTags = {
  hero?: string
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

export function normalizeMageKnightHero(input: string): string | undefined {
  const token = stripDecorations(input)
  if (!token) return undefined
  return mageKnightContent.heroesById.get(normalizeId(token)) ?? token
}

export function isMageKnightHeroToken(input: string): boolean {
  const normalized = normalizeMageKnightHero(input)
  if (!normalized) return false
  return mageKnightContent.heroesById.has(normalizeId(normalized))
}

export function parseMageKnightPlayerColor(color: string): MageKnightPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const tagValues = tags.map(stripDecorations).filter(Boolean)

  const kvHero = getBgStatsValue(parsedKv, ['H', 'Hero', 'Character', 'C', 'Char'])
  const heroFromKv = kvHero ? normalizeMageKnightHero(kvHero) : undefined

  const heroFromTags = tagValues.find((tag) => isMageKnightHeroToken(tag))
  const hero = heroFromKv || (heroFromTags ? normalizeMageKnightHero(heroFromTags) : undefined)

  const extraTags = tagValues.filter((tag) => {
    if (!hero) return true
    return normalizeId(tag) !== normalizeId(hero)
  })

  return { hero, extraTags }
}
