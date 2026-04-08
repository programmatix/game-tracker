import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import {
  thingAssumedPlayTimeMinutes,
  totalPlayMinutesWithAssumption,
} from '../../playDuration'
import { robinHoodContent } from './content'
import { getRobinHoodEntries, ROBIN_HOOD_OBJECT_ID } from './robinHoodEntries'

type MatrixDisplayMode = 'count' | 'played'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(adventure: string, character: string): string {
  return `${normalizeLabel(adventure)}|||${normalizeLabel(character)}`
}

export default function RobinHoodView(props: {
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
    () => ({ id: ROBIN_HOOD_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getRobinHoodEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() => computeGameAchievements('robinHood', props.plays, props.username))
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

  const adventureCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.adventure, entry.quantity)
    return counts
  })

  const adventureWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.adventure, entry.quantity)
    }
    return counts
  })

  const playIdsByAdventure = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.adventure)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const myCharacterCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const character of entry.myCharacters) incrementCount(counts, character, entry.quantity)
    }
    return counts
  })

  const myCharacterWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const character of entry.myCharacters) incrementCount(counts, character, entry.quantity)
    }
    return counts
  })

  const playIdsByMyCharacter = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const character of entry.myCharacters) {
        const key = normalizeLabel(character)
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const allCharacterCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const character of entry.characters) incrementCount(counts, character, entry.quantity)
    }
    return counts
  })

  const playIdsByAllCharacter = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const character of entry.characters) {
        const key = normalizeLabel(character)
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
      counts[entry.adventure] ||= {}
      for (const character of entry.myCharacters) {
        incrementCount(counts[entry.adventure]!, character, entry.quantity)
      }
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.adventure] ||= {}
      for (const character of entry.myCharacters) {
        incrementCount(counts[entry.adventure]!, character, entry.quantity)
      }
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const character of entry.myCharacters) {
        const key = pairKey(entry.adventure, character)
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const matrixMax = createMemo(() => {
    let max = 0
    for (const row of robinHoodContent.adventures) {
      for (const col of robinHoodContent.characters) {
        const value = matrix()[row]?.[col] ?? 0
        if (value > max) max = value
      }
    }
    return max
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const adventureBox = robinHoodContent.adventureBoxByName.get(entry.adventure)
      if (adventureBox) boxes.add(adventureBox)
      for (const character of entry.characters) {
        const characterBox = robinHoodContent.characterBoxByName.get(character)
        if (characterBox) boxes.add(characterBox)
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
      const adventureBox = robinHoodContent.adventureBoxByName.get(entry.adventure)
      if (adventureBox) boxes.add(adventureBox)
      for (const character of entry.characters) {
        const characterBox = robinHoodContent.characterBoxByName.get(character)
        if (characterBox) boxes.add(characterBox)
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
      const adventureBox = robinHoodContent.adventureBoxByName.get(entry.adventure)
      if (adventureBox) boxes.add(adventureBox)
      for (const character of entry.characters) {
        const characterBox = robinHoodContent.characterBoxByName.get(character)
        if (characterBox) boxes.add(characterBox)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...robinHoodContent.boxCostsByName.entries()]
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
    () => Boolean(robinHoodContent.costCurrencySymbol) && robinHoodContent.boxCostsByName.size > 0,
  )

  const adventureKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(adventureCounts()), robinHoodContent.adventures),
  )
  const myCharacterKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(myCharacterCounts()), robinHoodContent.characters),
  )
  const allCharacterKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(allCharacterCounts()), robinHoodContent.characters),
  )

  const continuationCount = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.continuedFromPrevious ? entry.quantity : 0), 0),
  )

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={ROBIN_HOOD_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="The Adventures of Robin Hood thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">The Adventures of Robin Hood</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'The Adventures of Robin Hood • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Adventure and character tracker from BG Stats color tags. <span class="mono">ContPrev</span>{' '}
            inherits the most recent Robin Hood adventure and party.
          </div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Robin Hood plays found. In BG Stats, use player <span class="mono">color</span> like{' '}
            <span class="mono">Mari／Robi／Will／John／1</span>, <span class="mono">Robi／2／Mari</span>,
            or <span class="mono">ContPrev</span>.
          </div>
        }
      >
        <div class="matrixHeaderRow">
          <div class="muted">
            Matrix mode:{' '}
            <span class="mono">
              {matrixDisplayMode() === 'played' ? 'Played/Unplayed' : 'Play counts'}
            </span>
            {' • '}
            Continuations: <span class="mono">{continuationCount().toLocaleString()}</span>
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
          rows={robinHoodContent.adventures}
          cols={robinHoodContent.characters}
          rowHeader="Adventure"
          colHeader="My character"
          maxCount={matrixMax()}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(adventure, character) => matrix()[adventure]?.[character] ?? 0}
          getWinCount={(adventure, character) => matrixWins()[adventure]?.[character] ?? 0}
          getCellDisplayText={(adventure, character, count) => {
            if (matrixDisplayMode() === 'count') return count === 0 ? '—' : String(count)
            const wins = matrixWins()[adventure]?.[character] ?? 0
            if (count === 0) return '—'
            if (wins <= 0) return '✗'
            return '✓'
          }}
          getCellLabel={(adventure, character, count) => {
            const wins = matrixWins()[adventure]?.[character] ?? 0
            if (count === 0) return `${adventure} × ${character}: unplayed`
            return `${adventure} × ${character}: ${count} plays, ${wins} wins`
          }}
          rowGroupBy={(adventure) => robinHoodContent.adventureGroupByName.get(adventure)}
          colGroupBy={(character) => robinHoodContent.characterGroupByName.get(character)}
          onCellClick={(adventure, character) =>
            props.onOpenPlays({
              title: `The Adventures of Robin Hood • ${adventure} × ${character}`,
              playIds: playIdsByPair().get(pairKey(adventure, character)) ?? [],
            })
          }
        />

        <Show when={hasCostTable()}>
          <CostPerPlayTable
            title="Cost per box"
            rows={costRows()}
            currencySymbol={robinHoodContent.costCurrencySymbol}
            overallPlays={totalPlays()}
            overallHours={totalHours()}
            overallHoursHasAssumed={totalHoursHasAssumed()}
            onPlaysClick={(box) =>
              props.onOpenPlays({
                title: `The Adventures of Robin Hood • Box: ${box}`,
                playIds: playIdsByBox()[box] ?? [],
              })
            }
          />
        </Show>

        <div class="statsGrid">
          <CountTable
            title="Adventures"
            plays={adventureCounts()}
            wins={adventureWins()}
            keys={adventureKeys()}
            groupBy={(adventure) => robinHoodContent.adventureGroupByName.get(adventure)}
            getNextAchievement={(adventure) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `adventurePlays:${slugifyAchievementItemId(adventure)}`,
                `adventureWins:${slugifyAchievementItemId(adventure)}`,
              ])
            }
            onPlaysClick={(adventure) =>
              props.onOpenPlays({
                title: `The Adventures of Robin Hood • Adventure: ${adventure}`,
                playIds: playIdsByAdventure().get(normalizeLabel(adventure)) ?? [],
              })
            }
          />
          <CountTable
            title="My characters"
            plays={myCharacterCounts()}
            wins={myCharacterWins()}
            keys={myCharacterKeys()}
            groupBy={(character) => robinHoodContent.characterGroupByName.get(character)}
            getNextAchievement={(character) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `characterPlays:${slugifyAchievementItemId(character)}`,
                `characterWins:${slugifyAchievementItemId(character)}`,
              ])
            }
            onPlaysClick={(character) =>
              props.onOpenPlays({
                title: `The Adventures of Robin Hood • My character: ${character}`,
                playIds: playIdsByMyCharacter().get(normalizeLabel(character)) ?? [],
              })
            }
          />
          <CountTable
            title="Party characters"
            plays={allCharacterCounts()}
            keys={allCharacterKeys()}
            groupBy={(character) => robinHoodContent.characterGroupByName.get(character)}
            getNextAchievement={(character) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `characterPlays:${slugifyAchievementItemId(character)}`,
              ])
            }
            onPlaysClick={(character) =>
              props.onOpenPlays({
                title: `The Adventures of Robin Hood • Party character: ${character}`,
                playIds: playIdsByAllCharacter().get(normalizeLabel(character)) ?? [],
              })
            }
          />
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
