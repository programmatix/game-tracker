import { findConfigurableGameIdForOptions } from './configurableGameMatching'
import { isGameTab, type GameTab } from './gameCatalog'

export function findGameTabForOptions(input: {
  gameId?: string | null
  name?: string | null
  objectId?: string | null
}): GameTab | null {
  const matched = findConfigurableGameIdForOptions(input)
  return matched && isGameTab(matched) ? matched : null
}
