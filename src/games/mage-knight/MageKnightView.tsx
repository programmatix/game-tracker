import { For, Show, createMemo, createResource } from 'solid-js'
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
import { formatMageKnightScenarioLabel, mageKnightContent } from './content'
import { getMageKnightEntries } from './mageKnightEntries'

const MAGE_KNIGHT_ULTIMATE_OBJECT_ID = '248562'

export default function MageKnightView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: MAGE_KNIGHT_ULTIMATE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getMageKnightEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('mageKnight', props.plays, props.username),
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

  const heroCountsAll = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const hero of entry.heroes) incrementCount(counts, hero, entry.quantity)
    }
    return counts
  })

  const playIdsByHeroAll = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const hero of entry.heroes) {
        ;(ids[hero] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const heroCountsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myHero) continue
      incrementCount(counts, entry.myHero, entry.quantity)
    }
    return counts
  })

  const playIdsByHeroMine = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (!entry.myHero) continue
      ;(ids[entry.myHero] ||= []).push(entry.play.id)
    }
    return ids
  })

  const heroWinsMine = createMemo(() => {
    const wins: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myHero || !entry.isWin) continue
      incrementCount(wins, entry.myHero, entry.quantity)
    }
    return wins
  })

  const scenarioCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.scenario) continue
      incrementCount(counts, entry.scenario, entry.quantity)
    }
    return counts
  })

  const scenarioWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.scenario || !entry.isWin) continue
      incrementCount(counts, entry.scenario, entry.quantity)
    }
    return counts
  })

  const playIdsByScenario = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (!entry.scenario) continue
      ;(ids[entry.scenario] ||= []).push(entry.play.id)
    }
    return ids
  })

  const heroGroupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const hero of mageKnightContent.heroes) {
      const group = mageKnightContent.heroBoxByName.get(hero)?.trim()
      if (!group || seen.has(group)) continue
      seen.add(group)
      order.push(group)
    }
    return order
  })

  const scenarioGroupOrder = createMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const scenario of mageKnightContent.scenarios) {
      const group = mageKnightContent.scenarioGroupByName.get(scenario)?.trim()
      if (!group || seen.has(group)) continue
      seen.add(group)
      order.push(group)
    }
    return order
  })

  const heroKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(heroCountsMine()), mageKnightContent.heroes),
      heroCountsMine(),
      (hero) => mageKnightContent.heroBoxByName.get(hero),
      heroGroupOrder(),
    ),
  )

  const scenarioKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(sortKeysByCountDesc(scenarioCounts()), mageKnightContent.scenarios),
      scenarioCounts(),
      (scenario) => mageKnightContent.scenarioGroupByName.get(scenario),
      scenarioGroupOrder(),
    ),
  )

  const heroScenarioMatrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.myHero || !entry.scenario) continue
      counts[entry.myHero] ||= {}
      incrementCount(counts[entry.myHero]!, entry.scenario, entry.quantity)
    }
    return counts
  })

  const heroScenarioWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.myHero || !entry.scenario || !entry.isWin) continue
      counts[entry.myHero] ||= {}
      incrementCount(counts[entry.myHero]!, entry.scenario, entry.quantity)
    }
    return counts
  })

  const playIdsByHeroScenario = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.myHero || !entry.scenario) continue
      const key = `${entry.myHero}|||${entry.scenario}`
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
      for (const hero of entry.heroes) {
        const box = mageKnightContent.heroBoxByName.get(hero)
        if (box) boxes.add(box)
      }
      const scenarioBox = entry.scenario ? mageKnightContent.scenarioBoxByName.get(entry.scenario) : undefined
      if (scenarioBox) boxes.add(scenarioBox)
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      for (const hero of entry.heroes) {
        const box = mageKnightContent.heroBoxByName.get(hero)
        if (box) boxes.add(box)
      }
      const scenarioBox = entry.scenario ? mageKnightContent.scenarioBoxByName.get(entry.scenario) : undefined
      if (scenarioBox) boxes.add(scenarioBox)
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
      for (const hero of entry.heroes) {
        const box = mageKnightContent.heroBoxByName.get(hero)
        if (box) boxes.add(box)
      }
      const scenarioBox = entry.scenario ? mageKnightContent.scenarioBoxByName.get(entry.scenario) : undefined
      if (scenarioBox) boxes.add(scenarioBox)
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...mageKnightContent.boxCostsByName.entries()]
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
      Boolean(mageKnightContent.costCurrencySymbol) &&
      mageKnightContent.boxCostsByName.size > 0,
  )

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  const maxMatrixCount = createMemo(() => {
    let max = 0
    for (const row of Object.values(heroScenarioMatrix())) {
      for (const count of Object.values(row)) {
        if (count > max) max = count
      }
    }
    return max
  })

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={MAGE_KNIGHT_ULTIMATE_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Mage Knight thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Mage Knight</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({ title: 'Mage Knight • All plays', playIds: allPlayIds() })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Solo tracker for heroes and recommended scenarios. Use BG Stats tags like{' '}
            <span class="mono">Goldyx／SConq</span> or <span class="mono">H: Goldyx／S: VolQu</span>
            . Scenario short codes are shown in brackets below. If you omit the scenario, it
            defaults to <span class="mono">SConq</span> unless the play is tagged{' '}
            <span class="mono">ContPrev</span> or <span class="mono">ContNext</span>.
          </div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Mage Knight plays found. In BG Stats, put your hero in the player{' '}
            <span class="mono">color</span> field like <span class="mono">Goldyx</span> or{' '}
            <span class="mono">H: Goldyx</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <div class="statsBlock">
            <h3 class="statsTitle">My heroes × scenarios</h3>
            <HeatmapMatrix
              rows={heroKeys()}
              cols={scenarioKeys()}
              rowHeader="Hero"
              colHeader="Scenario"
              getColLabel={formatMageKnightScenarioLabel}
              rowGroupBy={(hero) => mageKnightContent.heroBoxByName.get(hero)}
              colGroupBy={(scenario) => mageKnightContent.scenarioGroupByName.get(scenario)}
              getCount={(hero, scenario) => heroScenarioMatrix()[hero]?.[scenario] ?? 0}
              getWinCount={(hero, scenario) => heroScenarioWins()[hero]?.[scenario] ?? 0}
              maxCount={maxMatrixCount()}
              onCellClick={(hero, scenario) =>
                props.onOpenPlays({
                  title: `Mage Knight • ${hero} × ${formatMageKnightScenarioLabel(scenario)}`,
                  playIds: playIdsByHeroScenario().get(`${hero}|||${scenario}`) ?? [],
                })
              }
            />
          </div>
          <Show when={hasCostTable()}>
            <CostPerPlayTable
              title="Cost per box"
              rows={costRows()}
              currencySymbol={mageKnightContent.costCurrencySymbol}
              overallPlays={totalPlays()}
              overallHours={totalHours()}
              overallHoursHasAssumed={totalHoursHasAssumed()}
              onPlaysClick={(box) =>
                props.onOpenPlays({
                  title: `Mage Knight • Box: ${box}`,
                  playIds: playIdsByBox()[box] ?? [],
                })
              }
            />
          </Show>
          <CountTable
            title="My heroes"
            plays={heroCountsMine()}
            wins={heroWinsMine()}
            keys={heroKeys()}
            groupBy={(hero) => mageKnightContent.heroBoxByName.get(hero)}
            getNextAchievement={(hero) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `heroPlays:${slugifyAchievementItemId(hero)}`,
                `heroWins:${slugifyAchievementItemId(hero)}`,
              ])
            }
            onPlaysClick={(hero) =>
              props.onOpenPlays({
                title: `Mage Knight • My hero: ${hero}`,
                playIds: playIdsByHeroMine()[hero] ?? [],
              })
            }
          />
          <CountTable
            title="All heroes"
            plays={heroCountsAll()}
            keys={heroKeys()}
            groupBy={(hero) => mageKnightContent.heroBoxByName.get(hero)}
            getNextAchievement={(hero) => getNextAchievement('heroPlays', hero)}
            onPlaysClick={(hero) =>
              props.onOpenPlays({
                title: `Mage Knight • Hero: ${hero}`,
                playIds: playIdsByHeroAll()[hero] ?? [],
              })
            }
          />
          <CountTable
            title="Scenarios"
            plays={scenarioCounts()}
            wins={scenarioWins()}
            keys={scenarioKeys()}
            getLabel={formatMageKnightScenarioLabel}
            groupBy={(scenario) => mageKnightContent.scenarioGroupByName.get(scenario)}
            getNextAchievement={(scenario) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `scenarioPlays:${slugifyAchievementItemId(scenario)}`,
                `scenarioWins:${slugifyAchievementItemId(scenario)}`,
              ])
            }
            onPlaysClick={(scenario) =>
              props.onOpenPlays({
                title: `Mage Knight • Scenario: ${formatMageKnightScenarioLabel(scenario)}`,
                playIds: playIdsByScenario()[scenario] ?? [],
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

      <div class="statsBlock">
        <h3 class="statsTitle">Scenario guide</h3>
        <div class="tableWrap compact">
          <table class="table compactTable">
            <thead>
              <tr>
                <th>Scenario</th>
                <th class="mono">Rounds</th>
                <th>Expansion</th>
                <th>Recommended</th>
              </tr>
            </thead>
            <tbody>
              <For each={scenarioKeys()}>
                {(scenario) => (
                  <tr>
                    <td>{formatMageKnightScenarioLabel(scenario)}</td>
                    <td class="mono">
                      {mageKnightContent.scenarioRoundsByName.get(scenario)?.toLocaleString() ?? '—'}
                    </td>
                    <td>{mageKnightContent.scenarioExpansionByName.get(scenario) ?? 'Core'}</td>
                    <td>{mageKnightContent.scenarioRecommendedByName.get(scenario) ? 'Yes' : '—'}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
