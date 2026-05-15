import type { BggPlay } from '../../bgg'
import { aeonTrespassOdysseyContent } from './content'
import { parseAeonTrespassOdysseyPlayerColor } from './aeonTrespassOdyssey'

export const AEON_TRESPASS_ODYSSEY_OBJECT_ID = '242705'

export type AeonTrespassOdysseyEntry = {
  play: BggPlay
  campaign: string
  startDay: string
  endDay: string
  day: string
  startDayNumber?: number
  endDayNumber?: number
  isLearnToPlay: boolean
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

function comparePlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
}

function isAeonTrespassOdysseyPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === AEON_TRESPASS_ODYSSEY_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'aeon trespass: odyssey' || name === 'aeon trespass odyssey'
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

function fillCycleFromDay(entry: AeonTrespassOdysseyEntry): void {
  if (!entry.campaign && entry.endDay) {
    entry.campaign = aeonTrespassOdysseyContent.dayCycleByName.get(entry.endDay) || ''
  }
  if (!entry.campaign && entry.startDay) {
    entry.campaign = aeonTrespassOdysseyContent.dayCycleByName.get(entry.startDay) || ''
  }
}

function fillDayNumbers(entry: AeonTrespassOdysseyEntry): void {
  entry.startDayNumber = aeonTrespassOdysseyContent.dayNumberByName.get(entry.startDay)
  entry.endDayNumber = aeonTrespassOdysseyContent.dayNumberByName.get(entry.endDay)
}

export function getAeonTrespassOdysseyEntries(
  plays: BggPlay[],
  username: string,
): AeonTrespassOdysseyEntry[] {
  const user = username.toLowerCase()
  const result = plays
    .filter(isAeonTrespassOdysseyPlay)
    .slice()
    .sort(comparePlaysAsc)
    .map((play) => {
      const parsedPlayers = play.players.map((player) => {
        const parsed = parseAeonTrespassOdysseyPlayerColor(player.attributes.color || '')
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          cycle: parsed.cycle,
          startDay: parsed.startDay,
          endDay: parsed.endDay,
          learnToPlay: parsed.learnToPlay,
          continuePrevious: parsed.continuePrevious,
          continueNext: parsed.continueNext,
        }
      })

      const myPlayer = parsedPlayers.find((player) => player.username === user)
      const cycleCandidates = parsedPlayers.map((player) => player.cycle).filter(Boolean) as string[]
      const startDayCandidates = parsedPlayers.map((player) => player.startDay).filter(Boolean) as string[]
      const endDayCandidates = parsedPlayers.map((player) => player.endDay).filter(Boolean) as string[]
      const startDay = myPlayer?.startDay?.trim() || chooseMostCommonOrFirst(startDayCandidates) || ''
      const endDay = myPlayer?.endDay?.trim() || chooseMostCommonOrFirst(endDayCandidates) || startDay
      const isLearnToPlay = parsedPlayers.some((player) => player.learnToPlay)
      const campaign =
        myPlayer?.cycle?.trim() ||
        chooseMostCommonOrFirst(cycleCandidates) ||
        (endDay ? aeonTrespassOdysseyContent.dayCycleByName.get(endDay) : undefined) ||
        (startDay ? aeonTrespassOdysseyContent.dayCycleByName.get(startDay) : undefined) ||
        ''

      const entry: AeonTrespassOdysseyEntry = {
        play,
        campaign,
        startDay,
        endDay,
        day: endDay,
        isLearnToPlay,
        quantity: playQuantity(play),
        isWin: myPlayer?.win === true,
        continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
        continuedToNext: parsedPlayers.some((player) => player.continueNext),
      }
      fillDayNumbers(entry)
      return entry
    })

  let previousResolved: { campaign?: string; startDay?: string; endDay?: string } | undefined
  for (const entry of result) {
    if (entry.continuedFromPrevious && previousResolved) {
      if (!entry.campaign && previousResolved.campaign) entry.campaign = previousResolved.campaign
      const previousDayCampaign = previousResolved.endDay
        ? aeonTrespassOdysseyContent.dayCycleByName.get(previousResolved.endDay)
        : undefined
      if (
        !entry.endDay &&
        previousResolved.endDay &&
        (!entry.campaign || !previousDayCampaign || previousDayCampaign === entry.campaign)
      ) {
        entry.endDay = previousResolved.endDay
        entry.day = entry.endDay
      }
      if (!entry.startDay && previousResolved.startDay) {
        entry.startDay = previousResolved.startDay
      }
    }
    fillCycleFromDay(entry)
    fillDayNumbers(entry)
    if (entry.campaign || entry.endDay || entry.startDay) {
      previousResolved = {
        campaign: entry.campaign || previousResolved?.campaign,
        startDay: entry.startDay || previousResolved?.startDay,
        endDay: entry.endDay || previousResolved?.endDay,
      }
    }
  }

  let nextResolved: { campaign?: string; startDay?: string; endDay?: string } | undefined
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (entry.continuedToNext && nextResolved) {
      if (!entry.campaign && nextResolved.campaign) entry.campaign = nextResolved.campaign
      const nextDayCampaign = nextResolved.endDay
        ? aeonTrespassOdysseyContent.dayCycleByName.get(nextResolved.endDay)
        : undefined
      if (
        !entry.endDay &&
        nextResolved.endDay &&
        (!entry.campaign || !nextDayCampaign || nextDayCampaign === entry.campaign)
      ) {
        entry.endDay = nextResolved.endDay
        entry.day = entry.endDay
      }
      if (!entry.startDay && nextResolved.startDay) {
        entry.startDay = nextResolved.startDay
      }
    }
    fillCycleFromDay(entry)
    fillDayNumbers(entry)
    if (entry.campaign || entry.endDay || entry.startDay) {
      nextResolved = {
        campaign: entry.campaign || nextResolved?.campaign,
        startDay: entry.startDay || nextResolved?.startDay,
        endDay: entry.endDay || nextResolved?.endDay,
      }
    }
  }

  for (const entry of result) {
    fillCycleFromDay(entry)
    if (!entry.startDay && entry.endDay) entry.startDay = entry.endDay
    if (!entry.endDay && entry.startDay) entry.endDay = entry.startDay
    entry.day = entry.endDay
    fillDayNumbers(entry)
    if (!entry.campaign) entry.campaign = 'Unknown cycle'
    if (!entry.startDay) entry.startDay = 'Unknown day'
    if (!entry.endDay) entry.endDay = 'Unknown day'
    entry.day = entry.endDay
  }

  return result
}
