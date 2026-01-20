import type { BggPlay } from '../bgg'
import type { Achievement } from './types'
import { computeDeathMayDieAchievements } from '../games/death-may-die/achievements'
import { computeFinalGirlAchievements } from '../games/final-girl/achievements'
import { computeMistfallAchievements } from '../games/mistfall/achievements'
import { computeSpiritIslandAchievements } from '../games/spirit-island/achievements'
import { computeBulletAchievements } from '../games/bullet/achievements'

export type GameId = 'finalGirl' | 'spiritIsland' | 'mistfall' | 'deathMayDie' | 'bullet'

export type GameAchievementSummary = {
  gameId: GameId
  gameName: string
  achievements: Achievement[]
}

export function computeGameAchievements(gameId: GameId, plays: BggPlay[], username: string) {
  if (gameId === 'finalGirl') return computeFinalGirlAchievements(plays, username)
  if (gameId === 'spiritIsland') return computeSpiritIslandAchievements(plays, username)
  if (gameId === 'mistfall') return computeMistfallAchievements(plays, username)
  if (gameId === 'deathMayDie') return computeDeathMayDieAchievements(plays, username)
  if (gameId === 'bullet') return computeBulletAchievements(plays, username)
  return []
}

export function computeAllGameAchievementSummaries(
  plays: BggPlay[],
  username: string,
): GameAchievementSummary[] {
  const summaries: GameAchievementSummary[] = [
    { gameId: 'finalGirl', gameName: 'Final Girl', achievements: computeFinalGirlAchievements(plays, username) },
    { gameId: 'spiritIsland', gameName: 'Spirit Island', achievements: computeSpiritIslandAchievements(plays, username) },
    { gameId: 'mistfall', gameName: 'Mistfall', achievements: computeMistfallAchievements(plays, username) },
    { gameId: 'deathMayDie', gameName: 'Cthulhu: Death May Die', achievements: computeDeathMayDieAchievements(plays, username) },
    { gameId: 'bullet', gameName: 'Bullet', achievements: computeBulletAchievements(plays, username) },
  ]

  return summaries
}
