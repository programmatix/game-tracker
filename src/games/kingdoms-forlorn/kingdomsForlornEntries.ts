import type { BggPlay } from '../../bgg'
import { parseKingdomsForlornPlayerColor } from './kingdomsForlorn'

export const KINGDOMS_FORLORN_OBJECT_ID = '297510'

export type KingdomsForlornEntry = {
  play: BggPlay
  kingdom: string
  knights: string[]
  myKnight?: string
  quest?: string
  quantity: number
  isWin: boolean
  continuedFromPrevious: boolean
  continuedToNext: boolean
}

function playQuantity(play: BggPlay): number {
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

function isKingdomsForlornPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === KINGDOMS_FORLORN_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'kingdoms forlorn: dragons, devils and kings' || name.startsWith('kingdoms forlorn')
}

function chooseMostCommonOrFirst(candidates: string[]): string | undefined {
  const normalized = candidates.map((value) => value.trim()).filter(Boolean)
  if (normalized.length === 0) return undefined

  const counts = new Map<string, number>()
  for (const value of normalized) counts.set(value, (counts.get(value) ?? 0) + 1)

  let best: { value: string; count: number } | undefined
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count }
  }

  return best?.value ?? normalized[0]
}

export function getKingdomsForlornEntries(
  plays: BggPlay[],
  username: string,
): KingdomsForlornEntry[] {
  const user = username.toLowerCase()
  const result = plays
    .filter(isKingdomsForlornPlay)
    .slice()
    .sort(comparePlaysAsc)
    .map((play) => {
      const parsedPlayers = play.players.map((player) => {
        const parsed = parseKingdomsForlornPlayerColor(player.attributes.color || '')
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          kingdom: parsed.kingdom,
          knight: parsed.knight,
          quest: parsed.quest,
          continuePrevious: parsed.continuePrevious,
          continueNext: parsed.continueNext,
        }
      })

      const myPlayer = parsedPlayers.find((player) => player.username === user)
      const kingdomCandidates = parsedPlayers.map((player) => player.kingdom).filter(Boolean) as string[]
      const knightCandidates = parsedPlayers.map((player) => player.knight).filter(Boolean) as string[]
      const myKnight = myPlayer?.knight?.trim() || undefined
      const quest = myPlayer?.quest?.trim() || undefined
      const knights = [...new Set(knightCandidates)]

      return {
        play,
        kingdom: myPlayer?.kingdom?.trim() || chooseMostCommonOrFirst(kingdomCandidates) || '',
        knights,
        myKnight,
        quest,
        quantity: playQuantity(play),
        isWin: myPlayer?.win === true,
        continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
        continuedToNext: parsedPlayers.some((player) => player.continueNext),
      }
    })

  let previousResolved: { kingdom?: string; myKnight?: string; quest?: string } | null = null
  for (const entry of result) {
    if (entry.continuedFromPrevious && previousResolved) {
      if (!entry.kingdom && previousResolved.kingdom) entry.kingdom = previousResolved.kingdom
      if (!entry.myKnight && previousResolved.myKnight) entry.myKnight = previousResolved.myKnight
      if (!entry.quest && previousResolved.quest) entry.quest = previousResolved.quest
    }
    if (entry.myKnight && !entry.knights.includes(entry.myKnight)) entry.knights.push(entry.myKnight)
    if (entry.kingdom || entry.myKnight || entry.quest) {
      const priorKingdom: string | undefined = previousResolved ? previousResolved.kingdom : undefined
      const priorMyKnight: string | undefined = previousResolved ? previousResolved.myKnight : undefined
      const priorQuest: string | undefined = previousResolved ? previousResolved.quest : undefined
      previousResolved = {
        kingdom: entry.kingdom || priorKingdom,
        myKnight: entry.myKnight || priorMyKnight,
        quest: entry.quest || priorQuest,
      }
    }
  }

  let nextResolved: { kingdom?: string; myKnight?: string; quest?: string } | null = null
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (entry.continuedToNext && nextResolved) {
      if (!entry.kingdom && nextResolved.kingdom) entry.kingdom = nextResolved.kingdom
      if (!entry.myKnight && nextResolved.myKnight) entry.myKnight = nextResolved.myKnight
      if (!entry.quest && nextResolved.quest) entry.quest = nextResolved.quest
    }
    if (entry.myKnight && !entry.knights.includes(entry.myKnight)) entry.knights.push(entry.myKnight)
    if (entry.kingdom || entry.myKnight || entry.quest) {
      const priorKingdom: string | undefined = nextResolved ? nextResolved.kingdom : undefined
      const priorMyKnight: string | undefined = nextResolved ? nextResolved.myKnight : undefined
      const priorQuest: string | undefined = nextResolved ? nextResolved.quest : undefined
      nextResolved = {
        kingdom: entry.kingdom || priorKingdom,
        myKnight: entry.myKnight || priorMyKnight,
        quest: entry.quest || priorQuest,
      }
    }
  }

  for (const entry of result) {
    if (!entry.kingdom) entry.kingdom = 'Unknown kingdom'
    if (entry.knights.length === 0) entry.knights = entry.myKnight ? [entry.myKnight] : ['Unknown knight']
  }

  return result
}
