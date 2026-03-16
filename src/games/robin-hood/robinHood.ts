import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { robinHoodContent } from './content'

export type RobinHoodPlayerTags = {
  adventure?: string
  characters: string[]
  continuePrevious: boolean
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

function resolveAdventure(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return robinHoodContent.adventuresById.get(normalizeId(token))
}

function resolveCharacter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return robinHoodContent.charactersById.get(normalizeId(token))
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious' || normalized === 'continue'
}

export function parseRobinHoodPlayerColor(color: string): RobinHoodPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const adventureKv = getBgStatsValue(parsedKv, ['A', 'Adv', 'Adventure', 'C', 'Chapter', 'S', 'Scenario'])
  const characterKv = getBgStatsValue(parsedKv, ['H', 'Hero', 'Character', 'Char', 'P', 'Player'])

  const extraTags: string[] = []
  const characters: string[] = []
  let adventure = adventureKv ? resolveAdventure(adventureKv) : undefined
  let continuePrevious = false

  if (characterKv) {
    for (const part of characterKv.split(/[,+&]/g)) {
      const character = resolveCharacter(part)
      if (character) characters.push(character)
    }
  }

  for (const tag of tags) {
    if (isContinuePreviousToken(tag)) {
      continuePrevious = true
      continue
    }

    const adventureFromTag = resolveAdventure(tag)
    if (!adventure && adventureFromTag) {
      adventure = adventureFromTag
      continue
    }

    const character = resolveCharacter(tag)
    if (character) {
      characters.push(character)
      continue
    }

    extraTags.push(normalizeToken(tag))
  }

  return {
    adventure,
    characters: [...new Set(characters)],
    continuePrevious,
    extraTags,
  }
}
