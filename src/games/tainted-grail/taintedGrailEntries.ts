import type { BggPlay } from '../../bgg'
import { parseTaintedGrailPlayerColor } from './taintedGrail'

export const TAINTED_GRAIL_OBJECT_ID = '264220'

export type TaintedGrailEntry = {
  play: BggPlay
  chapter: string
  quantity: number
  isWin: boolean
  continuedFromPrevious: boolean
  continuedToNext: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function compareTaintedGrailPlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
}

function isTaintedGrailPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === TAINTED_GRAIL_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'tainted grail: the fall of avalon'
}

export function getTaintedGrailEntries(plays: BggPlay[], username: string): TaintedGrailEntry[] {
  const user = username.toLowerCase()
  const taintedGrailPlays = plays.filter(isTaintedGrailPlay).slice().sort(compareTaintedGrailPlaysAsc)
  const result = taintedGrailPlays.map((play) => {
    const parsedPlayers = play.players.map((player) => {
      const parsed = parseTaintedGrailPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        chapter: parsed.chapter,
        continuePrevious: parsed.continuePrevious,
        continueNext: parsed.continueNext,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const chapterCandidates = parsedPlayers.map((player) => player.chapter).filter(Boolean) as string[]
    const chapter = myPlayer?.chapter?.trim() || chapterCandidates[0]?.trim() || ''

    return {
      play,
      chapter,
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
      continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
      continuedToNext: parsedPlayers.some((player) => player.continueNext),
    }
  })

  let previousChapter: string | undefined
  for (const entry of result) {
    if (!entry.chapter && entry.continuedFromPrevious && previousChapter) entry.chapter = previousChapter
    if (entry.chapter) previousChapter = entry.chapter
  }

  let nextChapter: string | undefined
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (!entry.chapter && entry.continuedToNext && nextChapter) entry.chapter = nextChapter
    if (entry.chapter) nextChapter = entry.chapter
  }

  for (const entry of result) {
    if (!entry.chapter) entry.chapter = 'Unknown chapter'
  }

  return result
}
