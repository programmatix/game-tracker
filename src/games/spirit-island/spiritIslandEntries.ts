import type { BggPlay } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import mappingsText from './mappings.txt?raw'
import {
  formatSpiritIslandAdversaryLabel,
  parseSpiritIslandMappings,
  resolveSpiritIslandAdversary,
  resolveSpiritIslandSpirit,
} from './mappings'

export const SPIRIT_ISLAND_OBJECT_ID = '162886'

export const spiritIslandMappings = parseSpiritIslandMappings(mappingsText)

export type SpiritIslandEntry = {
  play: BggPlay
  spirit: string
  adversary: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function resolveSpirit(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey =
    getBgStatsValue(parsed, ['S', 'Spirit']) ||
    getBgStatsValue(parsed, ['Sp', 'SpiritIslandSpirit'])

  if (fromKey) return resolveSpiritIslandSpirit(fromKey, spiritIslandMappings) || fromKey.trim()

  for (const tag of tags) {
    const resolved = resolveSpiritIslandSpirit(tag, spiritIslandMappings)
    if (resolved) return resolved
  }

  const fallback = tags[0]?.trim()
  return fallback || 'Unknown spirit'
}

function resolveAdversary(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey =
    getBgStatsValue(parsed, ['A', 'Adv', 'Adversary']) ||
    getBgStatsValue(parsed, ['AL', 'AdversaryLevel'])
  const level = getBgStatsValue(parsed, ['L', 'Level'])

  if (fromKey) {
    const resolved = resolveSpiritIslandAdversary(fromKey, spiritIslandMappings)
    if (resolved) return formatSpiritIslandAdversaryLabel(resolved)
    if (level) return `${fromKey.trim()} L${level.trim()}`
    return fromKey.trim()
  }

  if (level) {
    const baseToken = tags.find((tag) =>
      resolveSpiritIslandAdversary(tag, spiritIslandMappings),
    )
    if (baseToken) {
      const resolved = resolveSpiritIslandAdversary(baseToken, spiritIslandMappings)
      if (resolved) return formatSpiritIslandAdversaryLabel({ ...resolved, level })
      return `${baseToken.trim()} L${level.trim()}`
    }
  }

  for (const tag of tags) {
    const resolved = resolveSpiritIslandAdversary(tag, spiritIslandMappings)
    if (resolved) return formatSpiritIslandAdversaryLabel(resolved)
  }

  const fallback = tags[1]?.trim()
  return fallback || 'No adversary'
}

export function getSpiritIslandEntries(plays: BggPlay[], username: string): SpiritIslandEntry[] {
  const result: SpiritIslandEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isSpiritIsland = objectid === SPIRIT_ISLAND_OBJECT_ID || name === 'Spirit Island'
    if (!isSpiritIsland) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const color = player?.attributes.color || ''
    const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

    const spirit = resolveSpirit(color, tags)
    const adversary = resolveAdversary(color, tags)

    result.push({
      play,
      spirit,
      adversary,
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}

