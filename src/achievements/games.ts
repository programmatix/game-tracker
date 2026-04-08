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
import { shouldCalculateAchievementsForGame } from '../gamePreferences'

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
  if (!shouldCalculateAchievementsForGame(gameId)) return []

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
  const summaries: GameAchievementSummary[] = []
  const maybePush = (
    gameId: GameId,
    gameName: string,
    compute: () => Achievement[],
  ) => {
    if (!shouldCalculateAchievementsForGame(gameId)) return
    summaries.push({ gameId, gameName, achievements: compute() })
  }

  maybePush('finalGirl', 'Final Girl', () => computeFinalGirlAchievements(plays, username))
  maybePush('spiritIsland', 'Spirit Island', () =>
    computeSpiritIslandAchievements(plays, username, options?.spiritIslandSessions),
  )
  maybePush('mistfall', 'Mistfall', () => computeMistfallAchievements(plays, username))
  maybePush('deathMayDie', 'Cthulhu: Death May Die', () =>
    computeDeathMayDieAchievements(plays, username),
  )
  maybePush('bullet', 'Bullet', () => computeBulletAchievements(plays, username))
  maybePush('tooManyBones', 'Too Many Bones', () => computeTooManyBonesAchievements(plays, username))
  maybePush('skytearHorde', 'Skytear Horde', () => computeSkytearHordeAchievements(plays, username))
  maybePush('cloudspire', 'Cloudspire', () => computeCloudspireAchievements(plays, username))
  maybePush('burncycle', 'burncycle', () => computeBurncycleAchievements(plays, username))
  maybePush('paleo', 'Paleo', () => computePaleoAchievements(plays, username))
  maybePush('robinsonCrusoe', 'Robinson Crusoe', () =>
    computeRobinsonCrusoeAchievements(plays, username),
  )
  maybePush('robinHood', 'The Adventures of Robin Hood', () =>
    computeRobinHoodAchievements(plays, username),
  )
  maybePush('earthborneRangers', 'Earthborne Rangers', () =>
    computeEarthborneRangersAchievements(plays, username),
  )
  maybePush('deckers', 'Deckers', () => computeDeckersAchievements(plays, username))
  maybePush('elderScrolls', 'The Elder Scrolls: Betrayal of the Second Era', () =>
    computeElderScrollsAchievements(plays, username),
  )
  maybePush('starTrekCaptainsChair', "Star Trek: Captain's Chair", () =>
    computeStarTrekCaptainsChairAchievements(plays, username),
  )
  maybePush('unsettled', 'Unsettled', () => computeUnsettledAchievements(plays, username))
  maybePush('mageKnight', 'Mage Knight', () => computeMageKnightAchievements(plays, username))
  maybePush('mandalorianAdventures', 'The Mandalorian: Adventures', () =>
    computeMandalorianAdventuresAchievements(plays, username),
  )
  maybePush('oathsworn', 'Oathsworn: Into the Deepwood', () =>
    computeOathswornAchievements(plays, username),
  )
  maybePush('taintedGrail', 'Tainted Grail: The Fall of Avalon', () =>
    computeTaintedGrailAchievements(plays, username),
  )
  maybePush('isofarianGuard', 'The Isofarian Guard', () =>
    computeIsofarianGuardAchievements(plays, username),
  )
  maybePush('arkhamHorrorLcg', 'Arkham Horror: The Card Game', () =>
    computeArkhamHorrorLcgAchievements(plays, username),
  )
  maybePush('kingdomsForlorn', 'Kingdoms Forlorn', () =>
    computeKingdomsForlornAchievements(plays, username),
  )

  return summaries
}
