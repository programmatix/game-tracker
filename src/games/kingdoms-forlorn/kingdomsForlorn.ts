import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { kingdomsForlornContent } from './content'

export type KingdomsForlornPlayerTags = {
  kingdom?: string
  knight?: string
  knights: string[]
  quest?: string
  freeRoam: boolean
  expeditionStep?: KingdomsForlornExpeditionStep
  monster?: string
  monsters: string[]
  monsterTier?: number
  continuePrevious: boolean
  continueNext: boolean
  extraTags: string[]
}

export type KingdomsForlornExpeditionStep = 'D1' | 'EC' | 'D2' | 'FC'

const EXPEDITION_STEP_LABELS: Record<KingdomsForlornExpeditionStep, string> = {
  D1: 'First delve',
  EC: 'Exhibition clash',
  D2: 'Second delve',
  FC: 'Full clash',
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

function resolveKingdom(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return kingdomsForlornContent.kingdomsById.get(normalizeId(token))
}

function resolveKnight(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return kingdomsForlornContent.knightsById.get(normalizeId(token))
}

function resolveMonster(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return kingdomsForlornContent.monstersById.get(normalizeId(token))
}

function normalizeQuestToken(value: string): string {
  const token = normalizeToken(value)
  if (!token) return ''
  const direct = /^q\s*[:：]?\s*(\d+)\b/i.exec(token)
  if (direct) return `Q${direct[1]}`
  const named = /^quest\s*[:：]?\s*(\d+)\b/i.exec(token)
  if (named) return `Q${named[1]}`
  return token
}

function resolveQuest(value: string): string | undefined {
  const token = normalizeQuestToken(value)
  if (!token) return undefined
  return kingdomsForlornContent.questsById.get(normalizeId(token))
}

function isFreeRoamToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'freeroam' || normalized === 'roam'
}

export function kingdomForlornExpeditionStepLabel(step: KingdomsForlornExpeditionStep): string {
  return EXPEDITION_STEP_LABELS[step]
}

function resolveExpeditionStep(value: string): KingdomsForlornExpeditionStep | undefined {
  const normalized = normalizeId(value)
  if (!normalized) return undefined
  if (normalized === 'd1' || normalized === 'firstdelve') return 'D1'
  if (normalized === 'ec' || normalized === 'exhibitionclash') return 'EC'
  if (normalized === 'd2' || normalized === 'seconddelve') return 'D2'
  if (normalized === 'fc' || normalized === 'fullclash') return 'FC'
  return undefined
}

function cleanMonsterName(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  const asStep = resolveExpeditionStep(token)
  if (asStep) return undefined
  return resolveMonster(token) || token
}

function getExpeditionStepFromKeyValues(
  parsedKv: Record<string, string>,
): KingdomsForlornExpeditionStep | undefined {
  for (const [key, value] of Object.entries(parsedKv)) {
    const fromKey = resolveExpeditionStep(key)
    if (fromKey) return fromKey

    const fromValue = resolveExpeditionStep(value)
    if (fromValue) return fromValue
  }
  return undefined
}

function getMonstersFromSegments(segments: readonly string[]): string[] {
  const monsters: string[] = []
  const explicitMonsterKeys = ['m', 'monster', 'foe', 'enemy', 'boss', 'clash']

  for (const segment of segments) {
    const match = segment.match(/[:：]/)
    if (!match || match.index == null || match.index === 0) continue
    const key = segment.slice(0, match.index).trim()
    const value = segment.slice(match.index + match[0].length).trim()
    if (!key || !value) continue

    const normalizedKey = normalizeId(key)
    if (explicitMonsterKeys.includes(normalizedKey)) {
      const monster = cleanMonsterName(value)
      if (monster) monsters.push(monster)
      continue
    }

    const stepFromKey = resolveExpeditionStep(key)
    if (stepFromKey !== 'EC' && stepFromKey !== 'FC') continue

    const monster = cleanMonsterName(value)
    if (monster) monsters.push(monster)
  }

  return [...new Set(monsters)]
}

function resolveMonsterTier(value: string): number | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined

  const compact = /^mt\s*[:：]?\s*(\d+)$/i.exec(token)
  if (compact) return Number(compact[1])

  const named = /^(?:monster\s*)?tier\s*[:：]?\s*(\d+)$/i.exec(token)
  if (named) return Number(named[1])

  const numeric = /^(\d+)$/.exec(token)
  if (numeric) return Number(numeric[1])

  return undefined
}

function getMonsterTierFromKeyValues(parsedKv: Record<string, string>): number | undefined {
  const explicitTier = getBgStatsValue(parsedKv, [
    'MT',
    'MonsterTier',
    'Monster Tier',
    'Tier',
  ])
  const explicit = resolveMonsterTier(explicitTier || '')
  if (explicit !== undefined) return explicit

  for (const [key, value] of Object.entries(parsedKv)) {
    const keyTier = resolveMonsterTier(key)
    if (keyTier !== undefined) return keyTier

    const valueTier = resolveMonsterTier(value)
    if (valueTier !== undefined && normalizeId(key) === 'mt') return valueTier
  }

  return undefined
}

function isRecognizedKeyValueSegment(key: string, value: string): boolean {
  const normalizedKey = normalizeId(key)

  if (
    ['kg', 'kingdom', 'kdm', 'region', 'map'].includes(normalizedKey) &&
    resolveKingdom(value)
  ) {
    return true
  }

  if (
    ['k', 'knight', 'char', 'character', 'hero', 'player'].includes(normalizedKey) &&
    resolveKnight(value)
  ) {
    return true
  }

  if (
    ['q', 'quest', 'scenario'].includes(normalizedKey) &&
    (resolveQuest(value) || isFreeRoamToken(value))
  ) {
    return true
  }

  if (
    ['e', 'expedition', 'step', 'session'].includes(normalizedKey) &&
    resolveExpeditionStep(value)
  ) {
    return true
  }

  if (resolveExpeditionStep(key) || resolveExpeditionStep(value)) return true

  if (
    ['m', 'monster', 'foe', 'enemy', 'boss', 'clash'].includes(normalizedKey) &&
    cleanMonsterName(value)
  ) {
    return true
  }

  if (
    ['mt', 'monstertier', 'tier'].includes(normalizedKey) &&
    resolveMonsterTier(value) !== undefined
  ) {
    return true
  }

  if (resolveMonsterTier(key) !== undefined) return true

  return false
}

function isContinuePreviousToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contprev' || normalized === 'continueprevious'
}

function isContinueNextToken(value: string): boolean {
  const normalized = normalizeId(value)
  return normalized === 'contnext' || normalized === 'continuenext'
}

export function parseKingdomsForlornPlayerColor(color: string): KingdomsForlornPlayerTags {
  const segments = splitBgStatsSegments(color)
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = segments.filter((segment) => !/[:：]/.test(segment))

  let kingdom = resolveKingdom(
    getBgStatsValue(parsedKv, ['Kg', 'Kingdom', 'Kdm', 'Region', 'Map']) || '',
  )
  let knight = resolveKnight(
    getBgStatsValue(parsedKv, ['K', 'Knight', 'Char', 'Character', 'Hero', 'Player']) || '',
  )
  const knights = knight ? [knight] : []
  let quest = resolveQuest(getBgStatsValue(parsedKv, ['Q', 'Quest', 'Scenario']) || '')
  let freeRoam = isFreeRoamToken(getBgStatsValue(parsedKv, ['Q', 'Quest', 'Scenario']) || '')
  let expeditionStep = resolveExpeditionStep(
    getBgStatsValue(parsedKv, ['E', 'Expedition', 'Step', 'Session']) || '',
  ) || getExpeditionStepFromKeyValues(parsedKv)
  const monsters = getMonstersFromSegments(segments)
  let monster = monsters[0]
  let monsterTier = getMonsterTierFromKeyValues(parsedKv)
  let continuePrevious = false
  let continueNext = false
  const extraTags: string[] = []

  for (const [key, value] of Object.entries(parsedKv)) {
    if (!isRecognizedKeyValueSegment(key, value)) extraTags.push(`${key}: ${value}`)
  }

  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (isContinuePreviousToken(normalized)) {
      continuePrevious = true
      continue
    }
    if (isContinueNextToken(normalized)) {
      continueNext = true
      continue
    }

    const kingdomFromTag = resolveKingdom(normalized)
    if (!kingdom && kingdomFromTag) {
      kingdom = kingdomFromTag
      continue
    }

    const knightFromTag = resolveKnight(normalized)
    if (knightFromTag) {
      if (!knight) knight = knightFromTag
      knights.push(knightFromTag)
      continue
    }

    const questFromTag = resolveQuest(normalized)
    if (!quest && questFromTag) {
      quest = questFromTag
      continue
    }

    if (!quest && isFreeRoamToken(normalized)) {
      freeRoam = true
      continue
    }

    const expeditionStepFromTag = resolveExpeditionStep(normalized)
    if (!expeditionStep && expeditionStepFromTag) {
      expeditionStep = expeditionStepFromTag
      continue
    }

    const monsterTierFromTag = resolveMonsterTier(normalized)
    if (monsterTier === undefined && monsterTierFromTag !== undefined) {
      monsterTier = monsterTierFromTag
      continue
    }

    const monsterFromTag = resolveMonster(normalized)
    if (monsterFromTag) {
      monsters.push(monsterFromTag)
      if (!monster) monster = monsterFromTag
      continue
    }

    extraTags.push(normalized)
  }

  return {
    kingdom,
    knight,
    knights: [...new Set(knights)],
    quest,
    freeRoam,
    expeditionStep,
    monster,
    monsters: [...new Set(monsters)],
    monsterTier,
    continuePrevious,
    continueNext,
    extraTags: [...new Set(extraTags)],
  }
}
