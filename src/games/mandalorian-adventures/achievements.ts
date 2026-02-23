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
import { mandalorianAdventuresContent } from './content'
import { getMandalorianAdventuresEntries } from './mandalorianAdventuresEntries'

export function computeMandalorianAdventuresAchievements(plays: BggPlay[], username: string) {
  const entries = getMandalorianAdventuresEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const missions = buildCanonicalCounts({
    preferredItems: mandalorianAdventuresContent.missions.map((mission) => buildAchievementItem(mission)),
    observed: entries.map((entry) => ({ item: buildAchievementItem(entry.mission), amount: entry.quantity })),
  })

  const missionWins = buildCanonicalCounts({
    preferredItems: mandalorianAdventuresContent.missions.map((mission) => buildAchievementItem(mission)),
    observed: entries.map((entry) => ({
      item: buildAchievementItem(entry.mission),
      amount: entry.isWin ? entry.quantity : 0,
    })),
  })

  const characters = buildCanonicalCounts({
    preferredItems: mandalorianAdventuresContent.characters.map((character) =>
      buildAchievementItem(character),
    ),
    observed: entries.flatMap((entry) =>
      entry.myCharacters.map((character) => ({
        item: buildAchievementItem(character),
        amount: entry.quantity,
      })),
    ),
  })

  const characterWins = buildCanonicalCounts({
    preferredItems: mandalorianAdventuresContent.characters.map((character) =>
      buildAchievementItem(character),
    ),
    observed: entries.flatMap((entry) =>
      entry.myCharacters.map((character) => ({
        item: buildAchievementItem(character),
        amount: entry.isWin ? entry.quantity : 0,
      })),
    ),
  })

  const encounters = buildCanonicalCounts({
    preferredItems: mandalorianAdventuresContent.encounters.map((encounter) =>
      buildAchievementItem(encounter),
    ),
    observed: entries
      .filter((entry) => Boolean(entry.encounter))
      .map((entry) => ({ item: buildAchievementItem(entry.encounter!), amount: entry.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        const chars = entry.myCharacters.length > 0 ? entry.myCharacters.join(' + ') : 'Unknown crew'
        return buildCompletionFromPlay(entry.play, `${entry.mission} • ${chars}`)
      },
    },
  ]

  if (missions.items.length > 0) {
    const missionLabelById = new Map(missions.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'missionPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'mission'),
        verb: 'Play',
        itemNoun: 'mission',
        unitSingular: 'time',
        items: missions.items,
        countsByItemId: missions.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'missionPlays',
        verb: 'Play',
        itemNoun: 'mission',
        unitSingular: 'time',
        items: missions.items,
        countsByItemId: missions.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? missionLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.mission) === labelKey,
            })
            if (!entry) return undefined
            const chars = entry.myCharacters.length > 0 ? entry.myCharacters.join(' + ') : 'Unknown crew'
            return buildCompletionFromPlay(entry.play, `${entry.mission} • ${chars}`)
          },
        }
      }),
    )
  }

  if (missionWins.items.length > 0) {
    const missionWinLabelById = new Map(missionWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      ...buildIndividualItemTracks({
        trackIdPrefix: 'missionWins',
        verb: 'Defeat',
        itemNoun: 'mission',
        unitSingular: 'win',
        items: missionWins.items,
        countsByItemId: missionWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? missionWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && normalizeKey(e.mission) === labelKey,
            })
            if (!entry) return undefined
            const chars = entry.myCharacters.length > 0 ? entry.myCharacters.join(' + ') : 'Unknown crew'
            return buildCompletionFromPlay(entry.play, `${entry.mission} • ${chars}`)
          },
        }
      }),
    )
  }

  if (characters.items.length > 0) {
    const characterLabelById = new Map(characters.items.map((item) => [item.id, item.label]))
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
        const label = itemId ? characterLabelById.get(itemId) : undefined
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
            return buildCompletionFromPlay(entry.play, `${entry.mission} • ${label}`)
          },
        }
      }),
    )
  }

  if (characterWins.items.length > 0) {
    const characterWinLabelById = new Map(characterWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      ...buildIndividualItemTracks({
        trackIdPrefix: 'characterWins',
        verb: 'Defeat',
        itemNoun: 'character',
        unitSingular: 'win',
        items: characterWins.items,
        countsByItemId: characterWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? characterWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) =>
                e.isWin && e.myCharacters.some((character) => normalizeKey(character) === labelKey),
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.mission} • ${label}`)
          },
        }
      }),
    )
  }

  if (encounters.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'encounterPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'encounter'),
        verb: 'Play',
        itemNoun: 'encounter',
        unitSingular: 'time',
        items: encounters.items,
        countsByItemId: encounters.countsByItemId,
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'mandalorianAdventures',
    gameName: 'The Mandalorian: Adventures',
    tracks,
  })
}
