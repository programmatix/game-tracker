import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { mandalorianAdventuresContent } from './content'

export type MandalorianAdventuresPlayerTags = {
  mission?: string
  characters: string[]
  encounter?: string
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

function splitCharacterCandidates(value: string): string[] {
  return value
    .split(/[,+&]/g)
    .map((token) => normalizeToken(token))
    .filter(Boolean)
}

function resolveMission(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return mandalorianAdventuresContent.missionsById.get(normalizeId(token))
}

function resolveCharacter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return mandalorianAdventuresContent.charactersById.get(normalizeId(token))
}

function resolveEncounter(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return mandalorianAdventuresContent.encountersById.get(normalizeId(token))
}

export function parseMandalorianAdventuresPlayerColor(color: string): MandalorianAdventuresPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const missionKv = getBgStatsValue(parsedKv, ['M', 'Mission', 'S', 'Scenario'])
  const encounterKv = getBgStatsValue(parsedKv, ['E', 'Encounter', 'N', 'Nemesis', 'Enemy'])
  const characterKv = getBgStatsValue(parsedKv, ['C', 'Char', 'Character', 'H', 'Hero'])

  const missionFromKv = missionKv ? resolveMission(missionKv) : undefined
  const encounterFromKv = encounterKv ? resolveEncounter(encounterKv) : undefined

  const kvCharacters = characterKv
    ? splitCharacterCandidates(characterKv)
        .map(resolveCharacter)
        .filter((value): value is string => Boolean(value))
    : []

  const tagCharacters: string[] = []
  let missionFromTags: string | undefined
  let encounterFromTags: string | undefined
  const extraTags: string[] = []

  for (const tag of tags) {
    const mission = resolveMission(tag)
    if (!missionFromTags && mission) {
      missionFromTags = mission
      continue
    }

    const character = resolveCharacter(tag)
    if (character) {
      tagCharacters.push(character)
      continue
    }

    const encounter = resolveEncounter(tag)
    if (!encounterFromTags && encounter) {
      encounterFromTags = encounter
      continue
    }

    extraTags.push(normalizeToken(tag))
  }

  const characters = [...new Set([...kvCharacters, ...tagCharacters])]

  return {
    mission: missionFromKv ?? missionFromTags,
    characters,
    encounter: encounterFromKv ?? encounterFromTags,
    extraTags,
  }
}
