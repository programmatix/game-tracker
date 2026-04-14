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
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { oathswornContent } from './content'
import { getOathswornEntries, OATHSWORN_OBJECT_ID } from './oathswornEntries'

type MatrixDisplayMode = 'count' | 'played'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(encounter: string, character: string): string {
  return `${normalizeLabel(encounter)}|||${normalizeLabel(character)}`
}

export default function OathswornView(props: {
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
    () => ({ id: OATHSWORN_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getOathswornEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('oathsworn', props.plays, props.username),
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

  const storyCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.story, entry.quantity)
    return counts
  })
  const storyWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.story, entry.quantity)
    }
    return counts
  })
  const playIdsByStory = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.story)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const encounterCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.encounter, entry.quantity)
    return counts
  })
  const encounterWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.encounter, entry.quantity)
    }
    return counts
  })
  const playIdsByEncounter = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.encounter)
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
  const playIdsByCharacter = createMemo(() => {
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

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.encounter] ||= {}
      for (const character of entry.myCharacters) {
        incrementCount(counts[entry.encounter]!, character, entry.quantity)
      }
    }
    return counts
  })
  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      counts[entry.encounter] ||= {}
      for (const character of entry.myCharacters) {
        incrementCount(counts[entry.encounter]!, character, entry.quantity)
      }
    }
    return counts
  })
  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      for (const character of entry.myCharacters) {
        const key = pairKey(entry.encounter, character)
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
      const storyBox = oathswornContent.storyBoxByName.get(entry.story)
      if (storyBox) boxes.add(storyBox)
      const encounterBox = oathswornContent.encounterBoxByName.get(entry.encounter)
      if (encounterBox) boxes.add(encounterBox)
      for (const character of entry.characters) {
        const characterBox = oathswornContent.characterBoxByName.get(character)
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
      const storyBox = oathswornContent.storyBoxByName.get(entry.story)
      if (storyBox) boxes.add(storyBox)
      const encounterBox = oathswornContent.encounterBoxByName.get(entry.encounter)
      if (encounterBox) boxes.add(encounterBox)
      for (const character of entry.characters) {
        const characterBox = oathswornContent.characterBoxByName.get(character)
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
      const storyBox = oathswornContent.storyBoxByName.get(entry.story)
      if (storyBox) boxes.add(storyBox)
      const encounterBox = oathswornContent.encounterBoxByName.get(entry.encounter)
      if (encounterBox) boxes.add(encounterBox)
      for (const character of entry.characters) {
        const characterBox = oathswornContent.characterBoxByName.get(character)
        if (characterBox) boxes.add(characterBox)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...oathswornContent.boxCostsByName.entries()]
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
    () => Boolean(oathswornContent.costCurrencySymbol) && oathswornContent.boxCostsByName.size > 0,
  )

  const storyKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(storyCounts()), oathswornContent.stories),
  )
  const encounterKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(encounterCounts()), oathswornContent.encounters),
  )
  const characterKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(myCharacterCounts()), oathswornContent.characters),
  )

  const matrixMax = createMemo(() => {
    let max = 0
    for (const row of oathswornContent.encounters) {
      for (const col of oathswornContent.characters) {
        const value = matrix()[row]?.[col] ?? 0
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
          objectId={OATHSWORN_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Oathsworn: Into the Deepwood thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Oathsworn: Into the Deepwood</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Oathsworn: Into the Deepwood • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Track story chapters, encounter chapters, and party characters from BG Stats tags.</div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Oathsworn plays found. In BG Stats, use player <span class="mono">color</span> like{' '}
            <span class="mono">Urs／Har／Pri／Ran／S1／E1</span>.
          </div>
        }
      >
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
            currencySymbol={oathswornContent.costCurrencySymbol}
            overallPlays={totalPlays()}
            overallHours={totalHours()}
            overallHoursHasAssumed={totalHoursHasAssumed()}
            averageHoursPerPlay={averageHoursPerPlay()}
            title="Cost Per Play"
            onPlaysClick={(box) => {
              const playIds = playIdsByBox()[box] ?? []
              if (playIds.length === 0) return
              props.onOpenPlays({ title: `Oathsworn • ${box}`, playIds })
            }}
          />
        </Show>

        <CountTable
          title="Story Chapters"
          plays={storyCounts()}
          wins={storyWins()}
          keys={storyKeys()}
          groupBy={(story) => oathswornContent.storyGroupByName.get(story)}
          getNextAchievement={(story) => getNextAchievement('storyPlays', story)}
          onPlaysClick={(story) => {
            const playIds = playIdsByStory().get(normalizeLabel(story)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({ title: `Oathsworn • ${story}`, playIds })
          }}
        />

        <CountTable
          title="Encounter Chapters"
          plays={encounterCounts()}
          wins={encounterWins()}
          keys={encounterKeys()}
          groupBy={(encounter) => oathswornContent.encounterGroupByName.get(encounter)}
          getNextAchievement={(encounter) => getNextAchievement('encounterPlays', encounter)}
          onPlaysClick={(encounter) => {
            const playIds = playIdsByEncounter().get(normalizeLabel(encounter)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({ title: `Oathsworn • ${encounter}`, playIds })
          }}
        />

        <CountTable
          title="Characters"
          plays={myCharacterCounts()}
          wins={myCharacterWins()}
          keys={characterKeys()}
          groupBy={(character) => oathswornContent.characterGroupByName.get(character)}
          getNextAchievement={(character) => getNextAchievement('characterPlays', character)}
          onPlaysClick={(character) => {
            const playIds = playIdsByCharacter().get(normalizeLabel(character)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({ title: `Oathsworn • ${character}`, playIds })
          }}
        />

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">Encounter × Character</h3>
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
          <div class="muted">Secondary analysis: which party characters you used against each encounter chapter.</div>
          <HeatmapMatrix
            rows={oathswornContent.encounters}
            cols={oathswornContent.characters}
            rowHeader="Encounter"
            colHeader="Character"
            maxCount={matrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            getCount={(encounter, character) => matrix()[encounter]?.[character] ?? 0}
            getWinCount={(encounter, character) => matrixWins()[encounter]?.[character] ?? 0}
            getCellDisplayText={(_encounter, _character, count) =>
              matrixDisplayMode() === 'played' ? (count > 0 ? '✓' : '') : count === 0 ? '—' : String(count)
            }
            getCellLabel={(encounter, character, count) => `${encounter} × ${character}: ${count}`}
            rowGroupBy={(encounter) => oathswornContent.encounterGroupByName.get(encounter)}
            colGroupBy={(character) => oathswornContent.characterGroupByName.get(character)}
            onCellClick={(encounter, character) => {
              const playIds = playIdsByPair().get(pairKey(encounter, character)) ?? []
              if (playIds.length === 0) return
              props.onOpenPlays({
                title: `Oathsworn • ${encounter} × ${character}`,
                playIds,
              })
            }}
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
