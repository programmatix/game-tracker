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
import { getOathswornEntries } from './oathswornEntries'
import { oathswornContent } from './content'

function playSummary(entry: ReturnType<typeof getOathswornEntries>[number]): string {
  const party = entry.myCharacters.length > 0 ? entry.myCharacters.join(' + ') : 'Unknown party'
  return `${entry.story} • ${entry.encounter} • ${party}`
}

export function computeOathswornAchievements(plays: BggPlay[], username: string) {
  const entries = getOathswornEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const stories = buildCanonicalCounts({
    preferredItems: oathswornContent.stories.map((story) => buildAchievementItem(story)),
    observed: entries
      .filter((entry) => entry.story !== 'Unknown story')
      .map((entry) => ({ item: buildAchievementItem(entry.story), amount: entry.quantity })),
  })

  const storyWins = buildCanonicalCounts({
    preferredItems: oathswornContent.stories.map((story) => buildAchievementItem(story)),
    observed: entries
      .filter((entry) => entry.story !== 'Unknown story')
      .map((entry) => ({
        item: buildAchievementItem(entry.story),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const encounters = buildCanonicalCounts({
    preferredItems: oathswornContent.encounters.map((encounter) => buildAchievementItem(encounter)),
    observed: entries
      .filter((entry) => entry.encounter !== 'Unknown encounter')
      .map((entry) => ({ item: buildAchievementItem(entry.encounter), amount: entry.quantity })),
  })

  const encounterWins = buildCanonicalCounts({
    preferredItems: oathswornContent.encounters.map((encounter) => buildAchievementItem(encounter)),
    observed: entries
      .filter((entry) => entry.encounter !== 'Unknown encounter')
      .map((entry) => ({
        item: buildAchievementItem(entry.encounter),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const characters = buildCanonicalCounts({
    preferredItems: oathswornContent.characters.map((character) => buildAchievementItem(character)),
    observed: entries.flatMap((entry) =>
      entry.myCharacters.map((character) => ({
        item: buildAchievementItem(character),
        amount: entry.quantity,
      })),
    ),
  })

  const characterWins = buildCanonicalCounts({
    preferredItems: oathswornContent.characters.map((character) => buildAchievementItem(character)),
    observed: entries.flatMap((entry) =>
      entry.myCharacters.map((character) => ({
        item: buildAchievementItem(character),
        amount: entry.isWin ? entry.quantity : 0,
      })),
    ),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(oathswornContent.characterBoxByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .map((entry) => {
        const box =
          oathswornContent.storyBoxByName.get(entry.story) ||
          oathswornContent.encounterBoxByName.get(entry.encounter)
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
        return buildCompletionFromPlay(entry.play, playSummary(entry))
      },
    },
  ]

  if (stories.items.length > 0) {
    const labelById = new Map(stories.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'storyPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'story'),
        verb: 'Play',
        itemNoun: 'story chapter',
        unitSingular: 'time',
        items: stories.items,
        countsByItemId: stories.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'storyPlays',
        verb: 'Play',
        itemNoun: 'story chapter',
        unitSingular: 'time',
        items: stories.items,
        countsByItemId: stories.countsByItemId,
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
              predicate: (e) => normalizeKey(e.story) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, playSummary(entry))
          },
        }
      }),
    )
  }

  if (storyWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'storyWins',
        achievementBaseId: 'defeat-each-story',
        verb: 'Defeat',
        itemNoun: 'story chapter',
        unitSingular: 'win',
        items: storyWins.items,
        countsByItemId: storyWins.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (encounters.items.length > 0) {
    const labelById = new Map(encounters.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'encounterPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'encounter'),
        verb: 'Play',
        itemNoun: 'encounter chapter',
        unitSingular: 'time',
        items: encounters.items,
        countsByItemId: encounters.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'encounterPlays',
        verb: 'Play',
        itemNoun: 'encounter chapter',
        unitSingular: 'time',
        items: encounters.items,
        countsByItemId: encounters.countsByItemId,
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
              predicate: (e) => normalizeKey(e.encounter) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, playSummary(entry))
          },
        }
      }),
    )
  }

  if (encounterWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'encounterWins',
        achievementBaseId: 'defeat-each-encounter',
        verb: 'Defeat',
        itemNoun: 'encounter chapter',
        unitSingular: 'win',
        items: encounterWins.items,
        countsByItemId: encounterWins.countsByItemId,
        levels: [1, 3, 10],
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
            return buildCompletionFromPlay(entry.play, `${entry.story} • ${entry.encounter} • ${label}`)
          },
        }
      }),
    )
  }

  if (characterWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'characterWins',
        achievementBaseId: 'defeat-with-each-character',
        verb: 'Defeat',
        itemNoun: 'character',
        unitSingular: 'win',
        items: characterWins.items,
        countsByItemId: characterWins.countsByItemId,
        levels: [1, 3, 10],
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
    gameId: 'oathsworn',
    gameName: 'Oathsworn: Into the Deepwood',
    tracks,
  })
}
