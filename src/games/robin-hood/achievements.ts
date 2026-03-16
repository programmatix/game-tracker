import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildIndividualItemTracks,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { robinHoodContent } from './content'
import { getRobinHoodEntries } from './robinHoodEntries'

export function computeRobinHoodAchievements(plays: BggPlay[], username: string) {
  const entries = getRobinHoodEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const adventures = buildCanonicalCounts({
    preferredItems: robinHoodContent.adventures.map((adventure) => buildAchievementItem(adventure)),
    observed: entries
      .filter((entry) => entry.adventure !== 'Unknown adventure')
      .map((entry) => ({ item: buildAchievementItem(entry.adventure), amount: entry.quantity })),
  })

  const adventureWins = buildCanonicalCounts({
    preferredItems: robinHoodContent.adventures.map((adventure) => buildAchievementItem(adventure)),
    observed: entries
      .filter((entry) => entry.adventure !== 'Unknown adventure')
      .map((entry) => ({
        item: buildAchievementItem(entry.adventure),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const characters = buildCanonicalCounts({
    preferredItems: robinHoodContent.characters.map((character) => buildAchievementItem(character)),
    observed: entries.flatMap((entry) =>
      entry.myCharacters.map((character) => ({
        item: buildAchievementItem(character),
        amount: entry.quantity,
      })),
    ),
  })

  const characterWins = buildCanonicalCounts({
    preferredItems: robinHoodContent.characters.map((character) => buildAchievementItem(character)),
    observed: entries.flatMap((entry) =>
      entry.myCharacters.map((character) => ({
        item: buildAchievementItem(character),
        amount: entry.isWin ? entry.quantity : 0,
      })),
    ),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(robinHoodContent.adventureBoxByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .map((entry) => {
        const box = robinHoodContent.adventureBoxByName.get(entry.adventure)
        return box ? { item: buildAchievementItem(box), amount: entry.quantity } : null
      })
      .filter((row): row is { item: { id: string; label: string }; amount: number } => Boolean(row)),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        const party = entry.myCharacters.length > 0 ? entry.myCharacters.join(' + ') : 'Unknown party'
        return buildCompletionFromPlay(entry.play, `${entry.adventure} • ${party}`)
      },
    },
  ]

  if (adventures.items.length > 0) {
    const labelById = new Map(adventures.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'adventurePlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'adventure'),
        verb: 'Play',
        itemNoun: 'adventure',
        unitSingular: 'time',
        items: adventures.items,
        countsByItemId: adventures.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'adventurePlays',
        verb: 'Play',
        itemNoun: 'adventure',
        unitSingular: 'time',
        items: adventures.items,
        countsByItemId: adventures.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? labelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.adventure) === labelKey,
            })
            if (!entry) return undefined
            const party = entry.myCharacters.length > 0 ? entry.myCharacters.join(' + ') : 'Unknown party'
            return buildCompletionFromPlay(entry.play, `${entry.adventure} • ${party}`)
          },
        }
      }),
    )
  }

  if (adventureWins.items.length > 0) {
    const labelById = new Map(adventureWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      ...buildIndividualItemTracks({
        trackIdPrefix: 'adventureWins',
        verb: 'Defeat',
        itemNoun: 'adventure',
        unitSingular: 'time',
        items: adventureWins.items,
        countsByItemId: adventureWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? labelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetWins: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetWins,
              predicate: (e) => e.isWin && normalizeKey(e.adventure) === labelKey,
            })
            if (!entry) return undefined
            const party = entry.myCharacters.length > 0 ? entry.myCharacters.join(' + ') : 'Unknown party'
            return buildCompletionFromPlay(entry.play, `${entry.adventure} • ${party}`)
          },
        }
      }),
    )
  }

  if (characters.items.length > 0) {
    const labelById = new Map(characters.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'characterPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'character'),
        verb: 'Play',
        itemNoun: 'character',
        unitSingular: 'time',
        items: characters.items,
        countsByItemId: characters.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'characterPlays',
        verb: 'Play',
        itemNoun: 'character',
        unitSingular: 'time',
        items: characters.items,
        countsByItemId: characters.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? labelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => e.myCharacters.some((character) => normalizeKey(character) === labelKey),
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.adventure} • ${label}`)
          },
        }
      }),
    )
  }

  if (characterWins.items.length > 0) {
    const labelById = new Map(characterWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      ...buildIndividualItemTracks({
        trackIdPrefix: 'characterWins',
        verb: 'Defeat',
        itemNoun: 'character',
        unitSingular: 'time',
        items: characterWins.items,
        countsByItemId: characterWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? labelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetWins: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetWins,
              predicate: (e) =>
                e.isWin && e.myCharacters.some((character) => normalizeKey(character) === labelKey),
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.adventure} • ${label}`)
          },
        }
      }),
    )
  }

  if (boxCounts.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'boxPlays',
        achievementBaseId: 'play-each-box',
        verb: 'Play',
        itemNoun: 'box',
        unitSingular: 'time',
        items: boxCounts.items,
        countsByItemId: boxCounts.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'robinHood',
    gameName: 'The Adventures of Robin Hood',
    tracks,
  })
}
