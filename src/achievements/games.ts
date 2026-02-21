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
import type { SpiritIslandSession } from '../games/spirit-island/mindwanderer'

export type GameId =
  | 'finalGirl'
  | 'spiritIsland'
  | 'mistfall'
  | 'deathMayDie'
  | 'bullet'
  | 'tooManyBones'
  | 'skytearHorde'
  | 'unsettled'
  | 'mageKnight'

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
  if (gameId === 'unsettled') return computeUnsettledAchievements(plays, username)
  if (gameId === 'mageKnight') return computeMageKnightAchievements(plays, username)
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
    { gameId: 'unsettled', gameName: 'Unsettled', achievements: computeUnsettledAchievements(plays, username) },
    { gameId: 'mageKnight', gameName: 'Mage Knight', achievements: computeMageKnightAchievements(plays, username) },
  ]

  return summaries
}
