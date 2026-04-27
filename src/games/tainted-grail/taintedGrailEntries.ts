import type { BggPlay } from '../../bgg'
import { taintedGrailContent } from './content'
import { parseTaintedGrailPlayerColor } from './taintedGrail'

export const TAINTED_GRAIL_OBJECT_ID = '264220'

export type TaintedGrailEntry = {
  play: BggPlay
  campaign: string
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
  return (
    name === 'tainted grail: the fall of avalon' ||
    name === 'tainted grail: age of legends and last knight campaigns' ||
    name.startsWith('tainted grail')
  )
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
        campaign: parsed.campaign,
        chapter: parsed.chapter,
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
      campaignCandidates[0]?.trim() ||
      (chapter ? taintedGrailContent.chapterCampaignByName.get(chapter) : undefined) ||
      ''

    return {
      play,
      campaign,
      chapter,
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
      continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
      continuedToNext: parsedPlayers.some((player) => player.continueNext),
    }
  })

  let previousResolved: { campaign?: string; chapter?: string } | undefined
  for (const entry of result) {
    if (entry.continuedFromPrevious && previousResolved) {
      if (!entry.campaign && previousResolved.campaign) entry.campaign = previousResolved.campaign
      const previousChapterCampaign = previousResolved.chapter
        ? taintedGrailContent.chapterCampaignByName.get(previousResolved.chapter)
        : undefined
      if (
        !entry.chapter &&
        previousResolved.chapter &&
        (!entry.campaign || !previousChapterCampaign || previousChapterCampaign === entry.campaign)
      ) {
        entry.chapter = previousResolved.chapter
      }
    }
    if (!entry.campaign && entry.chapter) {
      entry.campaign = taintedGrailContent.chapterCampaignByName.get(entry.chapter) || ''
    }
    if (entry.campaign || entry.chapter) {
      previousResolved = {
        campaign: entry.campaign || previousResolved?.campaign,
        chapter: entry.chapter || previousResolved?.chapter,
      }
    }
  }

  let nextResolved: { campaign?: string; chapter?: string } | undefined
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (entry.continuedToNext && nextResolved) {
      if (!entry.campaign && nextResolved.campaign) entry.campaign = nextResolved.campaign
      const nextChapterCampaign = nextResolved.chapter
        ? taintedGrailContent.chapterCampaignByName.get(nextResolved.chapter)
        : undefined
      if (
        !entry.chapter &&
        nextResolved.chapter &&
        (!entry.campaign || !nextChapterCampaign || nextChapterCampaign === entry.campaign)
      ) {
        entry.chapter = nextResolved.chapter
      }
    }
    if (!entry.campaign && entry.chapter) {
      entry.campaign = taintedGrailContent.chapterCampaignByName.get(entry.chapter) || ''
    }
    if (entry.campaign || entry.chapter) {
      nextResolved = {
        campaign: entry.campaign || nextResolved?.campaign,
        chapter: entry.chapter || nextResolved?.chapter,
      }
    }
  }

  for (const entry of result) {
    if (!entry.campaign && entry.chapter) {
      entry.campaign = taintedGrailContent.chapterCampaignByName.get(entry.chapter) || ''
    }
    if (!entry.campaign) entry.campaign = 'Unknown campaign'
    if (!entry.chapter) entry.chapter = 'Unknown chapter'
  }

  return result
}
