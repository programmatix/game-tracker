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
  groupAchievementItemsByLabel,
  slugifyTrackId,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { burncycleContent } from './content'
import { getBurncycleEntries } from './burncycleEntries'

export function computeBurncycleAchievements(plays: BggPlay[], username: string) {
  const entries = getBurncycleEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const botPlays = buildCanonicalCounts({
    preferredItems: burncycleContent.bots.map((bot) => buildAchievementItem(bot)),
    observed: entries
      .filter((e) => e.bot !== 'Unknown bot')
      .map((e) => ({ item: buildAchievementItem(e.bot), amount: e.quantity })),
  })

  const botWins = buildCanonicalCounts({
    preferredItems: burncycleContent.bots.map((bot) => buildAchievementItem(bot)),
    observed: entries
      .filter((e) => e.bot !== 'Unknown bot')
      .map((e) => ({ item: buildAchievementItem(e.bot), amount: e.isWin ? e.quantity : 0 })),
  })

  const corporationPlays = buildCanonicalCounts({
    preferredItems: burncycleContent.corporations.map((corporation) =>
      buildAchievementItem(corporation),
    ),
    observed: entries
      .filter((e) => e.corporation !== 'Unknown corporation')
      .map((e) => ({ item: buildAchievementItem(e.corporation), amount: e.quantity })),
  })

  const corporationWins = buildCanonicalCounts({
    preferredItems: burncycleContent.corporations.map((corporation) =>
      buildAchievementItem(corporation),
    ),
    observed: entries
      .filter((e) => e.corporation !== 'Unknown corporation')
      .map((e) => ({ item: buildAchievementItem(e.corporation), amount: e.isWin ? e.quantity : 0 })),
  })

  const captainPlays = buildCanonicalCounts({
    preferredItems: burncycleContent.captains.map((captain) => buildAchievementItem(captain)),
    observed: entries
      .filter((e) => e.captain !== 'Unknown captain')
      .map((e) => ({ item: buildAchievementItem(e.captain), amount: e.quantity })),
  })

  const captainWins = buildCanonicalCounts({
    preferredItems: burncycleContent.captains.map((captain) => buildAchievementItem(captain)),
    observed: entries
      .filter((e) => e.captain !== 'Unknown captain')
      .map((e) => ({ item: buildAchievementItem(e.captain), amount: e.isWin ? e.quantity : 0 })),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(burncycleContent.botGroupByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .filter((e) => e.bot !== 'Unknown bot')
      .map((e) => {
        const box = burncycleContent.botGroupByName.get(e.bot)
        return box ? { item: buildAchievementItem(box), amount: e.quantity } : null
      })
      .filter((row): row is { item: { id: string; label: string }; amount: number } => Boolean(row)),
  })

  const botCorpMatchupPlays = buildCanonicalCounts({
    preferredItems: burncycleContent.corporations.flatMap((corporation) =>
      burncycleContent.bots.map((bot) => buildAchievementItem(`${corporation} vs ${bot}`)),
    ),
    observed: entries
      .filter((e) => e.bot !== 'Unknown bot' && e.corporation !== 'Unknown corporation')
      .map((e) => ({ item: buildAchievementItem(`${e.corporation} vs ${e.bot}`), amount: e.quantity })),
  })

  const botCorpMatchupWins = buildCanonicalCounts({
    preferredItems: burncycleContent.corporations.flatMap((corporation) =>
      burncycleContent.bots.map((bot) => buildAchievementItem(`${corporation} vs ${bot}`)),
    ),
    observed: entries
      .filter((e) => e.isWin && e.bot !== 'Unknown bot' && e.corporation !== 'Unknown corporation')
      .map((e) => ({ item: buildAchievementItem(`${e.corporation} vs ${e.bot}`), amount: e.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(
          entry.play,
          `${entry.bot} at ${entry.corporation} (${entry.captain})`,
        )
      },
    },
  ]

  if (botPlays.items.length > 0) {
    const labelById = new Map(botPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'botPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'bot'),
        verb: 'Play',
        itemNoun: 'bot',
        unitSingular: 'time',
        items: botPlays.items,
        countsByItemId: botPlays.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'botPlays',
        verb: 'Play',
        itemNoun: 'bot',
        unitSingular: 'time',
        items: botPlays.items,
        countsByItemId: botPlays.countsByItemId,
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
              predicate: (e) => normalizeKey(e.bot) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.bot} at ${entry.corporation}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: botPlays.items,
      groupByItemLabel: burncycleContent.botGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `botPlaysByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-bot-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `bot in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: botPlays.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (botWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'botWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'bot'),
        verb: 'Defeat',
        itemNoun: 'corporation with bot',
        unitSingular: 'win',
        items: botWins.items,
        countsByItemId: botWins.countsByItemId,
      }),
    )
  }

  if (corporationPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'corporationPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'corporation'),
        verb: 'Play',
        itemNoun: 'corporation',
        unitSingular: 'time',
        items: corporationPlays.items,
        countsByItemId: corporationPlays.countsByItemId,
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: corporationPlays.items,
      groupByItemLabel: burncycleContent.corporationGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `corporationPlaysByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-corporation-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `corporation in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: corporationPlays.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (corporationWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'corporationWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'corporation'),
        verb: 'Defeat',
        itemNoun: 'corporation',
        unitSingular: 'win',
        items: corporationWins.items,
        countsByItemId: corporationWins.countsByItemId,
      }),
    )
  }

  if (captainPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'captainPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'captain'),
        verb: 'Play',
        itemNoun: 'captain',
        unitSingular: 'time',
        items: captainPlays.items,
        countsByItemId: captainPlays.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (captainWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'captainWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'captain'),
        verb: 'Defeat',
        itemNoun: 'captain',
        unitSingular: 'win',
        items: captainWins.items,
        countsByItemId: captainWins.countsByItemId,
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

  if (botCorpMatchupPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'botCorporationMatchupPlays',
        achievementBaseId: 'play-each-bot-against-each-corporation',
        verb: 'Play',
        itemNoun: 'bot against each corporation',
        unitSingular: 'time',
        items: botCorpMatchupPlays.items,
        countsByItemId: botCorpMatchupPlays.countsByItemId,
      }),
      {
        ...buildPerItemTrack({
          trackId: 'botCorporationMatchupWins',
          achievementBaseId: 'defeat-each-corporation-with-each-bot',
          verb: 'Defeat',
          itemNoun: 'corporation with each bot',
          unitSingular: 'win',
          items: botCorpMatchupWins.items,
          countsByItemId: botCorpMatchupWins.countsByItemId,
        }),
        achievementBaseId: 'win-with-each-bot-against-each-corporation',
        titleForLevel: (level) =>
          `Win with each bot against each corporation ${level} ${level === 1 ? 'time' : 'times'}`,
      },
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'burncycle',
    gameName: 'burncycle',
    tracks,
  })
}
