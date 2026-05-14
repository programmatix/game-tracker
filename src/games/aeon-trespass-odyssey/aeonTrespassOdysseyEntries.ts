import type { BggPlay } from '../../bgg'
import { aeonTrespassOdysseyContent } from './content'
import { parseAeonTrespassOdysseyPlayerColor } from './aeonTrespassOdyssey'

export const AEON_TRESPASS_ODYSSEY_OBJECT_ID = '242705'

export type AeonTrespassOdysseyEntry = {
  play: BggPlay
  campaign: string
  day: string
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
  if (!entry.campaign && entry.day) {
    entry.campaign = aeonTrespassOdysseyContent.dayCycleByName.get(entry.day) || ''
  }
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
          day: parsed.day,
          continuePrevious: parsed.continuePrevious,
          continueNext: parsed.continueNext,
        }
      })

      const myPlayer = parsedPlayers.find((player) => player.username === user)
      const cycleCandidates = parsedPlayers.map((player) => player.cycle).filter(Boolean) as string[]
      const dayCandidates = parsedPlayers.map((player) => player.day).filter(Boolean) as string[]
      const day = myPlayer?.day?.trim() || chooseMostCommonOrFirst(dayCandidates) || ''
      const campaign =
        myPlayer?.cycle?.trim() ||
        chooseMostCommonOrFirst(cycleCandidates) ||
        (day ? aeonTrespassOdysseyContent.dayCycleByName.get(day) : undefined) ||
        ''

      return {
        play,
        campaign,
        day,
        quantity: playQuantity(play),
        isWin: myPlayer?.win === true,
        continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
        continuedToNext: parsedPlayers.some((player) => player.continueNext),
      }
    })

  let previousResolved: { campaign?: string; day?: string } | undefined
  for (const entry of result) {
    if (entry.continuedFromPrevious && previousResolved) {
      if (!entry.campaign && previousResolved.campaign) entry.campaign = previousResolved.campaign
      const previousDayCampaign = previousResolved.day
        ? aeonTrespassOdysseyContent.dayCycleByName.get(previousResolved.day)
        : undefined
      if (
        !entry.day &&
        previousResolved.day &&
        (!entry.campaign || !previousDayCampaign || previousDayCampaign === entry.campaign)
      ) {
        entry.day = previousResolved.day
      }
    }
    fillCycleFromDay(entry)
    if (entry.campaign || entry.day) {
      previousResolved = {
        campaign: entry.campaign || previousResolved?.campaign,
        day: entry.day || previousResolved?.day,
      }
    }
  }

  let nextResolved: { campaign?: string; day?: string } | undefined
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (entry.continuedToNext && nextResolved) {
      if (!entry.campaign && nextResolved.campaign) entry.campaign = nextResolved.campaign
      const nextDayCampaign = nextResolved.day
        ? aeonTrespassOdysseyContent.dayCycleByName.get(nextResolved.day)
        : undefined
      if (
        !entry.day &&
        nextResolved.day &&
        (!entry.campaign || !nextDayCampaign || nextDayCampaign === entry.campaign)
      ) {
        entry.day = nextResolved.day
      }
    }
    fillCycleFromDay(entry)
    if (entry.campaign || entry.day) {
      nextResolved = {
        campaign: entry.campaign || nextResolved?.campaign,
        day: entry.day || nextResolved?.day,
      }
    }
  }

  for (const entry of result) {
    fillCycleFromDay(entry)
    if (!entry.campaign) entry.campaign = 'Unknown cycle'
    if (!entry.day) entry.day = 'Unknown day'
  }

  return result
}
