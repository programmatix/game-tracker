import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import AchievementsPanel from '../../components/AchievementsPanel'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
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
import { burncycleContent } from './content'
import { BURNCYCLE_OBJECT_ID, getBurncycleEntries } from './burncycleEntries'

type MatrixDisplayMode = 'count' | 'played'

function knownBots(entry: ReturnType<typeof getBurncycleEntries>[number]): string[] {
  return [...new Set(entry.bots.filter((bot) => bot !== 'Unknown bot'))]
}

export default function BurncycleView(props: {
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
    () => ({ id: BURNCYCLE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getBurncycleEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() =>
    computeGameAchievements('burncycle', props.plays, props.username),
  )
  const assumedMinutesPerPlay = createMemo(() => thingAssumedPlayTimeMinutes(thing()?.raw) ?? undefined)

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(
    () =>
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
      if (
        totalPlayMinutesWithAssumption({
          attributes: entry.play.attributes,
          quantity: entry.quantity,
          assumedMinutesPerPlay: assumedMinutesPerPlay(),
        }).assumed
      )
        return true
    }
    return false
  })

  const botCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const bot of knownBots(entry)) incrementCount(counts, bot, entry.quantity)
    }
    return counts
  })

  const botWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const bot of knownBots(entry)) incrementCount(counts, bot, entry.quantity)
    }
    return counts
  })

  const corporationCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.corporation, entry.quantity)
    return counts
  })

  const corporationWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.corporation, entry.quantity)
    }
    return counts
  })

  const captainCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.captain, entry.quantity)
    return counts
  })

  const captainWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.captain, entry.quantity)
    }
    return counts
  })

  const playIdsByBot = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const bot of knownBots(entry)) {
        ;(ids[bot] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const playIdsByCorporation = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.corporation] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByCaptain = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.captain] ||= []).push(entry.play.id)
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.corporation] ||= {}
      for (const bot of knownBots(entry)) {
        incrementCount(counts[entry.corporation]!, bot, entry.quantity)
      }
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.corporation] ||= {}
      for (const bot of knownBots(entry)) {
        incrementCount(counts[entry.corporation]!, bot, entry.quantity)
      }
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const bot of knownBots(entry)) {
        const key = `${entry.corporation}|||${bot}`
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
      for (const bot of knownBots(entry)) {
        const botBox = burncycleContent.botGroupByName.get(bot)
        if (botBox) boxes.add(botBox)
      }
      const corporationBox = burncycleContent.corporationGroupByName.get(entry.corporation)
      if (corporationBox) boxes.add(corporationBox)
      const captainBox = burncycleContent.captainGroupByName.get(entry.captain)
      if (captainBox) boxes.add(captainBox)
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      for (const bot of knownBots(entry)) {
        const botBox = burncycleContent.botGroupByName.get(bot)
        if (botBox) boxes.add(botBox)
      }
      const corporationBox = burncycleContent.corporationGroupByName.get(entry.corporation)
      if (corporationBox) boxes.add(corporationBox)
      const captainBox = burncycleContent.captainGroupByName.get(entry.captain)
      if (captainBox) boxes.add(captainBox)

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
      for (const bot of knownBots(entry)) {
        const botBox = burncycleContent.botGroupByName.get(bot)
        if (botBox) boxes.add(botBox)
      }
      const corporationBox = burncycleContent.corporationGroupByName.get(entry.corporation)
      if (corporationBox) boxes.add(corporationBox)
      const captainBox = burncycleContent.captainGroupByName.get(entry.captain)
      if (captainBox) boxes.add(captainBox)
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...burncycleContent.boxCostsByName.entries()]
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
    () =>
      Boolean(burncycleContent.costCurrencySymbol) &&
      burncycleContent.boxCostsByName.size > 0,
  )

  const groupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    const lists = [burncycleContent.corporations, burncycleContent.bots, burncycleContent.captains]
    for (const list of lists) {
      for (const key of list) {
        const group =
          burncycleContent.corporationGroupByName.get(key)?.trim() ||
          burncycleContent.botGroupByName.get(key)?.trim() ||
          burncycleContent.captainGroupByName.get(key)?.trim() ||
          ''
        if (!group || seen.has(group)) continue
        seen.add(group)
        order.push(group)
      }
    }
    return order
  })

  const botKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(botCounts()), burncycleContent.bots),
      botCounts(),
      (bot) => burncycleContent.botGroupByName.get(bot),
      groupOrder(),
    ),
  )

  const corporationKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(corporationCounts()), burncycleContent.corporations),
      corporationCounts(),
      (corporation) => burncycleContent.corporationGroupByName.get(corporation),
      groupOrder(),
    ),
  )

  const captainKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(captainCounts()), burncycleContent.captains),
      captainCounts(),
      (captain) => burncycleContent.captainGroupByName.get(captain),
      groupOrder(),
    ),
  )

  const maxCellCount = createMemo(() => {
    let max = 0
    for (const row of Object.values(matrix())) {
      for (const value of Object.values(row)) {
        if (value > max) max = value
      }
    }
    return max
  })

  const nextForTrackPrefix = (prefix: string, label: string) => {
    const itemId = slugifyAchievementItemId(label)
    const matching = achievements().filter((achievement) => {
      if (achievement.status !== 'available') return false
      if (props.suppressAvailableAchievementTrackIds?.has(achievement.trackId)) return false
      if (!achievement.trackId.startsWith(`${prefix}:`)) return false
      return achievement.trackId.endsWith(`:${itemId}`)
    })
    return pickBestAvailableAchievementForTrackIds(
      achievements(),
      [...new Set(matching.map((achievement) => achievement.trackId))],
    )
  }

  const handlePlaysForIds = (title: string, ids: number[]) => {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return
    props.onOpenPlays({ title, playIds: uniqueIds })
  }

  return (
    <div class="gameView">
      <div class="gameMetaRow">
        <GameThingThumb
          objectId={BURNCYCLE_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="burncycle thumbnail"
        />

        <div class="gameMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">burncycle</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'burncycle • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Corp mode: corporation × bot</div>
        </div>
      </div>

      <div class="statsBlock">
        <div class="statsTitleRow">
          <h3 class="statsTitle">Corporation × Bot</h3>
          <div class="segmented" role="group" aria-label="Matrix display mode">
            <button
              type="button"
              class="segmentedBtn"
              classList={{ segmentedBtnActive: matrixDisplayMode() === 'played' }}
              onClick={() => setMatrixDisplayMode('played')}
            >
              Played
            </button>
            <button
              type="button"
              class="segmentedBtn"
              classList={{ segmentedBtnActive: matrixDisplayMode() === 'count' }}
              onClick={() => setMatrixDisplayMode('count')}
            >
              Counts
            </button>
          </div>
        </div>
        <HeatmapMatrix
          rows={corporationKeys()}
          cols={botKeys()}
          rowHeader="Corporation"
          colHeader="Bot"
          maxCount={Math.max(1, maxCellCount())}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(corporation, bot) => matrix()[corporation]?.[bot] ?? 0}
          getWinCount={(corporation, bot) => matrixWins()[corporation]?.[bot] ?? 0}
          getCellDisplayText={(_corporation, _bot, count) => {
            if (matrixDisplayMode() === 'count') return count === 0 ? '—' : String(count)
            return count > 0 ? '✓' : ''
          }}
          rowGroupBy={(corporation) => burncycleContent.corporationGroupByName.get(corporation)}
          colGroupBy={(bot) => burncycleContent.botGroupByName.get(bot)}
          onCellClick={(corporation, bot) => {
            const key = `${corporation}|||${bot}`
            handlePlaysForIds(
              `burncycle plays: ${corporation} × ${bot}`,
              playIdsByPair().get(key) || [],
            )
          }}
        />
      </div>

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          rows={costRows()}
          currencySymbol={burncycleContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          title="Cost Per Play"
          onPlaysClick={(box) =>
            handlePlaysForIds(`burncycle plays: ${box}`, playIdsByBox()[box] || [])
          }
        />
      </Show>

      <CountTable
        title="Corporations"
        plays={corporationCounts()}
        wins={corporationWins()}
        keys={corporationKeys()}
        groupBy={(corporation) => burncycleContent.corporationGroupByName.get(corporation)}
        getNextAchievement={(corporation) => nextForTrackPrefix('corporationPlays', corporation)}
        onPlaysClick={(corporation) =>
          handlePlaysForIds(`burncycle plays: ${corporation}`, playIdsByCorporation()[corporation] || [])
        }
      />

      <CountTable
        title="Bots"
        plays={botCounts()}
        wins={botWins()}
        keys={botKeys()}
        groupBy={(bot) => burncycleContent.botGroupByName.get(bot)}
        getNextAchievement={(bot) => nextForTrackPrefix('botPlays', bot)}
        onPlaysClick={(bot) => handlePlaysForIds(`burncycle plays: ${bot}`, playIdsByBot()[bot] || [])}
      />

      <CountTable
        title="Captains"
        plays={captainCounts()}
        wins={captainWins()}
        keys={captainKeys()}
        groupBy={(captain) => burncycleContent.captainGroupByName.get(captain)}
        getNextAchievement={(captain) => nextForTrackPrefix('captainPlays', captain)}
        onPlaysClick={(captain) =>
          handlePlaysForIds(`burncycle plays: ${captain}`, playIdsByCaptain()[captain] || [])
        }
      />

      <AchievementsPanel
        achievements={achievements()}
        nextLimit={8}
        pinnedAchievementIds={props.pinnedAchievementIds}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
        onTogglePin={props.onTogglePin}
      />

      <div class="statsBlock">
        <h3 class="statsTitle">Summary</h3>
        <p class="muted">
          Plays: <strong>{totalPlays().toLocaleString()}</strong> · Hours:{' '}
          <strong>
            {totalHours().toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            {totalHoursHasAssumed() ? '*' : ''}
          </strong>
        </p>
      </div>

      <Show when={allPlayIds().length === 0}>
        <p class="muted">No burncycle plays found yet.</p>
      </Show>
    </div>
  )
}
