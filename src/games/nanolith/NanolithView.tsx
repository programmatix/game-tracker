import { Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import AchievementsPanel from '../../components/AchievementsPanel'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import CountTable from '../../components/CountTable'
import GameThingThumb from '../../components/GameThingThumb'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { nanolithContent } from './content'
import { getNanolithEntries, NANOLITH_OBJECT_ID } from './nanolithEntries'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

export default function NanolithView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: NANOLITH_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getNanolithEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() => computeGameAchievements('nanolith', props.plays, props.username))
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

  const heroCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.hero) continue
      incrementCount(counts, entry.hero, entry.quantity)
    }
    return counts
  })
  const heroWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.hero || !entry.isWin) continue
      incrementCount(counts, entry.hero, entry.quantity)
    }
    return counts
  })
  const playIdsByHero = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.hero) continue
      const key = normalizeLabel(entry.hero)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const continuationCount = createMemo(() =>
    entries().reduce(
      (sum, entry) => sum + (entry.continuedFromPrevious || entry.continuedToNext ? entry.quantity : 0),
      0,
    ),
  )
  const taggedPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.encounter === 'Unknown encounter' ? 0 : entry.quantity), 0),
  )
  const heroTaggedPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + (entry.hero ? entry.quantity : 0), 0),
  )

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const encounterBox = nanolithContent.encounterBoxByName.get(entry.encounter)
      if (encounterBox) boxes.add(encounterBox)
      if (entry.hero) {
        const heroBox = nanolithContent.heroBoxByName.get(entry.hero)
        if (heroBox) boxes.add(heroBox)
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
      const encounterBox = nanolithContent.encounterBoxByName.get(entry.encounter)
      if (encounterBox) boxes.add(encounterBox)
      if (entry.hero) {
        const heroBox = nanolithContent.heroBoxByName.get(entry.hero)
        if (heroBox) boxes.add(heroBox)
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
      const encounterBox = nanolithContent.encounterBoxByName.get(entry.encounter)
      if (encounterBox) boxes.add(encounterBox)
      if (entry.hero) {
        const heroBox = nanolithContent.heroBoxByName.get(entry.hero)
        if (heroBox) boxes.add(heroBox)
      }
      for (const box of boxes) (ids[box] ||= []).push(entry.play.id)
    }
    return ids
  })
  const costRows = createMemo(() =>
    [...nanolithContent.boxCostsByName.entries()]
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
    () => Boolean(nanolithContent.costCurrencySymbol) && nanolithContent.boxCostsByName.size > 0,
  )

  const encounterKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(encounterCounts()), nanolithContent.encounters),
  )
  const heroKeys = createMemo(() => mergeCanonicalKeys(sortKeysByCountDesc(heroCounts()), nanolithContent.heroes))

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={NANOLITH_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Nanolith thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Nanolith</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Nanolith • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Track encounter progress from BG Stats color tags like <span class="mono">S1</span> or{' '}
            <span class="mono">H: Cora／S: 1</span>. <span class="mono">ContPrev</span> and{' '}
            <span class="mono">ContNext</span> inherit missing tags from adjacent sessions.
          </div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Nanolith plays found. In BG Stats, use player <span class="mono">color</span> like{' '}
            <span class="mono">S1</span> or <span class="mono">Hero: Ada／Encounter: 1</span>.
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
          <div class="meta">
            <div class="metaLabel">Tagged plays</div>
            <div class="metaValue mono">{taggedPlays().toLocaleString()}</div>
          </div>
          <div class="meta">
            <div class="metaLabel">Hero tags</div>
            <div class="metaValue mono">{heroTaggedPlays().toLocaleString()}</div>
          </div>
          <div class="meta">
            <div class="metaLabel">Continuations</div>
            <div class="metaValue mono">{continuationCount().toLocaleString()}</div>
          </div>
        </div>

        <Show when={totalHoursHasAssumed()}>
          <div class="muted">
            <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has no
            recorded length.
          </div>
        </Show>

        <Show when={hasCostTable()}>
          <CostPerPlayTable
            title="Cost Per Play"
            rows={costRows()}
            currencySymbol={nanolithContent.costCurrencySymbol}
            overallPlays={totalPlays()}
            overallHours={totalHours()}
            overallHoursHasAssumed={totalHoursHasAssumed()}
            averageHoursPerPlay={averageHoursPerPlay()}
            onPlaysClick={(box) => {
              const ids = playIdsByBox()[box] ?? []
              if (ids.length === 0) return
              props.onOpenPlays({ title: `Nanolith • ${box}`, playIds: ids })
            }}
          />
        </Show>

        <CountTable
          title="Encounters"
          plays={encounterCounts()}
          wins={encounterWins()}
          keys={encounterKeys()}
          getNextAchievement={(encounter) => getNextAchievement('encounterPlays', encounter)}
          onPlaysClick={(encounter) => {
            const playIds = playIdsByEncounter().get(normalizeLabel(encounter)) ?? []
            props.onOpenPlays({ title: `Nanolith • ${encounter}`, playIds })
          }}
        />

        <CountTable
          title="Heroes"
          plays={heroCounts()}
          wins={heroWins()}
          keys={heroKeys()}
          getNextAchievement={(hero) => getNextAchievement('heroPlays', hero)}
          onPlaysClick={(hero) => {
            const playIds = playIdsByHero().get(normalizeLabel(hero)) ?? []
            props.onOpenPlays({ title: `Nanolith • ${hero}`, playIds })
          }}
        />
      </Show>

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
