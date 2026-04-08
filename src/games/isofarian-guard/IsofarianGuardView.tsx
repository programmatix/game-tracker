import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { computeGameAchievements } from '../../achievements/games'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import AchievementsPanel from '../../components/AchievementsPanel'
import GameThingThumb from '../../components/GameThingThumb'
import { incrementCount, mergeCanonicalKeys, sortKeysByGroupThenCountDesc } from '../../stats'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { isofarianGuardContent } from './content'
import { getIsofarianGuardEntries, ISOFARIAN_GUARD_OBJECT_ID } from './isofarianGuardEntries'

type MatrixDisplayMode = 'count' | 'played'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(campaign: string, guard: string): string {
  return `${normalizeLabel(campaign)}|||${normalizeLabel(guard)}`
}

export default function IsofarianGuardView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [matrixDisplayMode, setMatrixDisplayMode] = createSignal<MatrixDisplayMode>('played')

  const [thing] = createResource(
    () => ({ id: ISOFARIAN_GUARD_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getIsofarianGuardEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('isofarianGuard', props.plays, props.username),
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

  const campaignCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.campaign, entry.quantity)
    return counts
  })
  const campaignWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.campaign, entry.quantity)
    }
    return counts
  })
  const playIdsByCampaign = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.campaign)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
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
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.chapter)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const guardCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const guard of entry.guards) incrementCount(counts, guard, entry.quantity)
    }
    return counts
  })
  const guardWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const guard of entry.guards) incrementCount(counts, guard, entry.quantity)
    }
    return counts
  })
  const playIdsByGuard = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const guard of entry.guards) {
        const key = normalizeLabel(guard)
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.campaign] ||= {}
      for (const guard of entry.guards) incrementCount(counts[entry.campaign]!, guard, entry.quantity)
    }
    return counts
  })
  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.campaign] ||= {}
      for (const guard of entry.guards) incrementCount(counts[entry.campaign]!, guard, entry.quantity)
    }
    return counts
  })
  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const guard of entry.guards) {
        const key = pairKey(entry.campaign, guard)
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const campaignBox = isofarianGuardContent.campaignBoxByName.get(entry.campaign)
      const chapterBox = isofarianGuardContent.chapterBoxByName.get(entry.chapter)
      if (campaignBox) boxes.add(campaignBox)
      if (chapterBox) boxes.add(chapterBox)
      for (const guard of entry.guards) {
        const guardBox = isofarianGuardContent.guardBoxByName.get(guard)
        if (guardBox) boxes.add(guardBox)
      }
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })
  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const campaignBox = isofarianGuardContent.campaignBoxByName.get(entry.campaign)
      const chapterBox = isofarianGuardContent.chapterBoxByName.get(entry.chapter)
      if (campaignBox) boxes.add(campaignBox)
      if (chapterBox) boxes.add(chapterBox)
      for (const guard of entry.guards) {
        const guardBox = isofarianGuardContent.guardBoxByName.get(guard)
        if (guardBox) boxes.add(guardBox)
      }

      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      const hours = resolved.minutes / 60
      if (hours <= 0) continue
      for (const box of boxes) incrementCount(hoursByBox, box, hours)
      if (resolved.assumed) {
        for (const box of boxes) hasAssumedHoursByBox[box] = true
      }
    }
    return { hoursByBox, hasAssumedHoursByBox }
  })
  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const campaignBox = isofarianGuardContent.campaignBoxByName.get(entry.campaign)
      const chapterBox = isofarianGuardContent.chapterBoxByName.get(entry.chapter)
      if (campaignBox) boxes.add(campaignBox)
      if (chapterBox) boxes.add(chapterBox)
      for (const guard of entry.guards) {
        const guardBox = isofarianGuardContent.guardBoxByName.get(guard)
        if (guardBox) boxes.add(guardBox)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...isofarianGuardContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours().hoursByBox[box] ?? 0,
        hasAssumedHours: boxPlayHours().hasAssumedHoursByBox[box] === true,
      }))
      .sort((a, b) => {
        const byPlays = b.plays - a.plays
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () => Boolean(isofarianGuardContent.costCurrencySymbol) && isofarianGuardContent.boxCostsByName.size > 0,
  )

  const campaignKeys = createMemo(() =>
    mergeCanonicalKeys(Object.keys(campaignCounts()), isofarianGuardContent.campaigns),
  )
  const chapterKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(Object.keys(chapterCounts()), isofarianGuardContent.chapters),
      chapterCounts(),
      (chapter) => isofarianGuardContent.chapterGroupByName.get(chapter),
      isofarianGuardContent.campaigns,
    ),
  )
  const guardKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(Object.keys(guardCounts()), isofarianGuardContent.guards),
      guardCounts(),
      (guard) => isofarianGuardContent.guardGroupByName.get(guard),
      ['Campaign 1', 'Campaign 2', 'Campaign 3', 'Campaign 4'],
    ),
  )

  const matrixRows = createMemo(() => campaignKeys())
  const matrixCols = createMemo(() => guardKeys())
  const matrixMax = createMemo(() => {
    let max = 0
    for (const row of matrixRows()) {
      for (const col of matrixCols()) {
        const value = matrix()[row]?.[col] ?? 0
        if (value > max) max = value
      }
    }
    return max
  })

  const taggedPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.chapter === 'Unknown chapter' ? 0 : entry.quantity), 0),
  )
  const untaggedPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.chapter === 'Unknown chapter' ? entry.quantity : 0), 0),
  )

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={ISOFARIAN_GUARD_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Isofarian Guard thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Isofarian Guard</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Isofarian Guard • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Track campaign progress, chapter coverage, and which guard pairs you&apos;ve used.
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
      </div>

      <div class="statsBlock">
        <div class="statsTitleRow">
          <h3 class="statsTitle">Campaign × Guard</h3>
          <div class="segmentedControl" role="group" aria-label="Isofarian Guard matrix mode">
            <button
              type="button"
              class="segmentedControlButton"
              classList={{ segmentedControlButtonActive: matrixDisplayMode() === 'played' }}
              onClick={() => setMatrixDisplayMode('played')}
            >
              Played
            </button>
            <button
              type="button"
              class="segmentedControlButton"
              classList={{ segmentedControlButtonActive: matrixDisplayMode() === 'count' }}
              onClick={() => setMatrixDisplayMode('count')}
            >
              Counts
            </button>
          </div>
        </div>

        <HeatmapMatrix
          rows={matrixRows()}
          cols={matrixCols()}
          rowHeader="Campaign"
          colHeader="Guard"
          maxCount={matrixMax()}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(campaign, guard) => matrix()[campaign]?.[guard] ?? 0}
          getWinCount={(campaign, guard) => matrixWins()[campaign]?.[guard] ?? 0}
          getCellDisplayText={(_campaign, _guard, count) =>
            matrixDisplayMode() === 'played' ? (count > 0 ? '✓' : '') : count === 0 ? '—' : String(count)
          }
          colGroupBy={(guard) => isofarianGuardContent.guardGroupByName.get(guard)}
          onCellClick={(campaign, guard) => {
            const playIds = playIdsByPair().get(pairKey(campaign, guard)) ?? []
            props.onOpenPlays({ title: `Isofarian Guard • ${campaign} × ${guard}`, playIds })
          }}
        />
      </div>

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          title="Cost Per Play"
          rows={costRows()}
          currencySymbol={isofarianGuardContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          averageHoursPerPlay={averageHoursPerPlay()}
          onPlaysClick={(box) => {
            const playIds = playIdsByBox()[box] ?? []
            props.onOpenPlays({ title: `Isofarian Guard • ${box}`, playIds })
          }}
        />
      </Show>

      <div class="statsGrid">
        <CountTable
          title="Campaigns"
          plays={campaignCounts()}
          wins={campaignWins()}
          keys={campaignKeys()}
          onPlaysClick={(campaign) => {
            const playIds = playIdsByCampaign().get(normalizeLabel(campaign)) ?? []
            props.onOpenPlays({ title: `Isofarian Guard • ${campaign}`, playIds })
          }}
        />

        <CountTable
          title="Guards"
          plays={guardCounts()}
          wins={guardWins()}
          keys={guardKeys()}
          groupBy={(guard) => isofarianGuardContent.guardGroupByName.get(guard)}
          onPlaysClick={(guard) => {
            const playIds = playIdsByGuard().get(normalizeLabel(guard)) ?? []
            props.onOpenPlays({ title: `Isofarian Guard • ${guard}`, playIds })
          }}
        />
      </div>

      <CountTable
        title="Chapters"
        plays={chapterCounts()}
        wins={chapterWins()}
        keys={chapterKeys()}
        groupBy={(chapter) => isofarianGuardContent.chapterGroupByName.get(chapter)}
        onPlaysClick={(chapter) => {
          const playIds = playIdsByChapter().get(normalizeLabel(chapter)) ?? []
          props.onOpenPlays({ title: `Isofarian Guard • ${chapter}`, playIds })
        }}
      />

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
