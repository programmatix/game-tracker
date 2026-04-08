import { Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import {
  incrementCount,
  mergeCanonicalKeys,
  sortKeysByCountDesc,
} from '../../stats'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { taintedGrailContent } from './content'
import { getTaintedGrailEntries, TAINTED_GRAIL_OBJECT_ID } from './taintedGrailEntries'

export default function TaintedGrailView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: TAINTED_GRAIL_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getTaintedGrailEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() =>
    computeGameAchievements('taintedGrail', props.plays, props.username),
  )
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
  const totalHoursHasAssumed = createMemo(() => {
    for (const entry of entries()) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      if (resolved.assumed) return true
    }
    return false
  })
  const averageHoursPerPlay = createMemo(() => {
    const plays = totalPlays()
    if (plays <= 0) return undefined
    const hours = totalHours()
    if (hours <= 0) return undefined
    return hours / plays
  })

  const chapterCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.chapter, entry.quantity)
    return counts
  })

  const chapterWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.chapter, entry.quantity)
    }
    return counts
  })

  const playIdsByChapter = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.chapter] ||= []).push(entry.play.id)
    }
    return ids
  })

  const continuationCount = createMemo(() =>
    entries().reduce(
      (sum, entry) =>
        sum + (entry.continuedFromPrevious || entry.continuedToNext ? entry.quantity : 0),
      0,
    ),
  )

  const taggedPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.chapter === 'Unknown chapter' ? 0 : entry.quantity), 0),
  )
  const untaggedPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.chapter === 'Unknown chapter' ? entry.quantity : 0), 0),
  )

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const box = taintedGrailContent.chapterBoxByName.get(entry.chapter)
      if (!box) continue
      incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const box = taintedGrailContent.chapterBoxByName.get(entry.chapter)
      if (!box) continue
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      incrementCount(hoursByBox, box, resolved.minutes / 60)
      if (resolved.assumed) hasAssumedHoursByBox[box] = true
    }
    return { hoursByBox, hasAssumedHoursByBox }
  })

  const chapterPlayHours = createMemo(() => {
    const hoursByChapter: Record<string, number> = {}
    const hasAssumedHoursByChapter: Record<string, boolean> = {}
    for (const entry of entries()) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      incrementCount(hoursByChapter, entry.chapter, resolved.minutes / 60)
      if (resolved.assumed) hasAssumedHoursByChapter[entry.chapter] = true
    }
    return { hoursByChapter, hasAssumedHoursByChapter }
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const box = taintedGrailContent.chapterBoxByName.get(entry.chapter)
      if (!box) continue
      ;(ids[box] ||= []).push(entry.play.id)
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...taintedGrailContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours().hoursByBox[box] ?? 0,
        hasAssumedHours: boxPlayHours().hasAssumedHoursByBox[box] === true,
      }))
      .sort((a, b) => {
        const byPlays = (b.plays ?? 0) - (a.plays ?? 0)
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () => Boolean(taintedGrailContent.costCurrencySymbol) && taintedGrailContent.boxCostsByName.size > 0,
  )

  const chapterKeys = createMemo(() =>
    mergeCanonicalKeys(taintedGrailContent.chapters, sortKeysByCountDesc(chapterCounts())),
  )

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={TAINTED_GRAIL_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Tainted Grail thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Tainted Grail</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Tainted Grail • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Track chapter progress through The Fall of Avalon campaign.
          </div>
        </div>
      </div>

      <div class="finalGirlMetaRow">
        <div class="meta">
          <div class="metaLabel">Total hours</div>
          <div class="metaValue mono">
            {totalHours().toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {totalHoursHasAssumed() ? '*' : ''}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Avg hours / play</div>
          <div class="metaValue mono">
            <Show when={averageHoursPerPlay() !== undefined} fallback="—">
              {averageHoursPerPlay()!.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              {totalHoursHasAssumed() ? '*' : ''}
            </Show>
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Tagged plays</div>
          <div class="metaValue mono">{taggedPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Untagged plays</div>
          <div class="metaValue mono">{untaggedPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Continuations</div>
          <div class="metaValue mono">{continuationCount().toLocaleString()}</div>
        </div>
      </div>

      <Show when={totalHoursHasAssumed()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length.
        </div>
      </Show>

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          rows={costRows()}
          currencySymbol={taintedGrailContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          averageHoursPerPlay={averageHoursPerPlay()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          title="Cost Per Box"
          onPlaysClick={(box) => {
            const ids = playIdsByBox()[box] ?? []
            if (ids.length === 0) return
            props.onOpenPlays({
              title: `Tainted Grail • ${box}`,
              playIds: ids,
            })
          }}
        />
      </Show>

      <div class="statsBlock">
        <h3 class="statsTitle">Chapters</h3>
        <div class="tableWrap compact">
          <table class="table compactTable">
            <thead>
              <tr>
                <th>Chapter</th>
                <th class="mono">Played</th>
                <th class="mono">Plays</th>
                <th class="mono">Wins</th>
                <th class="mono">Hours</th>
                <th class="mono">Avg / play</th>
              </tr>
            </thead>
            <tbody>
              {chapterKeys().map((chapter) => {
                const plays = chapterCounts()[chapter] ?? 0
                const wins = chapterWins()[chapter] ?? 0
                const hours = chapterPlayHours().hoursByChapter[chapter] ?? 0
                const avgHours = plays > 0 ? hours / plays : 0
                const hasAssumed = chapterPlayHours().hasAssumedHoursByChapter[chapter] === true
                const groupLabel = taintedGrailContent.chapterGroupByName.get(chapter)?.trim() ?? ''
                const previousChapter = chapterKeys()[Math.max(0, chapterKeys().indexOf(chapter) - 1)]
                const previousGroupLabel =
                  taintedGrailContent.chapterGroupByName.get(previousChapter)?.trim() ?? ''
                const shouldRenderGroupHeader =
                  groupLabel.length > 0 && groupLabel !== previousGroupLabel

                return (
                  <>
                    <Show when={shouldRenderGroupHeader}>
                      <tr>
                        <th class="heatmapRowGroupHead" colSpan={6}>
                          {groupLabel}
                        </th>
                      </tr>
                    </Show>
                    <tr>
                      <td>{chapter}</td>
                      <td class="mono">{plays > 0 ? '✓' : ''}</td>
                      <td class="mono">
                        <Show when={plays > 0} fallback="0">
                          <button
                            type="button"
                            class="countLink"
                            onClick={() =>
                              props.onOpenPlays({
                                title: `Tainted Grail • ${chapter}`,
                                playIds: playIdsByChapter()[chapter] ?? [],
                              })
                            }
                            title="View plays"
                          >
                            {plays.toLocaleString()}
                          </button>
                        </Show>
                      </td>
                      <td class="mono">{wins.toLocaleString()}</td>
                      <td class="mono">
                        {hours.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        {hasAssumed ? '*' : ''}
                      </td>
                      <td class="mono">
                        <Show when={plays > 0} fallback="—">
                          {avgHours.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                          {hasAssumed ? '*' : ''}
                        </Show>
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
        onTogglePin={props.onTogglePin}
      />
    </div>
  )
}
