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
import { mandalorianAdventuresContent } from './content'
import {
  getMandalorianAdventuresEntries,
  MANDALORIAN_ADVENTURES_OBJECT_ID,
} from './mandalorianAdventuresEntries'

type MatrixDisplayMode = 'count' | 'played'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(mission: string, character: string): string {
  return `${normalizeLabel(mission)}|||${normalizeLabel(character)}`
}

export default function MandalorianAdventuresView(props: {
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
    () => ({ id: MANDALORIAN_ADVENTURES_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getMandalorianAdventuresEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('mandalorianAdventures', props.plays, props.username),
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

  const missionCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.mission, entry.quantity)
    return counts
  })

  const missionWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.mission, entry.quantity)
    }
    return counts
  })

  const playIdsByMission = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.mission)
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

  const encounterCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.encounter) continue
      incrementCount(counts, entry.encounter, entry.quantity)
    }
    return counts
  })

  const encounterWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin || !entry.encounter) continue
      incrementCount(counts, entry.encounter, entry.quantity)
    }
    return counts
  })

  const playIdsByEncounter = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.encounter) continue
      const key = normalizeLabel(entry.encounter)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.mission] ||= {}
      for (const character of entry.myCharacters) {
        incrementCount(counts[entry.mission]!, character, entry.quantity)
      }
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.mission] ||= {}
      for (const character of entry.myCharacters) {
        incrementCount(counts[entry.mission]!, character, entry.quantity)
      }
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const character of entry.myCharacters) {
        const key = pairKey(entry.mission, character)
        const existing = ids.get(key)
        if (existing) existing.push(entry.play.id)
        else ids.set(key, [entry.play.id])
      }
    }
    return ids
  })

  const missionKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(missionCounts()), mandalorianAdventuresContent.missions),
  )
  const myCharacterKeys = createMemo(() =>
    mergeCanonicalKeys(
      sortKeysByCountDesc(myCharacterCounts()),
      mandalorianAdventuresContent.characters,
    ),
  )
  const allCharacterKeys = createMemo(() =>
    mergeCanonicalKeys(
      sortKeysByCountDesc(allCharacterCounts()),
      mandalorianAdventuresContent.characters,
    ),
  )
  const encounterKeys = createMemo(() =>
    mergeCanonicalKeys(
      sortKeysByCountDesc(encounterCounts()),
      mandalorianAdventuresContent.encounters,
    ),
  )

  const matrixRows = createMemo(() => missionKeys())
  const matrixCols = createMemo(() => myCharacterKeys())

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

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const missionBox = mandalorianAdventuresContent.missionBoxByName.get(entry.mission)
      if (missionBox) boxes.add(missionBox)
      if (entry.encounter) {
        const encounterBox = mandalorianAdventuresContent.encounterBoxByName.get(entry.encounter)
        if (encounterBox) boxes.add(encounterBox)
      }
      for (const character of entry.characters) {
        const characterBox = mandalorianAdventuresContent.characterBoxByName.get(character)
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
      const missionBox = mandalorianAdventuresContent.missionBoxByName.get(entry.mission)
      if (missionBox) boxes.add(missionBox)
      if (entry.encounter) {
        const encounterBox = mandalorianAdventuresContent.encounterBoxByName.get(entry.encounter)
        if (encounterBox) boxes.add(encounterBox)
      }
      for (const character of entry.characters) {
        const characterBox = mandalorianAdventuresContent.characterBoxByName.get(character)
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
      const missionBox = mandalorianAdventuresContent.missionBoxByName.get(entry.mission)
      if (missionBox) boxes.add(missionBox)
      if (entry.encounter) {
        const encounterBox = mandalorianAdventuresContent.encounterBoxByName.get(entry.encounter)
        if (encounterBox) boxes.add(encounterBox)
      }
      for (const character of entry.characters) {
        const characterBox = mandalorianAdventuresContent.characterBoxByName.get(character)
        if (characterBox) boxes.add(characterBox)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...mandalorianAdventuresContent.boxCostsByName.entries()]
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
      Boolean(mandalorianAdventuresContent.costCurrencySymbol) &&
      mandalorianAdventuresContent.boxCostsByName.size > 0,
  )

  const getMissionGroup = (mission: string) =>
    mandalorianAdventuresContent.missionGroupByName.get(mission)
  const getCharacterGroup = (character: string) =>
    mandalorianAdventuresContent.characterGroupByName.get(character)
  const getEncounterGroup = (encounter: string) =>
    mandalorianAdventuresContent.encounterGroupByName.get(encounter)

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={MANDALORIAN_ADVENTURES_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="The Mandalorian: Adventures thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">The Mandalorian: Adventures</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'The Mandalorian: Adventures • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Mission and character tracker from BG Stats color tags.</div>
        </div>
      </div>

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Mandalorian Adventures plays found. In BG Stats, use player{' '}
            <span class="mono">color</span> like <span class="mono">Mission 1／Mandalorian／IG-11</span>{' '}
            (optionally add an encounter tag like <span class="mono">ArmorMen</span>).
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
          rows={matrixRows()}
          cols={matrixCols()}
          rowHeader="Mission"
          colHeader="My character"
          maxCount={matrixMax()}
          hideCounts={matrixDisplayMode() === 'played'}
          getCount={(mission, character) => matrix()[mission]?.[character] ?? 0}
          getWinCount={(mission, character) => matrixWins()[mission]?.[character] ?? 0}
          getCellDisplayText={(mission, character, count) => {
            if (matrixDisplayMode() === 'count') return count === 0 ? '—' : String(count)
            const wins = matrixWins()[mission]?.[character] ?? 0
            if (count === 0) return '—'
            if (wins <= 0) return '✗'
            return '✓'
          }}
          getCellLabel={(mission, character, count) => {
            const wins = matrixWins()[mission]?.[character] ?? 0
            if (count === 0) return `${mission} × ${character}: unplayed`
            return `${mission} × ${character}: ${count} plays, ${wins} wins`
          }}
          rowGroupBy={getMissionGroup}
          colGroupBy={getCharacterGroup}
          onCellClick={(mission, character) =>
            props.onOpenPlays({
              title: `The Mandalorian: Adventures • ${mission} × ${character}`,
              playIds: playIdsByPair().get(pairKey(mission, character)) ?? [],
            })
          }
        />

        <div class="statsGrid">
          <CountTable
            title="Missions"
            plays={missionCounts()}
            wins={missionWins()}
            keys={missionKeys()}
            groupBy={getMissionGroup}
            getNextAchievement={(mission) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `missionPlays:${slugifyAchievementItemId(mission)}`,
                `missionWins:${slugifyAchievementItemId(mission)}`,
              ])
            }
            onPlaysClick={(mission) =>
              props.onOpenPlays({
                title: `The Mandalorian: Adventures • Mission: ${mission}`,
                playIds: playIdsByMission().get(normalizeLabel(mission)) ?? [],
              })
            }
          />
          <CountTable
            title="My characters"
            plays={myCharacterCounts()}
            wins={myCharacterWins()}
            keys={myCharacterKeys()}
            groupBy={getCharacterGroup}
            getNextAchievement={(character) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `characterPlays:${slugifyAchievementItemId(character)}`,
                `characterWins:${slugifyAchievementItemId(character)}`,
              ])
            }
            onPlaysClick={(character) =>
              props.onOpenPlays({
                title: `The Mandalorian: Adventures • My character: ${character}`,
                playIds: playIdsByMyCharacter().get(normalizeLabel(character)) ?? [],
              })
            }
          />
          <CountTable
            title="All characters"
            plays={allCharacterCounts()}
            keys={allCharacterKeys()}
            groupBy={getCharacterGroup}
            getNextAchievement={(character) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `characterPlays:${slugifyAchievementItemId(character)}`,
              ])
            }
            onPlaysClick={(character) =>
              props.onOpenPlays({
                title: `The Mandalorian: Adventures • Character: ${character}`,
                playIds: playIdsByAllCharacter().get(normalizeLabel(character)) ?? [],
              })
            }
          />
          <CountTable
            title="Encounters"
            plays={encounterCounts()}
            wins={encounterWins()}
            keys={encounterKeys()}
            groupBy={getEncounterGroup}
            getNextAchievement={(encounter) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `encounterPlays:${slugifyAchievementItemId(encounter)}`,
              ])
            }
            onPlaysClick={(encounter) =>
              props.onOpenPlays({
                title: `The Mandalorian: Adventures • Encounter: ${encounter}`,
                playIds: playIdsByEncounter().get(normalizeLabel(encounter)) ?? [],
              })
            }
          />
          <Show when={hasCostTable()}>
            <CostPerPlayTable
              title="Cost per box"
              rows={costRows()}
              currencySymbol={mandalorianAdventuresContent.costCurrencySymbol}
              overallPlays={totalPlays()}
              overallHours={totalHours()}
              overallHoursHasAssumed={totalHoursHasAssumed()}
              onPlaysClick={(box) =>
                props.onOpenPlays({
                  title: `The Mandalorian: Adventures • Box: ${box}`,
                  playIds: playIdsByBox()[box] ?? [],
                })
              }
            />
          </Show>
        </div>
      </Show>
    </div>
  )
}
