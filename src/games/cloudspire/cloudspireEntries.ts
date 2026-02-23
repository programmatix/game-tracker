import type { BggPlay } from '../../bgg'
import { parseCloudspirePlayerColor } from './cloudspire'

export const CLOUDSPIRE_OBJECT_ID = '262211'

export type CloudspireEntry = {
  play: BggPlay
  myFaction: string
  opponentFaction: string
  mode: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isCloudspirePlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === CLOUDSPIRE_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  if (!name) return false
  return name === 'cloudspire' || name.startsWith('cloudspire:') || name.includes('cloudspire')
}

export function getCloudspireEntries(plays: BggPlay[], username: string): CloudspireEntry[] {
  const result: CloudspireEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isCloudspirePlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseCloudspirePlayerColor(player?.attributes.color || '')

    result.push({
      play,
      myFaction: parsed.myFaction || 'Unknown faction',
      opponentFaction: parsed.opponentFaction || 'Unknown opponent',
      mode: parsed.mode || 'Unknown mode',
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
