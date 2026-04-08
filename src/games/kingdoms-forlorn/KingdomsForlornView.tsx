import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import AchievementsPanel from '../../components/AchievementsPanel'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import CountTable from '../../components/CountTable'
import GameThingThumb from '../../components/GameThingThumb'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { kingdomsForlornContent } from './content'
import { getKingdomsForlornEntries, KINGDOMS_FORLORN_OBJECT_ID } from './kingdomsForlornEntries'

type MatrixDisplayMode = 'count' | 'played'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(kingdom: string, knight: string): string {
  return `${normalizeLabel(kingdom)}|||${normalizeLabel(knight)}`
}

export default function KingdomsForlornView(props: {
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
    () => ({ id: KINGDOMS_FORLORN_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getKingdomsForlornEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('kingdomsForlorn', props.plays, props.username),
  )
  const assumedMinutesPerPlay = createMemo(() => thingAssumedPlayTimeMinutes(thing()?.raw) ?? undefined)

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(() =>
    entries().reduce((sum, entry) => {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      return sum + resolved.minutes / 60
    }, 0),
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

  const kingdomCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.kingdom, entry.quantity)
    return counts
  })
  const kingdomWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.kingdom, entry.quantity)
    }
    return counts
  })
  const playIdsByKingdom = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.kingdom)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const myKnightCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myKnight) continue
      incrementCount(counts, entry.myKnight, entry.quantity)
    }
    return counts
  })
  const myKnightWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myKnight || !entry.isWin) continue
      incrementCount(counts, entry.myKnight, entry.quantity)
    }
    return counts
  })
  const playIdsByKnight = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.myKnight) continue
      const key = normalizeLabel(entry.myKnight)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.myKnight) continue
      counts[entry.kingdom] ||= {}
      incrementCount(counts[entry.kingdom]!, entry.myKnight, entry.quantity)
    }
    return counts
  })
  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.myKnight || !entry.isWin) continue
      counts[entry.kingdom] ||= {}
      incrementCount(counts[entry.kingdom]!, entry.myKnight, entry.quantity)
    }
    return counts
  })
  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.myKnight) continue
      const key = pairKey(entry.kingdom, entry.myKnight)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const kingdomBox = kingdomsForlornContent.kingdomBoxByName.get(entry.kingdom)
      if (kingdomBox) boxes.add(kingdomBox)
      for (const knight of entry.knights) {
        const knightBox = kingdomsForlornContent.knightBoxByName.get(knight)
        if (knightBox) boxes.add(knightBox)
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
      const kingdomBox = kingdomsForlornContent.kingdomBoxByName.get(entry.kingdom)
      if (kingdomBox) boxes.add(kingdomBox)
      for (const knight of entry.knights) {
        const knightBox = kingdomsForlornContent.knightBoxByName.get(knight)
        if (knightBox) boxes.add(knightBox)
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
      const kingdomBox = kingdomsForlornContent.kingdomBoxByName.get(entry.kingdom)
      if (kingdomBox) boxes.add(kingdomBox)
      for (const knight of entry.knights) {
        const knightBox = kingdomsForlornContent.knightBoxByName.get(knight)
        if (knightBox) boxes.add(knightBox)
      }
      for (const box of boxes) (ids[box] ||= []).push(entry.play.id)
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...kingdomsForlornContent.boxCostsByName.entries()]
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
    () => Boolean(kingdomsForlornContent.costCurrencySymbol) && kingdomsForlornContent.boxCostsByName.size > 0,
  )
  const kingdomKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(kingdomCounts()), kingdomsForlornContent.kingdoms),
  )
  const knightKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(myKnightCounts()), kingdomsForlornContent.knights),
  )
  const matrixMax = createMemo(() => {
    let max = 0
    for (const kingdom of kingdomsForlornContent.kingdoms) {
      for (const knight of kingdomsForlornContent.knights) {
        const value = matrix()[kingdom]?.[knight] ?? 0
        if (value > max) max = value
      }
    }
    return max
  })

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={KINGDOMS_FORLORN_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Kingdoms Forlorn thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Kingdoms Forlorn</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Kingdoms Forlorn • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Track kingdoms and your knight from BG Stats color tags. <span class="mono">ContPrev</span> and{' '}
            <span class="mono">ContNext</span> inherit missing tags from adjacent sessions.
          </div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Kingdoms Forlorn plays found. In BG Stats, use player <span class="mono">color</span> like{' '}
            <span class="mono">Kara／Barony</span> or <span class="mono">Knight: Sonch／Kingdom: Sunken</span>.
          </div>
        }
      >
        <div class="matrixHeaderRow">
          <div class="muted">
            Matrix mode:{' '}
            <span class="mono">
              {matrixDisplayMode() === 'played' ? 'Played/Unplayed' : 'Play counts'}
            </span>
          </div>
          <div class="tabs">
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: matrixDisplayMode() === 'played' }}
              onClick={() => setMatrixDisplayMode('played')}
            >
              Played/Unplayed
            </button>
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: matrixDisplayMode() === 'count' }}
              onClick={() => setMatrixDisplayMode('count')}
            >
              Play counts
            </button>
          </div>
        </div>

        <HeatmapMatrix
          rows={kingdomsForlornContent.kingdoms}
          cols={kingdomsForlornContent.knights}
          rowHeader="Kingdom"
          colHeader="Knight"
          maxCount={matrixMax()}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(kingdom, knight) => matrix()[kingdom]?.[knight] ?? 0}
          getWinCount={(kingdom, knight) => matrixWins()[kingdom]?.[knight] ?? 0}
          getCellDisplayText={(_kingdom, _knight, count) =>
            matrixDisplayMode() === 'played' ? (count > 0 ? '✓' : '') : count === 0 ? '—' : String(count)
          }
          getCellLabel={(kingdom, knight, count) => `${kingdom} × ${knight}: ${count}`}
          rowGroupBy={(kingdom) => kingdomsForlornContent.kingdomGroupByName.get(kingdom)}
          colGroupBy={(knight) => kingdomsForlornContent.knightGroupByName.get(knight)}
          onCellClick={(kingdom, knight) => {
            const playIds = playIdsByPair().get(pairKey(kingdom, knight)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({
              title: `Kingdoms Forlorn • ${kingdom} × ${knight}`,
              playIds,
            })
          }}
        />

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
            currencySymbol={kingdomsForlornContent.costCurrencySymbol}
            overallPlays={totalPlays()}
            overallHours={totalHours()}
            overallHoursHasAssumed={totalHoursHasAssumed()}
            averageHoursPerPlay={averageHoursPerPlay()}
            title="Cost Per Play"
            onPlaysClick={(box) => {
              const playIds = playIdsByBox()[box] ?? []
              if (playIds.length === 0) return
              props.onOpenPlays({ title: `Kingdoms Forlorn • ${box}`, playIds })
            }}
          />
        </Show>

        <CountTable
          title="Kingdoms"
          plays={kingdomCounts()}
          wins={kingdomWins()}
          keys={kingdomKeys()}
          groupBy={(kingdom) => kingdomsForlornContent.kingdomGroupByName.get(kingdom)}
          getNextAchievement={(kingdom) => getNextAchievement('kingdomPlays', kingdom)}
          onPlaysClick={(kingdom) => {
            const playIds = playIdsByKingdom().get(normalizeLabel(kingdom)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({ title: `Kingdoms Forlorn • ${kingdom}`, playIds })
          }}
        />

        <CountTable
          title="My Knights"
          plays={myKnightCounts()}
          wins={myKnightWins()}
          keys={knightKeys()}
          groupBy={(knight) => kingdomsForlornContent.knightGroupByName.get(knight)}
          getNextAchievement={(knight) => getNextAchievement('knightPlays', knight)}
          onPlaysClick={(knight) => {
            const playIds = playIdsByKnight().get(normalizeLabel(knight)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({ title: `Kingdoms Forlorn • ${knight}`, playIds })
          }}
        />
      </Show>

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />
    </div>
  )
}
