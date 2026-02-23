import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { cloudspireContent } from './content'

export type CloudspirePlayerTags = {
  myFaction?: string
  opponentFaction?: string
  mode?: string
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

function resolveFaction(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return cloudspireContent.factionsById.get(normalizeId(token)) ?? token
}

function resolveMode(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return cloudspireContent.modesById.get(normalizeId(token)) ?? token
}

function isKnownFactionToken(value: string): boolean {
  return cloudspireContent.factionsById.has(normalizeId(value))
}

function isKnownModeToken(value: string): boolean {
  return cloudspireContent.modesById.has(normalizeId(value))
}

export function parseCloudspirePlayerColor(color: string): CloudspirePlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const myFactionKv = getBgStatsValue(parsedKv, ['F', 'MF', 'MyFaction', 'Faction', 'Player'])
  const opponentFactionKv = getBgStatsValue(parsedKv, ['O', 'OF', 'Opponent', 'Enemy', 'Vs'])
  const modeKv = getBgStatsValue(parsedKv, ['M', 'Mode'])

  let myFaction = myFactionKv ? resolveFaction(myFactionKv) : undefined
  let opponentFaction = opponentFactionKv ? resolveFaction(opponentFactionKv) : undefined
  let mode = modeKv ? resolveMode(modeKv) : undefined

  const used = new Set<string>()

  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    if (!mode && isKnownModeToken(normalized)) {
      mode = resolveMode(normalized)
      used.add(normalized)
      continue
    }

    if (!myFaction && isKnownFactionToken(normalized)) {
      myFaction = resolveFaction(normalized)
      used.add(normalized)
      continue
    }

    if (!opponentFaction && isKnownFactionToken(normalized)) {
      opponentFaction = resolveFaction(normalized)
      used.add(normalized)
      continue
    }
  }

  if (!mode) {
    const lower = tags.map((tag) => normalizeToken(tag).toLowerCase())
    if (lower.some((tag) => tag.includes('solo'))) mode = 'Solo'
    else if (lower.some((tag) => tag.includes('co-op') || tag.includes('coop'))) mode = 'Co-op'
    else if (lower.some((tag) => tag.includes('pvp') || tag === 'vs' || tag === 'versus')) mode = 'PvP'
  }

  const extraTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !used.has(tag))

  return { myFaction, opponentFaction, mode, extraTags }
}
