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
import { computeNanolithAchievements } from '../games/nanolith/achievements'
import type { SpiritIslandSession } from '../games/spirit-island/mindwanderer'
import { shouldCalculateAchievementsForGame } from '../gamePreferences'
import { computeStandardAchievementsForGame } from './standard'

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
  | 'nanolith'

export type GameAchievementSummary = {
  gameId: GameId
  gameName: string
  achievements: Achievement[]
}

export type ComputeAchievementsOptions = {
  spiritIslandSessions?: SpiritIslandSession[]
}

function withStandardAchievements(
  gameId: GameId,
  gameName: string,
  plays: BggPlay[],
  achievements: Achievement[],
): Achievement[] {
  return [
    ...achievements,
    ...computeStandardAchievementsForGame({
      gameId,
      gameName,
      plays,
    }),
  ]
}

export function computeGameAchievements(
  gameId: GameId,
  plays: BggPlay[],
  username: string,
  options?: ComputeAchievementsOptions,
) {
  if (!shouldCalculateAchievementsForGame(gameId)) return []

  if (gameId === 'finalGirl')
    return withStandardAchievements(gameId, 'Final Girl', plays, computeFinalGirlAchievements(plays, username))
  if (gameId === 'spiritIsland')
    return withStandardAchievements(
      gameId,
      'Spirit Island',
      plays,
      computeSpiritIslandAchievements(plays, username, options?.spiritIslandSessions),
    )
  if (gameId === 'mistfall')
    return withStandardAchievements(gameId, 'Mistfall', plays, computeMistfallAchievements(plays, username))
  if (gameId === 'deathMayDie')
    return withStandardAchievements(
      gameId,
      'Cthulhu: Death May Die',
      plays,
      computeDeathMayDieAchievements(plays, username),
    )
  if (gameId === 'bullet')
    return withStandardAchievements(gameId, 'Bullet', plays, computeBulletAchievements(plays, username))
  if (gameId === 'tooManyBones')
    return withStandardAchievements(
      gameId,
      'Too Many Bones',
      plays,
      computeTooManyBonesAchievements(plays, username),
    )
  if (gameId === 'skytearHorde')
    return withStandardAchievements(
      gameId,
      'Skytear Horde',
      plays,
      computeSkytearHordeAchievements(plays, username),
    )
  if (gameId === 'cloudspire')
    return withStandardAchievements(
      gameId,
      'Cloudspire',
      plays,
      computeCloudspireAchievements(plays, username),
    )
  if (gameId === 'burncycle')
    return withStandardAchievements(gameId, 'burncycle', plays, computeBurncycleAchievements(plays, username))
  if (gameId === 'paleo')
    return withStandardAchievements(gameId, 'Paleo', plays, computePaleoAchievements(plays, username))
  if (gameId === 'robinsonCrusoe')
    return withStandardAchievements(
      gameId,
      'Robinson Crusoe',
      plays,
      computeRobinsonCrusoeAchievements(plays, username),
    )
  if (gameId === 'robinHood')
    return withStandardAchievements(
      gameId,
      'The Adventures of Robin Hood',
      plays,
      computeRobinHoodAchievements(plays, username),
    )
  if (gameId === 'earthborneRangers')
    return withStandardAchievements(
      gameId,
      'Earthborne Rangers',
      plays,
      computeEarthborneRangersAchievements(plays, username),
    )
  if (gameId === 'deckers')
    return withStandardAchievements(gameId, 'Deckers', plays, computeDeckersAchievements(plays, username))
  if (gameId === 'elderScrolls')
    return withStandardAchievements(
      gameId,
      'The Elder Scrolls: Betrayal of the Second Era',
      plays,
      computeElderScrollsAchievements(plays, username),
    )
  if (gameId === 'starTrekCaptainsChair')
    return withStandardAchievements(
      gameId,
      "Star Trek: Captain's Chair",
      plays,
      computeStarTrekCaptainsChairAchievements(plays, username),
    )
  if (gameId === 'unsettled')
    return withStandardAchievements(
      gameId,
      'Unsettled',
      plays,
      computeUnsettledAchievements(plays, username),
    )
  if (gameId === 'mageKnight')
    return withStandardAchievements(
      gameId,
      'Mage Knight',
      plays,
      computeMageKnightAchievements(plays, username),
    )
  if (gameId === 'mandalorianAdventures')
    return withStandardAchievements(
      gameId,
      'The Mandalorian: Adventures',
      plays,
      computeMandalorianAdventuresAchievements(plays, username),
    )
  if (gameId === 'oathsworn')
    return withStandardAchievements(
      gameId,
      'Oathsworn: Into the Deepwood',
      plays,
      computeOathswornAchievements(plays, username),
    )
  if (gameId === 'taintedGrail')
    return withStandardAchievements(
      gameId,
      'Tainted Grail: The Fall of Avalon',
      plays,
      computeTaintedGrailAchievements(plays, username),
    )
  if (gameId === 'isofarianGuard')
    return withStandardAchievements(
      gameId,
      'The Isofarian Guard',
      plays,
      computeIsofarianGuardAchievements(plays, username),
    )
  if (gameId === 'arkhamHorrorLcg')
    return withStandardAchievements(
      gameId,
      'Arkham Horror: The Card Game',
      plays,
      computeArkhamHorrorLcgAchievements(plays, username),
    )
  if (gameId === 'kingdomsForlorn')
    return withStandardAchievements(
      gameId,
      'Kingdoms Forlorn',
      plays,
      computeKingdomsForlornAchievements(plays, username),
    )
  if (gameId === 'nanolith')
    return withStandardAchievements(gameId, 'Nanolith', plays, computeNanolithAchievements(plays, username))
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
    summaries.push({
      gameId,
      gameName,
      achievements: withStandardAchievements(gameId, gameName, plays, compute()),
    })
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
  maybePush('nanolith', 'Nanolith', () => computeNanolithAchievements(plays, username))

  return summaries
}
