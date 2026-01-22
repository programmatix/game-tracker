import type { BggPlay } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import ownedContentText from './content.yaml?raw'
import { parseOwnedFinalGirlContent, resolveFinalGirlBgStatsTags } from './ownedContent'

export const FINAL_GIRL_OBJECT_ID = '277659'

export type FinalGirlEntry = {
  play: BggPlay
  villain: string
  location: string
  finalGirl: string
  quantity: number
  isWin: boolean
}

export const ownedFinalGirlContent = parseOwnedFinalGirlContent(ownedContentText)

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

export function getFinalGirlEntries(plays: BggPlay[], username: string): FinalGirlEntry[] {
  const result: FinalGirlEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isFinalGirl = objectid === FINAL_GIRL_OBJECT_ID || name === 'Final Girl'
    if (!isFinalGirl) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const color = player?.attributes.color || ''
    const parsed = parseBgStatsKeyValueSegments(color)

    const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))
    const resolved = resolveFinalGirlBgStatsTags(tags, ownedFinalGirlContent)

    const villain =
      getBgStatsValue(parsed, ['V', 'Villain']) || resolved.villain || 'Unknown villain'
    const location =
      getBgStatsValue(parsed, ['L', 'Location']) || resolved.location || 'Unknown location'
    const finalGirl =
      getBgStatsValue(parsed, ['FG', 'Final Girl', 'FinalGirl']) ||
      resolved.finalGirl ||
      'Unknown'

    result.push({
      play,
      villain,
      location,
      finalGirl,
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
