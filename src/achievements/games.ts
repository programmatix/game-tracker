import type { BggPlay } from '../bgg'
import type { Achievement } from './types'
import { computeDeathMayDieAchievements } from '../games/death-may-die/achievements'
import { computeFinalGirlAchievements } from '../games/final-girl/achievements'
import { computeMistfallAchievements } from '../games/mistfall/achievements'
import { computeSpiritIslandAchievements } from '../games/spirit-island/achievements'
import { computeBulletAchievements } from '../games/bullet/achievements'
import { computeTooManyBonesAchievements } from '../games/too-many-bones/achievements'
import { computeSkytearHordeAchievements } from '../games/skytear-horde/achievements'
import { computeUnsettledAchievements } from '../games/unsettled/achievements'
import { computeMageKnightAchievements } from '../games/mage-knight/achievements'
import { computeMandalorianAdventuresAchievements } from '../games/mandalorian-adventures/achievements'
import { computeCloudspireAchievements } from '../games/cloudspire/achievements'
import { computeBurncycleAchievements } from '../games/burncycle/achievements'
import { computePaleoAchievements } from '../games/paleo/achievements'
import { computeStarTrekCaptainsChairAchievements } from '../games/star-trek-captains-chair/achievements'
import { computeRobinsonCrusoeAchievements } from '../games/robinson-crusoe/achievements'
import { computeRobinHoodAchievements } from '../games/robin-hood/achievements'
import { computeEarthborneRangersAchievements } from '../games/earthborne-rangers/achievements'
import { computeDeckersAchievements } from '../games/deckers/achievements'
import { computeElderScrollsAchievements } from '../games/elder-scrolls/achievements'
import { computeOathswornAchievements } from '../games/oathsworn/achievements'
import { computeTaintedGrailAchievements } from '../games/tainted-grail/achievements'
import { computeIsofarianGuardAchievements } from '../games/isofarian-guard/achievements'
import { computeArkhamHorrorLcgAchievements } from '../games/arkham-horror-lcg/achievements'
import { computeKingdomsForlornAchievements } from '../games/kingdoms-forlorn/achievements'
import type { SpiritIslandSession } from '../games/spirit-island/mindwanderer'

export type GameId =
  | 'finalGirl'
  | 'spiritIsland'
  | 'mistfall'
  | 'deathMayDie'
  | 'bullet'
  | 'tooManyBones'
  | 'skytearHorde'
  | 'cloudspire'
  | 'burncycle'
  | 'paleo'
  | 'robinsonCrusoe'
  | 'robinHood'
  | 'earthborneRangers'
  | 'deckers'
  | 'elderScrolls'
  | 'starTrekCaptainsChair'
  | 'unsettled'
  | 'mageKnight'
  | 'mandalorianAdventures'
  | 'oathsworn'
  | 'taintedGrail'
  | 'isofarianGuard'
  | 'arkhamHorrorLcg'
  | 'kingdomsForlorn'

export type GameAchievementSummary = {
  gameId: GameId
  gameName: string
  achievements: Achievement[]
}

export type ComputeAchievementsOptions = {
  spiritIslandSessions?: SpiritIslandSession[]
}

export function computeGameAchievements(
  gameId: GameId,
  plays: BggPlay[],
  username: string,
  options?: ComputeAchievementsOptions,
) {
  if (gameId === 'finalGirl') return computeFinalGirlAchievements(plays, username)
  if (gameId === 'spiritIsland')
    return computeSpiritIslandAchievements(plays, username, options?.spiritIslandSessions)
  if (gameId === 'mistfall') return computeMistfallAchievements(plays, username)
  if (gameId === 'deathMayDie') return computeDeathMayDieAchievements(plays, username)
  if (gameId === 'bullet') return computeBulletAchievements(plays, username)
  if (gameId === 'tooManyBones') return computeTooManyBonesAchievements(plays, username)
  if (gameId === 'skytearHorde') return computeSkytearHordeAchievements(plays, username)
  if (gameId === 'cloudspire') return computeCloudspireAchievements(plays, username)
  if (gameId === 'burncycle') return computeBurncycleAchievements(plays, username)
  if (gameId === 'paleo') return computePaleoAchievements(plays, username)
  if (gameId === 'robinsonCrusoe') return computeRobinsonCrusoeAchievements(plays, username)
  if (gameId === 'robinHood') return computeRobinHoodAchievements(plays, username)
  if (gameId === 'earthborneRangers') return computeEarthborneRangersAchievements(plays, username)
  if (gameId === 'deckers') return computeDeckersAchievements(plays, username)
  if (gameId === 'elderScrolls') return computeElderScrollsAchievements(plays, username)
  if (gameId === 'starTrekCaptainsChair') return computeStarTrekCaptainsChairAchievements(plays, username)
  if (gameId === 'unsettled') return computeUnsettledAchievements(plays, username)
  if (gameId === 'mageKnight') return computeMageKnightAchievements(plays, username)
  if (gameId === 'mandalorianAdventures')
    return computeMandalorianAdventuresAchievements(plays, username)
  if (gameId === 'oathsworn') return computeOathswornAchievements(plays, username)
  if (gameId === 'taintedGrail') return computeTaintedGrailAchievements(plays, username)
  if (gameId === 'isofarianGuard') return computeIsofarianGuardAchievements(plays, username)
  if (gameId === 'arkhamHorrorLcg') return computeArkhamHorrorLcgAchievements(plays, username)
  if (gameId === 'kingdomsForlorn') return computeKingdomsForlornAchievements(plays, username)
  return []
}

export function computeAllGameAchievementSummaries(
  plays: BggPlay[],
  username: string,
  options?: ComputeAchievementsOptions,
): GameAchievementSummary[] {
  const summaries: GameAchievementSummary[] = [
    { gameId: 'finalGirl', gameName: 'Final Girl', achievements: computeFinalGirlAchievements(plays, username) },
    { gameId: 'spiritIsland', gameName: 'Spirit Island', achievements: computeSpiritIslandAchievements(plays, username, options?.spiritIslandSessions) },
    { gameId: 'mistfall', gameName: 'Mistfall', achievements: computeMistfallAchievements(plays, username) },
    { gameId: 'deathMayDie', gameName: 'Cthulhu: Death May Die', achievements: computeDeathMayDieAchievements(plays, username) },
    { gameId: 'bullet', gameName: 'Bullet', achievements: computeBulletAchievements(plays, username) },
    { gameId: 'tooManyBones', gameName: 'Too Many Bones', achievements: computeTooManyBonesAchievements(plays, username) },
    { gameId: 'skytearHorde', gameName: 'Skytear Horde', achievements: computeSkytearHordeAchievements(plays, username) },
    { gameId: 'cloudspire', gameName: 'Cloudspire', achievements: computeCloudspireAchievements(plays, username) },
    { gameId: 'burncycle', gameName: 'burncycle', achievements: computeBurncycleAchievements(plays, username) },
    { gameId: 'paleo', gameName: 'Paleo', achievements: computePaleoAchievements(plays, username) },
    {
      gameId: 'robinsonCrusoe',
      gameName: 'Robinson Crusoe',
      achievements: computeRobinsonCrusoeAchievements(plays, username),
    },
    {
      gameId: 'robinHood',
      gameName: 'The Adventures of Robin Hood',
      achievements: computeRobinHoodAchievements(plays, username),
    },
    {
      gameId: 'earthborneRangers',
      gameName: 'Earthborne Rangers',
      achievements: computeEarthborneRangersAchievements(plays, username),
    },
    { gameId: 'deckers', gameName: 'Deckers', achievements: computeDeckersAchievements(plays, username) },
    {
      gameId: 'elderScrolls',
      gameName: 'The Elder Scrolls: Betrayal of the Second Era',
      achievements: computeElderScrollsAchievements(plays, username),
    },
    {
      gameId: 'starTrekCaptainsChair',
      gameName: "Star Trek: Captain's Chair",
      achievements: computeStarTrekCaptainsChairAchievements(plays, username),
    },
    { gameId: 'unsettled', gameName: 'Unsettled', achievements: computeUnsettledAchievements(plays, username) },
    { gameId: 'mageKnight', gameName: 'Mage Knight', achievements: computeMageKnightAchievements(plays, username) },
    {
      gameId: 'mandalorianAdventures',
      gameName: 'The Mandalorian: Adventures',
      achievements: computeMandalorianAdventuresAchievements(plays, username),
    },
    {
      gameId: 'oathsworn',
      gameName: 'Oathsworn: Into the Deepwood',
      achievements: computeOathswornAchievements(plays, username),
    },
    {
      gameId: 'taintedGrail',
      gameName: 'Tainted Grail: The Fall of Avalon',
      achievements: computeTaintedGrailAchievements(plays, username),
    },
    {
      gameId: 'isofarianGuard',
      gameName: 'The Isofarian Guard',
      achievements: computeIsofarianGuardAchievements(plays, username),
    },
    {
      gameId: 'arkhamHorrorLcg',
      gameName: 'Arkham Horror: The Card Game',
      achievements: computeArkhamHorrorLcgAchievements(plays, username),
    },
    {
      gameId: 'kingdomsForlorn',
      gameName: 'Kingdoms Forlorn',
      achievements: computeKingdomsForlornAchievements(plays, username),
    },
  ]

  return summaries
}
