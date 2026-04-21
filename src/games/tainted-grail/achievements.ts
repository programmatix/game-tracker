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
  buildPerItemTypeLabel,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { taintedGrailContent } from './content'
import { getTaintedGrailEntries } from './taintedGrailEntries'

export function computeTaintedGrailAchievements(plays: BggPlay[], username: string) {
  const entries = getTaintedGrailEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const chapterPlays = buildCanonicalCounts({
    preferredItems: taintedGrailContent.chapters.map((chapter) => buildAchievementItem(chapter)),
    observed: entries
      .filter((entry) => entry.chapter !== 'Unknown chapter')
      .map((entry) => ({ item: buildAchievementItem(entry.chapter), amount: entry.quantity })),
  })

  const chapterWins = buildCanonicalCounts({
    preferredItems: taintedGrailContent.chapters.map((chapter) => buildAchievementItem(chapter)),
    observed: entries
      .filter((entry) => entry.chapter !== 'Unknown chapter')
      .map((entry) => ({
        item: buildAchievementItem(entry.chapter),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(taintedGrailContent.chapterBoxByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .map((entry) => {
        const box = taintedGrailContent.chapterBoxByName.get(entry.chapter)
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
        return buildCompletionFromPlay(entry.play, entry.chapter)
      },
    },
  ]

  if (chapterPlays.items.length > 0) {
    const labelById = new Map(chapterPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'chapterPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'chapter'),
        verb: 'Play',
        itemNoun: 'chapter',
        unitSingular: 'time',
        items: chapterPlays.items,
        countsByItemId: chapterPlays.countsByItemId,
        levels: [1, 3, 10],
        typeLabel: buildPerItemTypeLabel('Play', 'chapter', 'time'),
        futureLevelsToShow: 5,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'chapterPlays',
        verb: 'Play',
        itemNoun: 'chapter',
        unitSingular: 'time',
        items: chapterPlays.items,
        countsByItemId: chapterPlays.countsByItemId,
        levels: [1, 3, 10],
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
              predicate: (candidate) =>
                candidate.chapter !== 'Unknown chapter' &&
                normalizeKey(candidate.chapter) === labelKey,
            })
            return entry ? buildCompletionFromPlay(entry.play, entry.chapter) : undefined
          },
        }
      }),
    )
  }

  if (chapterWins.items.length > 0) {
    const labelById = new Map(chapterWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'chapterWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'chapter'),
        verb: 'Defeat',
        itemNoun: 'chapter',
        unitSingular: 'win',
        items: chapterWins.items,
        countsByItemId: chapterWins.countsByItemId,
        levels: [1, 3, 10],
        typeLabel: buildPerItemTypeLabel('Defeat', 'chapter', 'win'),
        futureLevelsToShow: 5,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'chapterWins',
        verb: 'Defeat',
        itemNoun: 'chapter',
        unitSingular: 'win',
        items: chapterWins.items,
        countsByItemId: chapterWins.countsByItemId,
        levels: [1, 3, 10],
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
              predicate: (candidate) =>
                candidate.isWin &&
                candidate.chapter !== 'Unknown chapter' &&
                normalizeKey(candidate.chapter) === labelKey,
            })
            return entry ? buildCompletionFromPlay(entry.play, entry.chapter) : undefined
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
    gameId: 'taintedGrail',
    gameName: 'Tainted Grail',
    tracks,
  })
}
