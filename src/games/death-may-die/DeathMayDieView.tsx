import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { deathMayDieContent } from './content'
import { DEATH_MAY_DIE_OBJECT_ID, getDeathMayDieEntries } from './deathMayDieEntries'

export default function DeathMayDieView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [hideCounts, setHideCounts] = createSignal(true)

  const [deathMayDieThing] = createResource(
    () => ({ id: DEATH_MAY_DIE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getDeathMayDieEntries(props.plays, props.username))

  const achievements = createMemo(() =>
    computeGameAchievements('deathMayDie', props.plays, props.username),
  )

  const totalPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + entry.quantity, 0),
  )

  const elderOneCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.elderOne, entry.quantity)
    return counts
  })

  const playIdsByElderOne = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.elderOne] ||= []).push(entry.play.id)
    }
    return ids
  })

  const elderOneWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.elderOne, entry.quantity)
    }
    return counts
  })

  const scenarioCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.scenario, entry.quantity)
    return counts
  })

  const playIdsByScenario = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.scenario] ||= []).push(entry.play.id)
    }
    return ids
  })

  const scenarioWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.scenario, entry.quantity)
    }
    return counts
  })

  const investigatorCountsAll = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const investigator of entry.investigators)
        incrementCount(counts, investigator, entry.quantity)
    }
    return counts
  })

  const playIdsByInvestigatorAll = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const investigator of entry.investigators) {
        ;(ids[investigator] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const investigatorWinsAll = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      for (const investigator of entry.investigators)
        incrementCount(counts, investigator, entry.quantity)
    }
    return counts
  })

  const investigatorCountsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myInvestigator) continue
      incrementCount(counts, entry.myInvestigator, entry.quantity)
    }
    return counts
  })

  const playIdsByInvestigatorMine = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (!entry.myInvestigator) continue
      ;(ids[entry.myInvestigator] ||= []).push(entry.play.id)
    }
    return ids
  })

  const investigatorWinsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myInvestigator) continue
      if (!entry.isWin) continue
      incrementCount(counts, entry.myInvestigator, entry.quantity)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.elderOne] ||= {}
      incrementCount(counts[entry.elderOne]!, entry.scenario, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = `${entry.elderOne}|||${entry.scenario}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const elderOneKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(elderOneCounts()), deathMayDieContent.elderOnes),
  )
  const scenarioKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(scenarioCounts()), deathMayDieContent.scenarios),
  )
  const investigatorKeysAll = createMemo(() =>
    mergeCanonicalKeys(
      sortKeysByCountDesc(investigatorCountsAll()),
      deathMayDieContent.investigators,
    ),
  )
  const investigatorKeysMine = createMemo(() =>
    mergeCanonicalKeys(
      sortKeysByCountDesc(investigatorCountsMine()),
      deathMayDieContent.investigators,
    ),
  )

  const matrixRows = createMemo(() => (flipAxes() ? scenarioKeys() : elderOneKeys()))
  const matrixCols = createMemo(() => (flipAxes() ? elderOneKeys() : scenarioKeys()))

  const matrixMax = createMemo(() => {
    let max = 0
    const rows = matrixRows()
    const cols = matrixCols()
    for (const row of rows) {
      for (const col of cols) {
        const value = flipAxes()
          ? (matrix()[col]?.[row] ?? 0)
          : (matrix()[row]?.[col] ?? 0)
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
        <Show when={deathMayDieThing()?.image || deathMayDieThing()?.thumbnail}>
          {(thumbnail) => (
            <a
              class="finalGirlThumbLink"
              href={`https://boardgamegeek.com/boardgame/${DEATH_MAY_DIE_OBJECT_ID}`}
              target="_blank"
              rel="noreferrer"
              title="View on BoardGameGeek"
            >
              <img
                class="finalGirlThumb"
                src={thumbnail()}
                alt="Cthulhu: Death May Die thumbnail"
                loading="lazy"
              />
            </a>
          )}
        </Show>
        <div class="meta">
          Cthulhu: Death May Die plays in dataset:{' '}
          <span class="mono">{totalPlays().toLocaleString()}</span>
        </div>
      </div>

      <AchievementsPanel
        achievements={achievements()}
        nextLimit={5}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Cthulhu: Death May Die plays found. In BG Stats, put values in the player{' '}
            <span class="mono">color</span> field like <span class="mono">Kid／Cthulhu／S2</span>{' '}
            or <span class="mono">I: Kid／EO: Cthulhu／S: 2</span>. Players can just put their
            investigator name (like <span class="mono">Nun</span>) and the view will still pick up
            scenario/elder one from anyone that tagged them.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Elder Ones"
            plays={elderOneCounts()}
            wins={elderOneWins()}
            keys={elderOneKeys()}
            getNextAchievement={(elderOne) => getNextAchievement('elderOneWins', elderOne)}
            onPlaysClick={(elderOne) =>
              props.onOpenPlays({
                title: `Cthulhu: Death May Die • Elder One: ${elderOne}`,
                playIds: playIdsByElderOne()[elderOne] ?? [],
              })
            }
          />
          <CountTable
            title="Scenarios"
            plays={scenarioCounts()}
            wins={scenarioWins()}
            keys={scenarioKeys()}
            getNextAchievement={(scenario) => getNextAchievement('scenarioPlays', scenario)}
            onPlaysClick={(scenario) =>
              props.onOpenPlays({
                title: `Cthulhu: Death May Die • Scenario: ${scenario}`,
                playIds: playIdsByScenario()[scenario] ?? [],
              })
            }
          />
          <CountTable
            title="My Investigators"
            plays={investigatorCountsMine()}
            wins={investigatorWinsMine()}
            keys={investigatorKeysMine()}
            getNextAchievement={(investigator) => getNextAchievement('investigatorPlays', investigator)}
            onPlaysClick={(investigator) =>
              props.onOpenPlays({
                title: `Cthulhu: Death May Die • My Investigator: ${investigator}`,
                playIds: playIdsByInvestigatorMine()[investigator] ?? [],
              })
            }
          />
          <CountTable
            title="All Investigators"
            plays={investigatorCountsAll()}
            wins={investigatorWinsAll()}
            keys={investigatorKeysAll()}
            getNextAchievement={(investigator) => getNextAchievement('investigatorPlays', investigator)}
            onPlaysClick={(investigator) =>
              props.onOpenPlays({
                title: `Cthulhu: Death May Die • Investigator: ${investigator}`,
                playIds: playIdsByInvestigatorAll()[investigator] ?? [],
              })
            }
          />
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">{flipAxes() ? 'Scenario × Elder One' : 'Elder One × Scenario'}</h3>
            <div class="finalGirlControls">
              <label class="controlCheckbox">
                <input
                  type="checkbox"
                  checked={flipAxes()}
                  onChange={(e) => setFlipAxes(e.currentTarget.checked)}
                />{' '}
                Flip axes
              </label>
              <label class="controlCheckbox">
                <input
                  type="checkbox"
                  checked={hideCounts()}
                  onChange={(e) => setHideCounts(e.currentTarget.checked)}
                />{' '}
                Hide counts
              </label>
            </div>
          </div>

          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            rowHeader={flipAxes() ? 'Scenario' : 'Elder One'}
            colHeader={flipAxes() ? 'Elder One' : 'Scenario'}
            maxCount={matrixMax()}
            hideCounts={hideCounts()}
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
            onCellClick={(row, col) => {
              const elderOne = flipAxes() ? col : row
              const scenario = flipAxes() ? row : col
              const key = `${elderOne}|||${scenario}`
              props.onOpenPlays({
                title: `Cthulhu: Death May Die • ${elderOne} × ${scenario}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />
        </div>
      </Show>
    </div>
  )
}
