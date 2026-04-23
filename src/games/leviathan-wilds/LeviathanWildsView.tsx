import { Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import AchievementsPanel from '../../components/AchievementsPanel'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import CountTable from '../../components/CountTable'
import GameThingThumb from '../../components/GameThingThumb'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { leviathanWildsContent } from './content'
import { getLeviathanWildsEntries, LEVIATHAN_WILDS_OBJECT_ID } from './leviathanWildsEntries'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

export default function LeviathanWildsView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: LEVIATHAN_WILDS_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getLeviathanWildsEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() => computeGameAchievements('leviathanWilds', props.plays, props.username))
  const assumedMinutesPerPlay = createMemo(() => thingAssumedPlayTimeMinutes(thing()?.raw) ?? undefined)

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(() =>
    entries().reduce(
      (sum, entry) =>
        sum +
        totalPlayMinutesWithAssumption({
          attributes: entry.play.attributes,
          quantity: entry.quantity,
          assumedMinutesPerPlay: assumedMinutesPerPlay(),
        }).minutes /
          60,
      0,
    ),
  )
  const totalHoursHasAssumed = createMemo(() =>
    entries().some((entry) =>
      totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      }).assumed,
    ),
  )
  const averageHoursPerPlay = createMemo(() => {
    const plays = totalPlays()
    if (plays <= 0 || totalHours() <= 0) return undefined
    return totalHours() / plays
  })

  const countsFor = (pick: (entry: ReturnType<typeof entries>[number]) => string | undefined) => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const key = pick(entry)
      if (!key) continue
      incrementCount(counts, key, entry.quantity)
    }
    return counts
  }
  const winsFor = (pick: (entry: ReturnType<typeof entries>[number]) => string | undefined) => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const key = pick(entry)
      if (!key || !entry.isWin) continue
      incrementCount(counts, key, entry.quantity)
    }
    return counts
  }
  const idsFor = (pick: (entry: ReturnType<typeof entries>[number]) => string | undefined) => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = pick(entry)
      if (!key) continue
      const normalized = normalizeLabel(key)
      const existing = ids.get(normalized)
      if (existing) existing.push(entry.play.id)
      else ids.set(normalized, [entry.play.id])
    }
    return ids
  }

  const leviathanCounts = createMemo(() => countsFor((entry) => entry.leviathan))
  const leviathanWins = createMemo(() => winsFor((entry) => entry.leviathan))
  const playIdsByLeviathan = createMemo(() => idsFor((entry) => entry.leviathan))
  const characterCounts = createMemo(() => countsFor((entry) => entry.character))
  const characterWins = createMemo(() => winsFor((entry) => entry.character))
  const playIdsByCharacter = createMemo(() => idsFor((entry) => entry.character))
  const classCounts = createMemo(() => countsFor((entry) => entry.className))
  const classWins = createMemo(() => winsFor((entry) => entry.className))
  const playIdsByClass = createMemo(() => idsFor((entry) => entry.className))

  const taggedLeviathanPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.leviathan === 'Unknown leviathan' ? 0 : entry.quantity), 0),
  )
  const taggedCharacterPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.character ? entry.quantity : 0), 0),
  )
  const taggedClassPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.className ? entry.quantity : 0), 0),
  )

  const boxPlayCounts = createMemo<Record<string, number>>(() => ({ 'Leviathan Wilds': totalPlays() }))
  const boxPlayHours = createMemo(() => ({
    hoursByBox: { 'Leviathan Wilds': totalHours() } as Record<string, number>,
    hasAssumedHoursByBox: { 'Leviathan Wilds': totalHoursHasAssumed() } as Record<string, boolean>,
  }))
  const costRows = createMemo(() =>
    [...leviathanWildsContent.boxCostsByName.entries()].map(([box, cost]) => ({
      box,
      cost,
      plays: boxPlayCounts()[box] ?? 0,
      hoursPlayed: boxPlayHours().hoursByBox[box] ?? 0,
      hasAssumedHours: boxPlayHours().hasAssumedHoursByBox[box] === true,
    })),
  )

  const leviathanKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(leviathanCounts()), leviathanWildsContent.leviathans),
  )
  const characterKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(characterCounts()), leviathanWildsContent.characters),
  )
  const classKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(classCounts()), leviathanWildsContent.classes),
  )

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={LEVIATHAN_WILDS_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Leviathan Wilds thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Leviathan Wilds</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() => props.onOpenPlays({ title: 'Leviathan Wilds • All plays', playIds: allPlayIds() })}
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Track leviathans from comments like <span class="mono">L2／Difficulty Normal</span> and climber
            decks from BG Stats color tags like <span class="mono">Fix／Roughneck</span>.
          </div>
          <dl class="kv">
            <div class="kvRow">
              <dt>Total time</dt>
              <dd>
                <span class="mono">{totalHours().toFixed(1)}h</span>
                <Show when={totalHoursHasAssumed()}>
                  <span class="muted"> *</span>
                </Show>
              </dd>
            </div>
            <Show when={averageHoursPerPlay()}>
              {(hours) => (
                <div class="kvRow">
                  <dt>Average time</dt>
                  <dd class="mono">{hours().toFixed(1)}h/play</dd>
                </div>
              )}
            </Show>
            <div class="kvRow">
              <dt>Tagged plays</dt>
              <dd class="mono">
                L {taggedLeviathanPlays().toLocaleString()} / C {taggedCharacterPlays().toLocaleString()} /
                Class {taggedClassPlays().toLocaleString()}
              </dd>
            </div>
          </dl>
          <Show when={totalHoursHasAssumed()}>
            <div class="muted">* Includes BGG estimated time for zero-length plays.</div>
          </Show>
        </div>
      </div>

      <AchievementsPanel
        title="Leviathan Wilds achievements"
        achievements={achievements()}
        nextLimit={5}
        pinnedAchievementIds={props.pinnedAchievementIds}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
        onTogglePin={props.onTogglePin}
      />

      <Show when={costRows().length > 0}>
        <CostPerPlayTable
          title="Costs"
          rows={costRows()}
          currencySymbol={leviathanWildsContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          averageHoursPerPlay={averageHoursPerPlay()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          onPlaysClick={(box) => props.onOpenPlays({ title: `Leviathan Wilds • ${box}`, playIds: allPlayIds() })}
        />
      </Show>

      <CountTable
        title="Leviathans"
        plays={leviathanCounts()}
        wins={leviathanWins()}
        keys={leviathanKeys()}
        groupBy={(key) => leviathanWildsContent.groupByLeviathan.get(key)}
        getNextAchievement={(key) => getNextAchievement('leviathanPlays', key)}
        onPlaysClick={(key) =>
          props.onOpenPlays({
            title: `Leviathan Wilds • ${key}`,
            playIds: playIdsByLeviathan().get(normalizeLabel(key)) ?? [],
          })
        }
      />

      <CountTable
        title="Characters"
        plays={characterCounts()}
        wins={characterWins()}
        keys={characterKeys()}
        groupBy={(key) => leviathanWildsContent.groupByCharacter.get(key)}
        getNextAchievement={(key) => getNextAchievement('characterPlays', key)}
        onPlaysClick={(key) =>
          props.onOpenPlays({
            title: `Leviathan Wilds • ${key}`,
            playIds: playIdsByCharacter().get(normalizeLabel(key)) ?? [],
          })
        }
      />

      <CountTable
        title="Classes"
        plays={classCounts()}
        wins={classWins()}
        keys={classKeys()}
        groupBy={(key) => leviathanWildsContent.groupByClass.get(key)}
        getNextAchievement={(key) => getNextAchievement('classPlays', key)}
        onPlaysClick={(key) =>
          props.onOpenPlays({
            title: `Leviathan Wilds • ${key}`,
            playIds: playIdsByClass().get(normalizeLabel(key)) ?? [],
          })
        }
      />
    </div>
  )
}
