import type { BggPlay } from './bgg'
import type { GameTab } from './gameCatalog'
import { getArkhamHorrorLcgEntries } from './games/arkham-horror-lcg/arkhamHorrorLcgEntries'
import { arkhamHorrorLcgContent } from './games/arkham-horror-lcg/content'
import {
  getEarthborneRangersEntries,
} from './games/earthborne-rangers/earthborneRangersEntries'
import { earthborneRangersContent } from './games/earthborne-rangers/content'
import { getIsofarianGuardEntries } from './games/isofarian-guard/isofarianGuardEntries'
import { isofarianGuardContent } from './games/isofarian-guard/content'
import {
  getKingdomsForlornEntries,
} from './games/kingdoms-forlorn/kingdomsForlornEntries'
import { kingdomsForlornContent } from './games/kingdoms-forlorn/content'
import { getOathswornEntries } from './games/oathsworn/oathswornEntries'
import { oathswornContent } from './games/oathsworn/content'
import { getRobinHoodEntries } from './games/robin-hood/robinHoodEntries'
import { robinHoodContent } from './games/robin-hood/content'
import { getTaintedGrailEntries } from './games/tainted-grail/taintedGrailEntries'
import { taintedGrailContent } from './games/tainted-grail/content'

export const CAMPAIGN_GAME_IDS = [
  'arkhamHorrorLcg',
  'earthborneRangers',
  'isofarianGuard',
  'kingdomsForlorn',
  'oathsworn',
  'robinHood',
  'taintedGrail',
] as const satisfies ReadonlyArray<GameTab>

export type CampaignGameId = (typeof CAMPAIGN_GAME_IDS)[number]

export type CampaignProgressRow = {
  id: CampaignGameId
  name: string
  plays: number
  completedCount: number
  totalCount: number
  remainingCount: number
  progress: number
  progressLabel: string
}

type CampaignProgressDefinition = {
  id: CampaignGameId
  name: string
  unitLabel: string
  build: (plays: BggPlay[], username: string) => { plays: number; completedCount: number; totalCount: number }
}

function sumQuantities<T extends { quantity: number }>(entries: readonly T[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0)
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
    unitLabel: kingdomsForlornContent.quests.length > 0 ? 'quests' : 'kingdoms',
    build: (plays, username) => {
      const entries = getKingdomsForlornEntries(plays, username)
      const knownValues =
        kingdomsForlornContent.quests.length > 0
          ? kingdomsForlornContent.quests
          : kingdomsForlornContent.kingdoms
      const observedValues =
        kingdomsForlornContent.quests.length > 0
          ? entries.map((entry) => entry.quest || '')
          : entries.map((entry) => entry.kingdom)

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
]

export function buildCampaignProgressRows(
  plays: BggPlay[],
  username: string,
): CampaignProgressRow[] {
  return CAMPAIGN_PROGRESS_DEFINITIONS.map((definition) => {
    const counts = definition.build(plays, username)
    const totalCount = Math.max(0, counts.totalCount)
    const completedCount = Math.min(Math.max(0, counts.completedCount), totalCount)
    const progress = totalCount > 0 ? completedCount / totalCount : 0

    return {
      id: definition.id,
      name: definition.name,
      plays: counts.plays,
      completedCount,
      totalCount,
      remainingCount: Math.max(0, totalCount - completedCount),
      progress,
      progressLabel: buildProgressLabel(completedCount, totalCount, definition.unitLabel),
    }
  })
}
