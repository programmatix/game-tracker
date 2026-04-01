import type { BggPlay } from '../../bgg'
import { isofarianGuardContent } from './content'
import { parseIsofarianGuardPlayerColor } from './isofarianGuard'

export const ISOFARIAN_GUARD_OBJECT_ID = '281526'

export type IsofarianGuardEntry = {
  play: BggPlay
  campaign: string
  chapter: string
  guards: string[]
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

function compareIsofarianGuardPlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
}

function isIsofarianGuardPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === ISOFARIAN_GUARD_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'the isofarian guard' || name === 'isofarian guard'
}

function fallbackGuards(parsedPlayers: Array<{ guards: string[] }>): string[] {
  const combined: string[] = []
  for (const player of parsedPlayers) combined.push(...player.guards)
  return [...new Set(combined)]
}

export function getIsofarianGuardEntries(plays: BggPlay[], username: string): IsofarianGuardEntry[] {
  const user = username.toLowerCase()
  const result = plays
    .filter(isIsofarianGuardPlay)
    .slice()
    .sort(compareIsofarianGuardPlaysAsc)
    .map((play) => {
      const parsedPlayers = play.players.map((player) => {
        const parsed = parseIsofarianGuardPlayerColor(player.attributes.color || '')
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          campaign: parsed.campaign,
          chapter: parsed.chapter,
          guards: parsed.guards,
          continuePrevious: parsed.continuePrevious,
          continueNext: parsed.continueNext,
        }
      })

      const myPlayer = parsedPlayers.find((player) => player.username === user)
      const campaignCandidates = parsedPlayers.map((player) => player.campaign).filter(Boolean) as string[]
      const chapterCandidates = parsedPlayers.map((player) => player.chapter).filter(Boolean) as string[]
      const chapter = myPlayer?.chapter?.trim() || chapterCandidates[0]?.trim() || ''
      const campaign =
        myPlayer?.campaign?.trim() ||
        (chapter ? isofarianGuardContent.chapterCampaignByName.get(chapter) : undefined) ||
        campaignCandidates[0]?.trim() ||
        ''

      return {
        play,
        campaign,
        chapter,
        guards: myPlayer?.guards.length ? myPlayer.guards : fallbackGuards(parsedPlayers),
        quantity: playQuantity(play),
        isWin: myPlayer?.win === true,
        continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
        continuedToNext: parsedPlayers.some((player) => player.continueNext),
      }
    })

  let previousChapter: string | undefined
  for (const entry of result) {
    if (!entry.chapter && entry.continuedFromPrevious && previousChapter) entry.chapter = previousChapter
    if (!entry.campaign && entry.chapter) {
      entry.campaign = isofarianGuardContent.chapterCampaignByName.get(entry.chapter) || entry.campaign
    }
    if (entry.chapter) previousChapter = entry.chapter
  }

  let nextChapter: string | undefined
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (!entry.chapter && entry.continuedToNext && nextChapter) entry.chapter = nextChapter
    if (!entry.campaign && entry.chapter) {
      entry.campaign = isofarianGuardContent.chapterCampaignByName.get(entry.chapter) || entry.campaign
    }
    if (entry.chapter) nextChapter = entry.chapter
  }

  for (const entry of result) {
    if (!entry.chapter) entry.chapter = 'Unknown chapter'
    if (!entry.campaign) {
      entry.campaign =
        isofarianGuardContent.chapterCampaignByName.get(entry.chapter) || 'Unknown campaign'
    }
    if (entry.guards.length === 0) entry.guards = ['Unknown guard']
  }

  return result
}
