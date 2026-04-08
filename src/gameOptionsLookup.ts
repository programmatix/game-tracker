import { findConfigurableGameIdForOptions } from './configurableGameMatching'
import { isConfigurableGameId } from './configurableGames'

export function findGameTabForOptions(input: {
  gameId?: string | null
  name?: string | null
  objectId?: string | null
}): string | null {
  const matched = findConfigurableGameIdForOptions(input)
  return matched && isConfigurableGameId(matched) ? matched : null
}
