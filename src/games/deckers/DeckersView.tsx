import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import AchievementsPanel from '../../components/AchievementsPanel'
import GameThingThumb from '../../components/GameThingThumb'
import {
  incrementCount,
  mergeCanonicalKeys,
  sortKeysByCountDesc,
  sortKeysByGroupThenCountDesc,
} from '../../stats'
import {
  thingAssumedPlayTimeMinutes,
  totalPlayMinutesWithAssumption,
} from '../../playDuration'
import { deckersContent } from './content'
import { DECKERS_OBJECT_ID, getDeckersEntries } from './deckersEntries'

type MatrixDisplayMode = 'count' | 'played'

function pairKey(left: string, right: string): string {
  return `${left}|||${right}`
}

export default function DeckersView(props: {
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
    () => ({ id: DECKERS_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getDeckersEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() => computeGameAchievements('deckers', props.plays, props.username))
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

  const deckerCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const decker of entry.deckers) incrementCount(counts, decker, entry.quantity)
    }
    return counts
  })

  const deckerWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const decker of entry.deckers) incrementCount(counts, decker, entry.quantity)
    }
    return counts
  })

  const smcCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.smc, entry.quantity)
    return counts
  })

  const smcWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.smc, entry.quantity)
    }
    return counts
  })

  const unknownTagCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const tag of entry.unknownTags) incrementCount(counts, tag, entry.quantity)
    }
    return counts
  })

  const playIdsByDecker = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const decker of entry.deckers) {
        ;(ids[decker] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const playIdsBySmc = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.smc] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByUnknownTag = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const tag of entry.unknownTags) {
        ;(ids[tag] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.smc] ||= {}
      for (const decker of entry.deckers) incrementCount(counts[entry.smc]!, decker, entry.quantity)
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.smc] ||= {}
      for (const decker of entry.deckers) incrementCount(counts[entry.smc]!, decker, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const decker of entry.deckers) {
        const key = pairKey(entry.smc, decker)
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const matrixMax = createMemo(() => {
    let max = 0
    for (const smc of deckersContent.smcs) {
      for (const decker of deckersContent.deckers) {
        const value = matrix()[smc]?.[decker] ?? 0
        if (value > max) max = value
      }
    }
    return max
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      for (const decker of entry.deckers) {
        const box = deckersContent.deckerBoxByName.get(decker)
        if (box) boxes.add(box)
      }
      const smcBox = deckersContent.smcBoxByName.get(entry.smc)
      if (smcBox) boxes.add(smcBox)
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      const hours = resolved.minutes / 60
      if (hours <= 0) continue

      const boxes = new Set<string>()
      for (const decker of entry.deckers) {
        const box = deckersContent.deckerBoxByName.get(decker)
        if (box) boxes.add(box)
      }
      const smcBox = deckersContent.smcBoxByName.get(entry.smc)
      if (smcBox) boxes.add(smcBox)

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
      for (const decker of entry.deckers) {
        const box = deckersContent.deckerBoxByName.get(decker)
        if (box) boxes.add(box)
      }
      const smcBox = deckersContent.smcBoxByName.get(entry.smc)
      if (smcBox) boxes.add(smcBox)
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...deckersContent.boxCostsByName.entries()]
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
    () => Boolean(deckersContent.costCurrencySymbol) && deckersContent.boxCostsByName.size > 0,
  )

  const deckerKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(deckerCounts()), deckersContent.deckers),
      deckerCounts(),
      (decker) => deckersContent.deckerGroupByName.get(decker),
      deckersContent.deckerGroups,
    ),
  )

  const smcKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(smcCounts()), deckersContent.smcs),
  )

  const unknownTagKeys = createMemo(() => sortKeysByCountDesc(unknownTagCounts()))

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={DECKERS_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Deckers cover"
        />

        <div class="finalGirlMeta">
          <div class="meta">
            Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
          </div>
          <div class="meta">
            Hours: <span class="mono">{totalHours().toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            <Show when={totalHoursHasAssumed()}>{' *'}</Show>
          </div>
          <div class="meta">
            Deckers played: <span class="mono">{Object.values(deckerCounts()).filter((count) => count > 0).length}</span>
            {' / '}
            <span class="mono">{deckersContent.deckers.length}</span>
          </div>
          <div class="meta">
            SMCs faced: <span class="mono">{Object.values(smcCounts()).filter((count) => count > 0).length}</span>
            {' / '}
            <span class="mono">{deckersContent.smcs.length}</span>
          </div>
        </div>
      </div>

      <AchievementsPanel
        title="Achievements"
        achievements={achievements()}
        nextLimit={6}
        pinnedAchievementIds={props.pinnedAchievementIds}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
        onTogglePin={props.onTogglePin}
      />

      <div class="statsBlock">
        <div class="statsTitleRow">
          <h3 class="statsTitle">Decker vs SMC Matrix</h3>
          <div class="segmentedControl">
            <button
              type="button"
              classList={{ selected: matrixDisplayMode() === 'played' }}
              onClick={() => setMatrixDisplayMode('played')}
            >
              Played
            </button>
            <button
              type="button"
              classList={{ selected: matrixDisplayMode() === 'count' }}
              onClick={() => setMatrixDisplayMode('count')}
            >
              Counts
            </button>
          </div>
        </div>

        <HeatmapMatrix
          rows={smcKeys()}
          cols={deckerKeys()}
          rowHeader="SMC"
          colHeader="Decker"
          maxCount={matrixMax()}
          getCount={(smc, decker) => matrix()[smc]?.[decker] ?? 0}
          getWinCount={(smc, decker) => matrixWins()[smc]?.[decker] ?? 0}
          getCellDisplayText={(_smc, _decker, count) => {
            if (count === 0) return '—'
            return matrixDisplayMode() === 'played' ? '✓' : String(count)
          }}
          getCellLabel={(smc, decker, count) =>
            `${decker} vs ${smc}: ${count} play${count === 1 ? '' : 's'}`
          }
          colGroupBy={(decker) => deckersContent.deckerGroupByName.get(decker)}
          onCellClick={(smc, decker) =>
            props.onOpenPlays({
              title: `Deckers • ${decker} vs ${smc}`,
              playIds: playIdsByPair().get(pairKey(smc, decker)) ?? [],
            })
          }
        />
      </div>

      <CountTable
        title="Deckers Played"
        plays={deckerCounts()}
        wins={deckerWins()}
        keys={deckerKeys()}
        groupBy={(decker) => deckersContent.deckerGroupByName.get(decker)}
        getNextAchievement={(decker) =>
          pickBestAvailableAchievementForTrackIds(achievements(), [
            'deckerPlays',
            `deckerPlays:${slugifyAchievementItemId(decker)}`,
          ])
        }
        onPlaysClick={(decker) =>
          props.onOpenPlays({
            title: `Deckers • Decker: ${decker}`,
            playIds: playIdsByDecker()[decker] ?? [],
          })
        }
      />

      <CountTable
        title="SMCs Faced"
        plays={smcCounts()}
        wins={smcWins()}
        keys={smcKeys()}
        getNextAchievement={(smc) =>
          pickBestAvailableAchievementForTrackIds(achievements(), [
            'smcPlays',
            'smcWins',
            `smcPlays:${slugifyAchievementItemId(smc)}`,
            `smcWins:${slugifyAchievementItemId(smc)}`,
          ])
        }
        onPlaysClick={(smc) =>
          props.onOpenPlays({
            title: `Deckers • SMC: ${smc}`,
            playIds: playIdsBySmc()[smc] ?? [],
          })
        }
      />

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          rows={costRows()}
          currencySymbol={deckersContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          onPlaysClick={(box) =>
            props.onOpenPlays({
              title: `Deckers • Box: ${box}`,
              playIds: playIdsByBox()[box] ?? [],
            })
          }
        />
      </Show>

      <Show when={unknownTagKeys().length > 0}>
        <CountTable
          title="Unparsed Tags"
          plays={unknownTagCounts()}
          keys={unknownTagKeys()}
          onPlaysClick={(tag) =>
            props.onOpenPlays({
              title: `Deckers • Unparsed tag: ${tag}`,
              playIds: playIdsByUnknownTag()[tag] ?? [],
            })
          }
        />
      </Show>

      <Show when={totalHoursHasAssumed()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length.
        </div>
      </Show>

      <div class="meta">
        Raw Deckers plays tracked: <span class="mono">{allPlayIds().length.toLocaleString()}</span>
      </div>
    </div>
  )
}
