import type { BggPlay } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import mappingsText from './mappings.yaml?raw'
import {
  parseMistfallMappings,
  resolveMistfallHero,
  resolveMistfallQuest,
} from './mappings'

export const MISTFALL_BASE_OBJECT_ID = '168274'
export const HEART_OF_THE_MISTS_OBJECT_ID = '193953'
export const mistfallMappings = parseMistfallMappings(mappingsText)

export type MistfallEntry = {
  play: BggPlay
  hero: string
  quest: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function normalizeMistfallQuestNumber(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const match =
    trimmed.match(/^(?:quest|q)\s*(\d+)\b/i) || trimmed.match(/^q\s*[:：]?\s*(\d+)\b/i)
  if (!match) return undefined

  const num = Number(match[1])
  if (!Number.isFinite(num) || num <= 0) return undefined
  return String(num)
}

function normalizeMistfallQuestToken(
  input: string,
  kind: 'mistfall' | 'hotm',
): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const normalizedId = trimmed.replace(/\s+/g, '')
  const directMatch = /^(?:M|MF|Mistfall)\s*([0-9]+)$/i.exec(normalizedId)
  if (directMatch) return `M${directMatch[1]}`

  const hotmMatch = /^(?:H|HOM|HOTM|Heart(?:ofthe)?mists?)\s*([0-9]+)$/i.exec(normalizedId)
  if (hotmMatch) return `H${hotmMatch[1]}`

  const questNumber = normalizeMistfallQuestNumber(trimmed)
  if (!questNumber) return undefined
  return kind === 'mistfall' ? `M${questNumber}` : `H${questNumber}`
}

function resolveQuest(color: string, tags: string[], kind: 'mistfall' | 'hotm'): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey = getBgStatsValue(parsed, ['Q', 'Quest', 'Scenario'])
  if (fromKey) {
    const token = normalizeMistfallQuestToken(fromKey, kind)
    if (token) return resolveMistfallQuest(token, mistfallMappings) || `Quest ${token.slice(1)}`
    return resolveMistfallQuest(fromKey, mistfallMappings) || fromKey.trim()
  }

  for (const tag of tags) {
    const token = normalizeMistfallQuestToken(tag, kind)
    if (token) return resolveMistfallQuest(token, mistfallMappings) || `Quest ${token.slice(1)}`

    const resolved = resolveMistfallQuest(tag, mistfallMappings)
    if (resolved) return resolved
  }

  return 'Unknown quest'
}

function resolveHero(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey = getBgStatsValue(parsed, ['H', 'Hero', 'Character'])
  if (fromKey) return resolveMistfallHero(fromKey, mistfallMappings) || fromKey.trim()

  for (const tag of tags) {
    if (normalizeMistfallQuestToken(tag, 'mistfall') || normalizeMistfallQuestToken(tag, 'hotm'))
      continue
    const resolved = resolveMistfallHero(tag, mistfallMappings)
    if (resolved) return resolved
    const trimmed = tag.trim()
    if (trimmed) return trimmed
  }

  return 'Unknown hero'
}

export function getMistfallEntries(plays: BggPlay[], username: string): MistfallEntry[] {
  const result: MistfallEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isMistfall = objectid === MISTFALL_BASE_OBJECT_ID || name === 'Mistfall'
    const isHeartOfTheMists =
      objectid === HEART_OF_THE_MISTS_OBJECT_ID || name === 'Mistfall: Heart of the Mists'
    if (!isMistfall && !isHeartOfTheMists) continue
    const kind: 'mistfall' | 'hotm' = isHeartOfTheMists ? 'hotm' : 'mistfall'

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const color = player?.attributes.color || ''
    const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

    const hero = resolveHero(color, tags)
    const quest = resolveQuest(color, tags, kind)

    result.push({
      play,
      hero,
      quest,
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
