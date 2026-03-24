import { Show, createMemo, createResource } from 'solid-js'
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
import { incrementCount } from '../../stats'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { elderScrollsContent } from './content'
import { ELDER_SCROLLS_OBJECT_ID, getElderScrollsEntries } from './elderScrollsEntries'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(province: string, heroClass: string): string {
  return `${normalizeLabel(province)}|||${normalizeLabel(heroClass)}`
}

export default function ElderScrollsView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: ELDER_SCROLLS_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getElderScrollsEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() => computeGameAchievements('elderScrolls', props.plays, props.username))
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

  const taggedPlayCount = createMemo(
    () =>
      entries().filter(
        (entry) =>
          entry.province !== 'Unknown province' &&
          entry.heroClass !== 'Unknown class' &&
          entry.race !== 'Unknown race',
      ).length,
  )
  const untaggedPlayCount = createMemo(() => entries().length - taggedPlayCount())

  const provinceCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (entry.province === 'Unknown province') continue
      incrementCount(counts, entry.province, entry.quantity)
    }
    return counts
  })
  const classCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (entry.heroClass === 'Unknown class') continue
      incrementCount(counts, entry.heroClass, entry.quantity)
    }
    return counts
  })
  const raceCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (entry.race === 'Unknown race') continue
      incrementCount(counts, entry.race, entry.quantity)
    }
    return counts
  })

  const playIdsByProvince = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (entry.province === 'Unknown province') continue
      ;(ids[entry.province] ||= []).push(entry.play.id)
    }
    return ids
  })
  const playIdsByClass = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (entry.heroClass === 'Unknown class') continue
      ;(ids[entry.heroClass] ||= []).push(entry.play.id)
    }
    return ids
  })
  const playIdsByRace = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (entry.race === 'Unknown race') continue
      ;(ids[entry.race] ||= []).push(entry.play.id)
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (entry.province === 'Unknown province' || entry.heroClass === 'Unknown class') continue
      counts[entry.province] ||= {}
      incrementCount(counts[entry.province]!, entry.heroClass, entry.quantity)
    }
    return counts
  })
  const matrixMax = createMemo(() => {
    let max = 0
    for (const row of elderScrollsContent.provinces) {
      for (const col of elderScrollsContent.classes) {
        max = Math.max(max, matrix()[row]?.[col] ?? 0)
      }
    }
    return max
  })
  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (entry.province === 'Unknown province' || entry.heroClass === 'Unknown class') continue
      const key = pairKey(entry.province, entry.heroClass)
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
      const provinceBox = elderScrollsContent.provinceBoxByName.get(entry.province)
      if (provinceBox) boxes.add(provinceBox)
      const classBox = elderScrollsContent.classBoxByName.get(entry.heroClass)
      if (classBox) boxes.add(classBox)
      const raceBox = elderScrollsContent.raceBoxByName.get(entry.race)
      if (raceBox) boxes.add(raceBox)
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })
  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const provinceBox = elderScrollsContent.provinceBoxByName.get(entry.province)
      if (provinceBox) boxes.add(provinceBox)
      const classBox = elderScrollsContent.classBoxByName.get(entry.heroClass)
      if (classBox) boxes.add(classBox)
      const raceBox = elderScrollsContent.raceBoxByName.get(entry.race)
      if (raceBox) boxes.add(raceBox)

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
      const provinceBox = elderScrollsContent.provinceBoxByName.get(entry.province)
      if (provinceBox) boxes.add(provinceBox)
      const classBox = elderScrollsContent.classBoxByName.get(entry.heroClass)
      if (classBox) boxes.add(classBox)
      const raceBox = elderScrollsContent.raceBoxByName.get(entry.race)
      if (raceBox) boxes.add(raceBox)
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...elderScrollsContent.boxCostsByName.entries()].map(([box, cost]) => ({
      box,
      cost,
      plays: boxPlayCounts()[box] ?? 0,
      hoursPlayed: boxPlayHours().hoursByBox[box] ?? 0,
      hasAssumedHours: boxPlayHours().hasAssumedHoursByBox[box] === true,
    })),
  )
  const hasCostTable = createMemo(
    () => Boolean(elderScrollsContent.costCurrencySymbol) && elderScrollsContent.boxCostsByName.size > 0,
  )

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={ELDER_SCROLLS_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="The Elder Scrolls: Betrayal of the Second Era thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">The Elder Scrolls: Betrayal of the Second Era</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Elder Scrolls • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Track province, class, and race coverage across your campaign runs.</div>
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

      <div class="finalGirlMetaRow">
        <div class="meta">
          <div class="metaLabel">Provinces played</div>
          <div class="metaValue mono">
            {elderScrollsContent.provinces.filter((province) => (provinceCounts()[province] ?? 0) > 0).length} /{' '}
            {elderScrollsContent.provinces.length}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Classes played</div>
          <div class="metaValue mono">
            {elderScrollsContent.classes.filter((heroClass) => (classCounts()[heroClass] ?? 0) > 0).length} /{' '}
            {elderScrollsContent.classes.length}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Races played</div>
          <div class="metaValue mono">
            {elderScrollsContent.races.filter((race) => (raceCounts()[race] ?? 0) > 0).length} /{' '}
            {elderScrollsContent.races.length}
          </div>
        </div>
        <div class="meta">
          <div class="metaLabel">Tagged plays</div>
          <div class="metaValue mono">
            {taggedPlayCount().toLocaleString()} / {entries().length.toLocaleString()}
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
      </div>

      <Show when={untaggedPlayCount() > 0}>
        <div class="muted">
          {untaggedPlayCount().toLocaleString()} play{untaggedPlayCount() === 1 ? '' : 's'} missing BG
          Stats tags. Expected format: <span class="mono">P: BM／C: Necro／R: Arg</span>
        </div>
      </Show>

      <Show when={totalHoursHasAssumed()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length.
        </div>
      </Show>

      <CountTable
        title="Provinces"
        plays={provinceCounts()}
        keys={elderScrollsContent.provinces}
        getNextAchievement={(province) => getNextAchievement('provincePlays', province)}
        onPlaysClick={(province) => {
          const playIds = playIdsByProvince()[province] ?? []
          props.onOpenPlays({
            title: `Elder Scrolls • ${province}`,
            playIds,
          })
        }}
      />

      <CountTable
        title="Classes"
        plays={classCounts()}
        keys={elderScrollsContent.classes}
        getNextAchievement={(heroClass) => getNextAchievement('classPlays', heroClass)}
        onPlaysClick={(heroClass) => {
          const playIds = playIdsByClass()[heroClass] ?? []
          props.onOpenPlays({
            title: `Elder Scrolls • ${heroClass}`,
            playIds,
          })
        }}
      />

      <CountTable
        title="Races"
        plays={raceCounts()}
        keys={elderScrollsContent.races}
        groupBy={(race) => elderScrollsContent.raceGroupByName.get(race)}
        getNextAchievement={(race) => getNextAchievement('racePlays', race)}
        onPlaysClick={(race) => {
          const playIds = playIdsByRace()[race] ?? []
          props.onOpenPlays({
            title: `Elder Scrolls • ${race}`,
            playIds,
          })
        }}
      />

      <div class="statsBlock">
        <div class="statsTitleRow">
          <h3 class="statsTitle">Province × Class</h3>
        </div>
        <HeatmapMatrix
          rows={elderScrollsContent.provinces}
          cols={elderScrollsContent.classes}
          rowHeader="Province"
          colHeader="Class"
          maxCount={matrixMax()}
          getCount={(province, heroClass) => matrix()[province]?.[heroClass] ?? 0}
          onCellClick={(province, heroClass) => {
            const playIds = playIdsByPair().get(pairKey(province, heroClass)) ?? []
            props.onOpenPlays({
              title: `Elder Scrolls • ${province} × ${heroClass}`,
              playIds,
            })
          }}
        />
      </div>

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          title="Cost Per Box"
          rows={costRows()}
          currencySymbol={elderScrollsContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          averageHoursPerPlay={averageHoursPerPlay()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          onPlaysClick={(box) => {
            const playIds = playIdsByBox()[box] ?? []
            props.onOpenPlays({
              title: `Elder Scrolls • ${box}`,
              playIds,
            })
          }}
        />
      </Show>
    </div>
  )
}
