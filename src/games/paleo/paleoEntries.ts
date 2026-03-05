import type { BggPlay } from '../../bgg'
import { parsePaleoPlayerColor } from './paleo'

export const PALEO_OBJECT_ID = '300531'

export type PaleoEntry = {
  play: BggPlay
  moduleA: string
  moduleB: string
  scenario: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isPaleoPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === PALEO_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  if (!name) return false
  return name === 'paleo' || name.startsWith('paleo:')
}

export function getPaleoEntries(plays: BggPlay[], username: string): PaleoEntry[] {
  const result: PaleoEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isPaleoPlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parsePaleoPlayerColor(player?.attributes.color || '')

    const modules = [parsed.moduleA, parsed.moduleB]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b))

    result.push({
      play,
      moduleA: modules[0] || 'Unknown module',
      moduleB: modules[1] || 'Unknown module',
      scenario: parsed.scenario?.trim() || 'Unknown scenario',
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
