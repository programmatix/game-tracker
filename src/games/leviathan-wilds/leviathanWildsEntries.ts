import type { BggPlay } from '../../bgg'
import { parseLeviathanWildsPlayTags, parseLeviathanWildsPlayerColor } from './leviathanWilds'

export const LEVIATHAN_WILDS_OBJECT_ID = '358737'

export type LeviathanWildsEntry = {
  play: BggPlay
  leviathan: string
  difficulty?: string
  character?: string
  className?: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function comparePlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
}

function isLeviathanWildsPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === LEVIATHAN_WILDS_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'leviathan wilds' || name.startsWith('leviathan wilds:')
}

export function getLeviathanWildsEntries(plays: BggPlay[], username: string): LeviathanWildsEntry[] {
  const user = username.toLowerCase()

  return plays.filter(isLeviathanWildsPlay).slice().sort(comparePlaysAsc).map((play) => {
    const playTags = parseLeviathanWildsPlayTags([play.comments || '', play.players.map((player) => player.attributes.color || '').join('／')].join('／'))
    const parsedPlayers = play.players.map((player) => {
      const parsed = parseLeviathanWildsPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        character: parsed.character,
        className: parsed.className,
      }
    })
    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const characterCandidates = parsedPlayers.map((player) => player.character).filter(Boolean) as string[]
    const classCandidates = parsedPlayers.map((player) => player.className).filter(Boolean) as string[]

    return {
      play,
      leviathan: playTags.leviathan || 'Unknown leviathan',
      difficulty: playTags.difficulty,
      character: myPlayer?.character || characterCandidates[0],
      className: myPlayer?.className || classCandidates[0],
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
    }
  })
}
