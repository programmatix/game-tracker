import type { BggPlay } from './bgg'
import { getArkhamHorrorLcgEntries } from './games/arkham-horror-lcg/arkhamHorrorLcgEntries'
import { arkhamHorrorLcgContent } from './games/arkham-horror-lcg/content'
import {
  getEarthborneRangersEntries,
} from './games/earthborne-rangers/earthborneRangersEntries'
import { earthborneRangersContent } from './games/earthborne-rangers/content'
import { getIsofarianGuardEntries } from './games/isofarian-guard/isofarianGuardEntries'
import { isofarianGuardContent } from './games/isofarian-guard/content'
import { getMageKnightEntries } from './games/mage-knight/mageKnightEntries'
import { mageKnightContent } from './games/mage-knight/content'
import {
  getKingdomsForlornEntries,
} from './games/kingdoms-forlorn/kingdomsForlornEntries'
import { kingdomsForlornContent } from './games/kingdoms-forlorn/content'
import { getOathswornEntries } from './games/oathsworn/oathswornEntries'
import { oathswornContent } from './games/oathsworn/content'
import { getPaleoEntries } from './games/paleo/paleoEntries'
import { paleoContent } from './games/paleo/content'
import { getRobinHoodEntries } from './games/robin-hood/robinHoodEntries'
import { robinHoodContent } from './games/robin-hood/content'
import {
  getRobinsonCrusoeEntries,
} from './games/robinson-crusoe/robinsonCrusoeEntries'
import { robinsonCrusoeContent } from './games/robinson-crusoe/content'
import { getTaintedGrailEntries } from './games/tainted-grail/taintedGrailEntries'
import { taintedGrailContent } from './games/tainted-grail/content'
import {
  getUndauntedNormandyEntries,
} from './games/undaunted-normandy/undauntedNormandyEntries'
import { undauntedNormandyContent } from './games/undaunted-normandy/content'
import {
  DEFAULT_CAMPAIGN_GAME_IDS,
  DEFAULT_SCENARIO_GAME_IDS,
} from './gameProgressCategories'
import { totalPlayMinutesWithAssumption } from './playDuration'

export const CAMPAIGN_GAME_IDS = DEFAULT_CAMPAIGN_GAME_IDS
export const SCENARIO_GAME_IDS = DEFAULT_SCENARIO_GAME_IDS

export type ProgressTrackedGameId =
  | (typeof CAMPAIGN_GAME_IDS)[number]
  | (typeof SCENARIO_GAME_IDS)[number]

export type CampaignProgressRow = {
  id: ProgressTrackedGameId
  name: string
  plays: number
  hours: number
  hasAssumedHours: boolean
  completedCount: number
  totalCount: number
  remainingCount: number
  progress: number
  progressLabel: string
}

type CampaignProgressDefinition = {
  id: ProgressTrackedGameId
  name: string
  unitLabel: string
  build: (plays: BggPlay[], username: string) => { plays: number; completedCount: number; totalCount: number }
}

function sumQuantities<T extends { quantity: number }>(entries: readonly T[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0)
}

function getEntriesForTrackedGame(plays: BggPlay[], username: string, gameId: ProgressTrackedGameId) {
  switch (gameId) {
    case 'arkhamHorrorLcg':
      return getArkhamHorrorLcgEntries(plays, username)
    case 'earthborneRangers':
      return getEarthborneRangersEntries(plays, username)
    case 'isofarianGuard':
      return getIsofarianGuardEntries(plays, username)
    case 'kingdomsForlorn':
      return getKingdomsForlornEntries(plays, username)
    case 'oathsworn':
      return getOathswornEntries(plays, username)
    case 'robinHood':
      return getRobinHoodEntries(plays, username)
    case 'taintedGrail':
      return getTaintedGrailEntries(plays, username)
    case 'robinsonCrusoe':
      return getRobinsonCrusoeEntries(plays, username)
    case 'mageKnight':
      return getMageKnightEntries(plays, username)
    case 'undauntedNormandy':
      return getUndauntedNormandyEntries(plays, username)
    case 'paleo':
      return getPaleoEntries(plays, username)
  }
}

function summarizePlayHours(
  entries: ReadonlyArray<{ play: BggPlay; quantity: number }>,
  assumedMinutesByObjectId: ReadonlyMap<string, number>,
): { hours: number; hasAssumedHours: boolean } {
  let hours = 0
  let hasAssumedHours = false

  for (const entry of entries) {
    const assumedMinutesPerPlay = entry.play.item?.attributes.objectid
      ? assumedMinutesByObjectId.get(entry.play.item.attributes.objectid)
      : undefined
    const resolved = totalPlayMinutesWithAssumption({
      attributes: entry.play.attributes,
      quantity: entry.quantity,
      assumedMinutesPerPlay,
    })
    hours += resolved.minutes / 60
    hasAssumedHours ||= resolved.assumed
  }

  return { hours, hasAssumedHours }
}

function countKnownCoverage(values: readonly string[], knownValues: readonly string[]): number {
  const known = new Set(knownValues)
  return new Set(values.map((value) => value.trim()).filter((value) => known.has(value))).size
}

function buildProgressLabel(completedCount: number, totalCount: number, unitLabel: string): string {
  return `${completedCount.toLocaleString()} / ${totalCount.toLocaleString()} ${unitLabel}`
}

const CAMPAIGN_PROGRESS_DEFINITIONS: ReadonlyArray<CampaignProgressDefinition> = [
  {
    id: 'arkhamHorrorLcg',
    name: 'Arkham Horror LCG',
    unitLabel: 'scenarios',
    build: (plays, username) => {
      const entries = getArkhamHorrorLcgEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.scenario),
          arkhamHorrorLcgContent.scenarios,
        ),
        totalCount: arkhamHorrorLcgContent.scenarios.length,
      }
    },
  },
  {
    id: 'earthborneRangers',
    name: 'Earthborne Rangers',
    unitLabel: 'days',
    build: (plays, username) => {
      const entries = getEarthborneRangersEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.day),
          earthborneRangersContent.days,
        ),
        totalCount: earthborneRangersContent.days.length,
      }
    },
  },
  {
    id: 'isofarianGuard',
    name: 'Isofarian Guard',
    unitLabel: 'chapters',
    build: (plays, username) => {
      const entries = getIsofarianGuardEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.chapter),
          isofarianGuardContent.chapters,
        ),
        totalCount: isofarianGuardContent.chapters.length,
      }
    },
  },
  {
    id: 'kingdomsForlorn',
    name: 'Kingdoms Forlorn',
    unitLabel: kingdomsForlornContent.quests.length > 0 ? 'quest steps' : 'campaign steps',
    build: (plays, username) => {
      const entries = getKingdomsForlornEntries(plays, username)
      const knownValues =
        kingdomsForlornContent.quests.length > 0
          ? kingdomsForlornContent.campaigns.flatMap((campaign) =>
              kingdomsForlornContent.quests.map((quest) => `${campaign}|||${quest}`),
            )
          : kingdomsForlornContent.campaigns.flatMap((campaign) =>
              kingdomsForlornContent.kingdoms.map((kingdom) => `${campaign}|||${kingdom}`),
            )
      const observedValues =
        kingdomsForlornContent.quests.length > 0
          ? entries
              .filter((entry) => entry.campaign && entry.quest)
              .map((entry) => `${entry.campaign}|||${entry.quest}`)
          : entries
              .filter((entry) => entry.campaign && entry.kingdom)
              .map((entry) => `${entry.campaign}|||${entry.kingdom}`)

      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(observedValues, knownValues),
        totalCount: knownValues.length,
      }
    },
  },
  {
    id: 'oathsworn',
    name: 'Oathsworn',
    unitLabel: 'encounters',
    build: (plays, username) => {
      const entries = getOathswornEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.encounter),
          oathswornContent.encounters,
        ),
        totalCount: oathswornContent.encounters.length,
      }
    },
  },
  {
    id: 'robinHood',
    name: 'Robin Hood',
    unitLabel: 'adventures',
    build: (plays, username) => {
      const entries = getRobinHoodEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.adventure),
          robinHoodContent.adventures,
        ),
        totalCount: robinHoodContent.adventures.length,
      }
    },
  },
  {
    id: 'taintedGrail',
    name: 'Tainted Grail',
    unitLabel: 'chapters',
    build: (plays, username) => {
      const entries = getTaintedGrailEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.chapter),
          taintedGrailContent.chapters,
        ),
        totalCount: taintedGrailContent.chapters.length,
      }
    },
  },
  {
    id: 'robinsonCrusoe',
    name: 'Robinson Crusoe',
    unitLabel: 'scenarios',
    build: (plays, username) => {
      const entries = getRobinsonCrusoeEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.scenario),
          robinsonCrusoeContent.scenarios,
        ),
        totalCount: robinsonCrusoeContent.scenarios.length,
      }
    },
  },
  {
    id: 'mageKnight',
    name: 'Mage Knight',
    unitLabel: 'scenarios',
    build: (plays, username) => {
      const entries = getMageKnightEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.scenario || ''),
          mageKnightContent.scenarios,
        ),
        totalCount: mageKnightContent.scenarios.length,
      }
    },
  },
  {
    id: 'undauntedNormandy',
    name: 'Undaunted: Normandy',
    unitLabel: 'scenarios',
    build: (plays, username) => {
      const entries = getUndauntedNormandyEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.scenario),
          undauntedNormandyContent.scenarios,
        ),
        totalCount: undauntedNormandyContent.scenarios.length,
      }
    },
  },
  {
    id: 'paleo',
    name: 'Paleo',
    unitLabel: 'scenarios',
    build: (plays, username) => {
      const entries = getPaleoEntries(plays, username)
      return {
        plays: sumQuantities(entries),
        completedCount: countKnownCoverage(
          entries.map((entry) => entry.scenario),
          paleoContent.scenarios,
        ),
        totalCount: paleoContent.scenarios.length,
      }
    },
  },
]

export function buildCampaignProgressRows(
  plays: BggPlay[],
  username: string,
  assumedMinutesByObjectId: ReadonlyMap<string, number>,
): CampaignProgressRow[] {
  return CAMPAIGN_PROGRESS_DEFINITIONS.map((definition) => {
    const counts = definition.build(plays, username)
    const hoursSummary = summarizePlayHours(
      getEntriesForTrackedGame(plays, username, definition.id),
      assumedMinutesByObjectId,
    )
    const totalCount = Math.max(0, counts.totalCount)
    const completedCount = Math.min(Math.max(0, counts.completedCount), totalCount)
    const progress = totalCount > 0 ? completedCount / totalCount : 0

    return {
      id: definition.id,
      name: definition.name,
      plays: counts.plays,
      hours: hoursSummary.hours,
      hasAssumedHours: hoursSummary.hasAssumedHours,
      completedCount,
      totalCount,
      remainingCount: Math.max(0, totalCount - completedCount),
      progress,
      progressLabel: buildProgressLabel(completedCount, totalCount, definition.unitLabel),
    }
  })
}
