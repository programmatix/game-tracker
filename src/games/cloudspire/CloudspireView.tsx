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
import { cloudspireContent } from './content'
import { CLOUDSPIRE_OBJECT_ID, getCloudspireEntries } from './cloudspireEntries'

type MatrixDisplayMode = 'count' | 'played'

export default function CloudspireView(props: {
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
    () => ({ id: CLOUDSPIRE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getCloudspireEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() =>
    computeGameAchievements('cloudspire', props.plays, props.username),
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

  const myFactionCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.myFaction, entry.quantity)
    return counts
  })

  const myFactionWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.myFaction, entry.quantity)
    }
    return counts
  })

  const opponentCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.opponentFaction, entry.quantity)
    return counts
  })

  const opponentWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.opponentFaction, entry.quantity)
    }
    return counts
  })

  const modeCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.mode, entry.quantity)
    return counts
  })

  const soloEntries = createMemo(() => entries().filter((entry) => entry.mode === 'Solo'))

  const soloScenarioCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of soloEntries()) incrementCount(counts, entry.soloScenario, entry.quantity)
    return counts
  })

  const soloScenarioWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of soloEntries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.soloScenario, entry.quantity)
    }
    return counts
  })

  const soloFactionCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of soloEntries()) incrementCount(counts, entry.myFaction, entry.quantity)
    return counts
  })

  const unknownTagCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const tag of entry.unknownTags) incrementCount(counts, tag, entry.quantity)
    }
    return counts
  })

  const playIdsByMyFaction = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.myFaction] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByOpponent = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.opponentFaction] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByMode = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.mode] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsBySoloScenario = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of soloEntries()) {
      ;(ids[entry.soloScenario] ||= []).push(entry.play.id)
    }
    return ids
  })

  const soloMatrixEntries = createMemo(
    () => soloEntries().filter((entry) => entry.soloScenario !== 'Tutorial'),
  )

  const soloMatrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of soloMatrixEntries()) {
      counts[entry.myFaction] ||= {}
      incrementCount(counts[entry.myFaction]!, entry.soloScenario, entry.quantity)
    }
    return counts
  })

  const soloMatrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of soloMatrixEntries()) {
      if (!entry.isWin) continue
      counts[entry.myFaction] ||= {}
      incrementCount(counts[entry.myFaction]!, entry.soloScenario, entry.quantity)
    }
    return counts
  })

  const playIdsBySoloFactionScenario = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of soloMatrixEntries()) {
      const key = `${entry.myFaction}|||${entry.soloScenario}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const playIdsByUnknownTag = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const tag of entry.unknownTags) (ids[tag] ||= []).push(entry.play.id)
    }
    return ids
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const myBox = cloudspireContent.factionGroupByName.get(entry.myFaction)
      if (myBox) incrementCount(counts, myBox, entry.quantity)
      const opponentBox = cloudspireContent.factionGroupByName.get(entry.opponentFaction)
      if (opponentBox) incrementCount(counts, opponentBox, entry.quantity)
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
      const myBox = cloudspireContent.factionGroupByName.get(entry.myFaction)
      if (myBox) boxes.add(myBox)
      const opponentBox = cloudspireContent.factionGroupByName.get(entry.opponentFaction)
      if (opponentBox) boxes.add(opponentBox)

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
      const myBox = cloudspireContent.factionGroupByName.get(entry.myFaction)
      if (myBox) (ids[myBox] ||= []).push(entry.play.id)
      const opponentBox = cloudspireContent.factionGroupByName.get(entry.opponentFaction)
      if (opponentBox) (ids[opponentBox] ||= []).push(entry.play.id)
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...cloudspireContent.boxCostsByName.entries()]
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
      Boolean(cloudspireContent.costCurrencySymbol) &&
      cloudspireContent.boxCostsByName.size > 0,
  )

  const factionGroupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const faction of cloudspireContent.factions) {
      const group = cloudspireContent.factionGroupByName.get(faction)?.trim()
      if (!group || seen.has(group)) continue
      seen.add(group)
      order.push(group)
    }
    return order
  })

  const myFactionKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(myFactionCounts()), cloudspireContent.factions),
      myFactionCounts(),
      (faction) => cloudspireContent.factionGroupByName.get(faction),
      factionGroupOrder(),
    ),
  )

  const soloFactionKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(soloFactionCounts()), cloudspireContent.factions),
      soloFactionCounts(),
      (faction) => cloudspireContent.factionGroupByName.get(faction),
      factionGroupOrder(),
    ),
  )

  const opponentKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(opponentCounts()), cloudspireContent.factions),
      opponentCounts(),
      (faction) => cloudspireContent.factionGroupByName.get(faction),
      factionGroupOrder(),
    ),
  )

  const modeKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(modeCounts()), cloudspireContent.modes),
  )
  const soloScenarioKeys = createMemo(() => sortKeysByCountDesc(soloScenarioCounts()))
  const soloMatrixScenarioKeys = createMemo(() =>
    soloScenarioKeys().filter((scenario) => scenario !== 'Tutorial'),
  )

  const unknownTagKeys = createMemo(() => sortKeysByCountDesc(unknownTagCounts()))
  const soloMatrixMax = createMemo(() => {
    let max = 0
    for (const row of soloFactionKeys()) {
      for (const col of soloMatrixScenarioKeys()) {
        const value = soloMatrix()[row]?.[col] ?? 0
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
          objectId={CLOUDSPIRE_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Cloudspire thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Cloudspire</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Cloudspire • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Solo progression: which scenarios you have finished.</div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Cloudspire plays found. Use BG Stats player <span class="mono">color</span> tags like{' '}
            <span class="mono">F: Braw／O: Naro／M: Solo／S: Scenario 1</span> or{' '}
            <span class="mono">Braw／Naro／Solo／S1</span>.
          </div>
        }
      >
        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">My faction × Solo scenario</h3>
            <div class="matrixControls">
              <label class="control">
                <span>Display</span>
                <select
                  value={matrixDisplayMode()}
                  onInput={(e) => setMatrixDisplayMode(e.currentTarget.value as MatrixDisplayMode)}
                >
                  <option value="count">Count</option>
                  <option value="played">Played</option>
                </select>
              </label>
            </div>
          </div>

          <HeatmapMatrix
            rows={soloFactionKeys()}
            cols={soloMatrixScenarioKeys()}
            rowHeader="My faction"
            colHeader="Solo scenario"
            rowGroupBy={(row) => cloudspireContent.factionGroupByName.get(row)}
            getCount={(row, col) => soloMatrix()[row]?.[col] ?? 0}
            getWinCount={(row, col) => soloMatrixWins()[row]?.[col] ?? 0}
            maxCount={soloMatrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            onCellClick={(row, col) => {
              const key = `${row}|||${col}`
              props.onOpenPlays({
                title: `Cloudspire • ${row} • ${col}`,
                playIds: playIdsBySoloFactionScenario().get(key) ?? [],
              })
            }}
          />
        </div>

        <Show when={hasCostTable()}>
          <CostPerPlayTable
            title="Cost per box"
            rows={costRows()}
            currencySymbol={cloudspireContent.costCurrencySymbol}
            overallPlays={totalPlays()}
            overallHours={totalHours()}
            overallHoursHasAssumed={totalHoursHasAssumed()}
            onPlaysClick={(box) =>
              props.onOpenPlays({
                title: `Cloudspire • Box: ${box}`,
                playIds: playIdsByBox()[box] ?? [],
              })
            }
          />
        </Show>

        <div class="statsGrid">
          <CountTable
            title="Solo scenarios"
            plays={soloScenarioCounts()}
            wins={soloScenarioWins()}
            keys={soloScenarioKeys()}
            onPlaysClick={(scenario) =>
              props.onOpenPlays({
                title: `Cloudspire • Solo scenario: ${scenario}`,
                playIds: playIdsBySoloScenario()[scenario] ?? [],
              })
            }
          />
          <CountTable
            title="My faction"
            plays={myFactionCounts()}
            wins={myFactionWins()}
            keys={myFactionKeys()}
            groupBy={(faction) => cloudspireContent.factionGroupByName.get(faction)}
            getNextAchievement={(key) => getNextAchievement('factionWins', key)}
            onPlaysClick={(faction) =>
              props.onOpenPlays({
                title: `Cloudspire • My faction: ${faction}`,
                playIds: playIdsByMyFaction()[faction] ?? [],
              })
            }
          />
          <CountTable
            title="Opposing faction"
            plays={opponentCounts()}
            wins={opponentWins()}
            keys={opponentKeys()}
            groupBy={(faction) => cloudspireContent.factionGroupByName.get(faction)}
            getNextAchievement={(key) => getNextAchievement('opponentWins', key)}
            onPlaysClick={(faction) =>
              props.onOpenPlays({
                title: `Cloudspire • Opponent faction: ${faction}`,
                playIds: playIdsByOpponent()[faction] ?? [],
              })
            }
          />
          <CountTable
            title="Modes"
            plays={modeCounts()}
            keys={modeKeys()}
            getNextAchievement={(key) => getNextAchievement('modePlays', key)}
            onPlaysClick={(mode) =>
              props.onOpenPlays({
                title: `Cloudspire • Mode: ${mode}`,
                playIds: playIdsByMode()[mode] ?? [],
              })
            }
          />
          <Show when={unknownTagKeys().length > 0}>
            <CountTable
              title="Unknown tags"
              plays={unknownTagCounts()}
              keys={unknownTagKeys()}
              onPlaysClick={(tag) =>
                props.onOpenPlays({
                  title: `Cloudspire • Unknown tag: ${tag}`,
                  playIds: playIdsByUnknownTag()[tag] ?? [],
                })
              }
            />
          </Show>
        </div>
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
