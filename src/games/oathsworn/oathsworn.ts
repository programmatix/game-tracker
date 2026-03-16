import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { oathswornContent } from './content'

export type OathswornPlayerTags = {
  story?: string
  encounter?: string
  characters: string[]
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

function resolveStory(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return oathswornContent.storiesById.get(normalizeId(token))
}

function resolveEncounter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return oathswornContent.encountersById.get(normalizeId(token))
}

function resolveCharacter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return oathswornContent.charactersById.get(normalizeId(token))
}

function addCharacterToken(target: string[], value: string) {
  for (const part of value.split(/[,+&]/g)) {
    const character = resolveCharacter(part)
    if (character) target.push(character)
  }
}

export function parseOathswornPlayerColor(color: string): OathswornPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const characters: string[] = []
  const extraTags: string[] = []
  let story = resolveStory(getBgStatsValue(parsedKv, ['S', 'Story', 'StoryChapter', 'Chapter']) || '')
  let encounter = resolveEncounter(
    getBgStatsValue(parsedKv, ['E', 'Encounter', 'EncounterChapter', 'Fight']) || '',
  )

  const characterKv = getBgStatsValue(parsedKv, ['C', 'Char', 'Character', 'Chars', 'Party', 'Team'])
  if (characterKv) addCharacterToken(characters, characterKv)

  for (const tag of tags) {
    const storyFromTag = resolveStory(tag)
    if (!story && storyFromTag) {
      story = storyFromTag
      continue
    }

    const encounterFromTag = resolveEncounter(tag)
    if (!encounter && encounterFromTag) {
      encounter = encounterFromTag
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
    story,
    encounter,
    characters: [...new Set(characters)],
    extraTags,
  }
}
