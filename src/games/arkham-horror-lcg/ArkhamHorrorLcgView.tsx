import { Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CampaignProgressTable from '../../components/CampaignProgressTable'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import { pickBestAvailableAchievementForTrackIds, slugifyAchievementItemId } from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByGroupThenCountDesc } from '../../stats'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import { arkhamHorrorLcgContent } from './content'
import { ARKHAM_HORROR_LCG_OBJECT_ID, getArkhamHorrorLcgEntries } from './arkhamHorrorLcgEntries'

function uniquePlayIds(values: number[]): number[] {
  return [...new Set(values)]
}

export default function ArkhamHorrorLcgView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: ARKHAM_HORROR_LCG_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getArkhamHorrorLcgEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('arkhamHorrorLcg', props.plays, props.username),
  )
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
      if (
        totalPlayMinutesWithAssumption({
          attributes: entry.play.attributes,
          quantity: entry.quantity,
          assumedMinutesPerPlay: assumedMinutesPerPlay(),
        }).assumed
      ) return true
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

  const campaignCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.campaign, entry.quantity)
    return counts
  })

  const scenarioCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.scenario, entry.quantity)
    return counts
  })
  const scenarioWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.scenario, entry.quantity)
    }
    return counts
  })

  const difficultyCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.difficulty, entry.quantity)
    return counts
  })

  const difficultyWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.difficulty, entry.quantity)
    }
    return counts
  })

  const investigatorCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const investigator of entry.investigators) incrementCount(counts, investigator, entry.quantity)
    }
    return counts
  })

  const investigatorWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const investigator of entry.investigators) incrementCount(counts, investigator, entry.quantity)
    }
    return counts
  })

  const playIdsByCampaign = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.campaign] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByScenario = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.scenario] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByInvestigator = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const investigator of entry.investigators) {
        ;(ids[investigator] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const playIdsByDifficulty = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.difficulty] ||= []).push(entry.play.id)
    }
    return ids
  })

  const taggedPlays = createMemo(() =>
    entries().reduce(
      (sum, entry) =>
        sum +
        (entry.campaign === 'Unknown campaign' &&
        entry.scenario === 'Unknown scenario' &&
        entry.investigators.length === 0 &&
        entry.difficulty === 'Unknown difficulty'
          ? 0
          : entry.quantity),
      0,
    ),
  )
  const untaggedPlays = createMemo(() => totalPlays() - taggedPlays())
  const continuationCount = createMemo(() =>
    entries().reduce(
      (sum, entry) => sum + (entry.continuedFromPrevious || entry.continuedToNext ? entry.quantity : 0),
      0,
    ),
  )

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const campaignBox = arkhamHorrorLcgContent.campaignBoxByName.get(entry.campaign)
      const scenarioBox = arkhamHorrorLcgContent.scenarioBoxByName.get(entry.scenario)
      if (campaignBox) boxes.add(campaignBox)
      if (scenarioBox) boxes.add(scenarioBox)
      for (const investigator of entry.investigators) {
        const box = arkhamHorrorLcgContent.investigatorBoxByName.get(investigator)
        if (box) boxes.add(box)
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
  const scenarioPlayHours = createMemo(() => {
    const hoursByScenario: Record<string, number> = {}
    const hasAssumedHoursByScenario: Record<string, boolean> = {}
    for (const entry of entries()) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      incrementCount(hoursByScenario, entry.scenario, resolved.minutes / 60)
      if (resolved.assumed) hasAssumedHoursByScenario[entry.scenario] = true
    }
    return { hoursByScenario, hasAssumedHoursByScenario }
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const campaignBox = arkhamHorrorLcgContent.campaignBoxByName.get(entry.campaign)
      const scenarioBox = arkhamHorrorLcgContent.scenarioBoxByName.get(entry.scenario)
      if (campaignBox) boxes.add(campaignBox)
      if (scenarioBox) boxes.add(scenarioBox)
      for (const investigator of entry.investigators) {
        const box = arkhamHorrorLcgContent.investigatorBoxByName.get(investigator)
        if (box) boxes.add(box)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...arkhamHorrorLcgContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: uniquePlayIds(playIdsByBox()[box] ?? []).length,
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
    () => Boolean(arkhamHorrorLcgContent.costCurrencySymbol) && arkhamHorrorLcgContent.boxCostsByName.size > 0,
  )

  const campaignKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(arkhamHorrorLcgContent.campaigns, Object.keys(campaignCounts())),
      campaignCounts(),
      (campaign) => arkhamHorrorLcgContent.campaignGroupByName.get(campaign),
      ['Campaigns', 'Standalone'],
    ),
  )

  const scenarioKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(arkhamHorrorLcgContent.scenarios, Object.keys(scenarioCounts())),
      scenarioCounts(),
      (scenario) => arkhamHorrorLcgContent.scenarioCampaignByName.get(scenario),
      arkhamHorrorLcgContent.campaigns,
    ),
  )
  const campaignSections = createMemo(() =>
    arkhamHorrorLcgContent.campaigns
      .map((campaign) => {
        const scenarios = arkhamHorrorLcgContent.scenarioNamesByCampaignName.get(campaign) ?? []
        if (scenarios.length === 0) return null
        const playedCount = scenarios.filter((scenario) => (scenarioCounts()[scenario] ?? 0) > 0).length
        return {
          key: campaign,
          label: campaign,
          group: arkhamHorrorLcgContent.campaignGroupByName.get(campaign),
          summary: `${playedCount.toLocaleString()} / ${scenarios.length.toLocaleString()} scenarios played`,
          playIds: uniquePlayIds(playIdsByCampaign()[campaign] ?? []),
          steps: scenarios.map((scenario) => ({
            key: scenario,
            label: scenario,
            plays: scenarioCounts()[scenario] ?? 0,
            wins: scenarioWins()[scenario] ?? 0,
            hours: scenarioPlayHours().hoursByScenario[scenario] ?? 0,
            hasAssumedHours: scenarioPlayHours().hasAssumedHoursByScenario[scenario] === true,
            playIds: uniquePlayIds(playIdsByScenario()[scenario] ?? []),
          })),
        }
      })
      .filter((section): section is NonNullable<typeof section> => Boolean(section)),
  )

  const investigatorKeys = createMemo(() =>
    sortKeysByGroupThenCountDesc(
      mergeCanonicalKeys(arkhamHorrorLcgContent.investigators, Object.keys(investigatorCounts())),
      investigatorCounts(),
      (investigator) => arkhamHorrorLcgContent.investigatorClassByName.get(investigator),
      ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor'],
    ),
  )

  function nextAchievement(trackIdPrefix: string, label: string) {
    return pickBestAvailableAchievementForTrackIds(achievements(), [
      `${trackIdPrefix}:${slugifyAchievementItemId(label)}`,
    ])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={ARKHAM_HORROR_LCG_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Arkham Horror LCG thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Arkham Horror LCG</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Arkham Horror LCG • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Track each campaign line separately, with investigator and difficulty tags layered on top.
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
        <div class="meta">
          <div class="metaLabel">Tagged plays</div>
          <div class="metaValue mono">{taggedPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Untagged plays</div>
          <div class="metaValue mono">{untaggedPlays().toLocaleString()}</div>
        </div>
        <div class="meta">
          <div class="metaLabel">Continuation sessions</div>
          <div class="metaValue mono">{continuationCount().toLocaleString()}</div>
        </div>
      </div>

      <Show when={totalHoursHasAssumed()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has no recorded length.
        </div>
      </Show>

      <CampaignProgressTable
        title="Campaign Scenarios"
        stepLabel="Scenario"
        sections={campaignSections()}
        onCampaignPlaysClick={(campaign) => {
          const playIds = uniquePlayIds(playIdsByCampaign()[campaign] ?? [])
          if (playIds.length === 0) return
          props.onOpenPlays({
            title: `Arkham Horror LCG • ${campaign}`,
            playIds,
          })
        }}
        onStepPlaysClick={(_campaign, scenario) => {
          const playIds = uniquePlayIds(playIdsByScenario()[scenario] ?? [])
          if (playIds.length === 0) return
          props.onOpenPlays({
            title: `Arkham Horror LCG • ${scenario}`,
            playIds,
          })
        }}
      />

      <CountTable
        title="Campaigns"
        plays={campaignCounts()}
        keys={campaignKeys()}
        groupBy={(campaign) => arkhamHorrorLcgContent.campaignGroupByName.get(campaign)}
        getNextAchievement={(campaign) => nextAchievement('campaignPlays', campaign)}
        onPlaysClick={(campaign) =>
          props.onOpenPlays({
            title: `Arkham Horror LCG • ${campaign}`,
            playIds: uniquePlayIds(playIdsByCampaign()[campaign] ?? []),
          })
        }
      />

      <CountTable
        title="Scenarios"
        plays={scenarioCounts()}
        keys={scenarioKeys()}
        groupBy={(scenario) => arkhamHorrorLcgContent.scenarioCampaignByName.get(scenario)}
        getNextAchievement={(scenario) => nextAchievement('scenarioPlays', scenario)}
        onPlaysClick={(scenario) =>
          props.onOpenPlays({
            title: `Arkham Horror LCG • ${scenario}`,
            playIds: uniquePlayIds(playIdsByScenario()[scenario] ?? []),
          })
        }
      />

      <Show when={hasCostTable()}>
        <CostPerPlayTable
          rows={costRows()}
          currencySymbol={arkhamHorrorLcgContent.costCurrencySymbol}
          overallPlays={totalPlays()}
          overallHours={totalHours()}
          averageHoursPerPlay={averageHoursPerPlay()}
          overallHoursHasAssumed={totalHoursHasAssumed()}
          onPlaysClick={(box) =>
            props.onOpenPlays({
              title: `Arkham Horror LCG • ${box}`,
              playIds: uniquePlayIds(playIdsByBox()[box] ?? []),
            })
          }
        />
      </Show>

      <CountTable
        title="Investigators"
        plays={investigatorCounts()}
        wins={investigatorWins()}
        keys={investigatorKeys()}
        groupBy={(investigator) => arkhamHorrorLcgContent.investigatorClassByName.get(investigator)}
        getNextAchievement={(investigator) => nextAchievement('investigatorPlays', investigator)}
        onPlaysClick={(investigator) =>
          props.onOpenPlays({
            title: `Arkham Horror LCG • ${investigator}`,
            playIds: uniquePlayIds(playIdsByInvestigator()[investigator] ?? []),
          })
        }
      />

      <CountTable
        title="Difficulty"
        plays={difficultyCounts()}
        wins={difficultyWins()}
        keys={mergeCanonicalKeys(arkhamHorrorLcgContent.difficulties, Object.keys(difficultyCounts()))}
        getNextAchievement={(difficulty) => nextAchievement('difficultyWins', difficulty)}
        onPlaysClick={(difficulty) =>
          props.onOpenPlays({
            title: `Arkham Horror LCG • ${difficulty}`,
            playIds: uniquePlayIds(playIdsByDifficulty()[difficulty] ?? []),
          })
        }
      />

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
