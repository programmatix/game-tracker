import { For, Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import GameThingThumb from '../../components/GameThingThumb'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { computeGameAchievements } from '../../achievements/games'
import {
  buildLabelToIdLookup,
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { totalPlayMinutes } from '../../playDuration'
import type { SpiritIslandSession } from './mindwanderer'
import {
  getSpiritIslandEntriesFromSessions,
  SPIRIT_ISLAND_OBJECT_ID,
  spiritIslandMappings,
} from './spiritIslandEntries'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'

function stripTrailingLevelLabel(value: string): string {
  return value.replace(/\s+L\d+\s*$/i, '').trim()
}

function parseTrailingLevelLabel(value: string): number | undefined {
  const match = /\s+L(?<level>\d+)\s*$/i.exec(value)
  const parsed = Number(match?.groups?.level || '')
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return parsed
}

function difficultyColor(level: number): string {
  const t = Math.min(1, Math.max(0, level / 6))
  const lightness = 20 + t * 30
  return `hsl(152 58% ${lightness}%)`
}

function lossColor(): string {
  return 'hsl(3 72% 38%)'
}

const SPIRIT_ISLAND_LEVELS = [1, 2, 3, 4, 5, 6]
const SPIRIT_COMPLEXITY_ORDER = ['Low', 'Moderate', 'High', 'Very High'] as const
type MatrixDisplayMode = 'count' | 'difficulty' | 'played'
type SpiritGroupingMode = 'group' | 'complexity'

export default function SpiritIslandView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  spiritIslandSessions?: SpiritIslandSession[]
  spiritIslandSessionsLoading?: boolean
  spiritIslandSessionsError?: string | null
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [matrixDisplayMode, setMatrixDisplayMode] = createSignal<MatrixDisplayMode>('played')
  const [spiritGroupingMode, setSpiritGroupingMode] = createSignal<SpiritGroupingMode>('group')

  const [spiritIslandThing] = createResource(
    () => ({ id: SPIRIT_ISLAND_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() =>
    props.spiritIslandSessions ? getSpiritIslandEntriesFromSessions(props.spiritIslandSessions) : [],
  )
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const achievements = createMemo(() =>
    computeGameAchievements('spiritIsland', props.plays, props.username, {
      spiritIslandSessions: props.spiritIslandSessions,
    }),
  )

  const totalSpiritIslandPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + entry.quantity, 0),
  )
  const totalSpiritIslandHours = createMemo(
    () =>
      entries().reduce(
        (sum, entry) => sum + totalPlayMinutes(entry.play.attributes, entry.quantity) / 60,
        0,
      ),
  )

  const spiritCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.spirit, entry.quantity)
    return counts
  })

  const spiritWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.spirit, entry.quantity)
    }
    return counts
  })

  const adversaryCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries())
      incrementCount(counts, stripTrailingLevelLabel(entry.adversary), entry.quantity)
    return counts
  })

  const adversaryWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, stripTrailingLevelLabel(entry.adversary), entry.quantity)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      const spirit = entry.spirit
      const adversary = stripTrailingLevelLabel(entry.adversary)
      counts[spirit] ||= {}
      incrementCount(counts[spirit]!, adversary, entry.quantity)
    }
    return counts
  })

  const matrixWins = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      const spirit = entry.spirit
      const adversary = stripTrailingLevelLabel(entry.adversary)
      counts[spirit] ||= {}
      incrementCount(counts[spirit]!, adversary, entry.quantity)
    }
    return counts
  })

  const matrixHighestWinLevel = createMemo(() => {
    const byPair: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      const spirit = entry.spirit
      const adversary = stripTrailingLevelLabel(entry.adversary)
      const level = parseTrailingLevelLabel(entry.adversary) ?? 0
      byPair[spirit] ||= {}
      byPair[spirit]![adversary] = Math.max(byPair[spirit]![adversary] ?? 0, level)
    }
    return byPair
  })

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const spiritGroup = getSpiritGroup(entry.spirit)
      const adversaryBase = stripTrailingLevelLabel(entry.adversary)
      const adversaryGroup = spiritIslandMappings.adversaryGroupByLabel.get(adversaryBase)
      if (spiritGroup) boxes.add(spiritGroup)
      if (adversaryGroup) boxes.add(adversaryGroup)
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const spiritGroup = getSpiritGroup(entry.spirit)
      const adversaryBase = stripTrailingLevelLabel(entry.adversary)
      const adversaryGroup = spiritIslandMappings.adversaryGroupByLabel.get(adversaryBase)
      if (spiritGroup) boxes.add(spiritGroup)
      if (adversaryGroup) boxes.add(adversaryGroup)
      const hours = totalPlayMinutes(entry.play.attributes, entry.quantity) / 60
      if (hours <= 0) continue
      for (const box of boxes) incrementCount(hoursByBox, box, hours)
    }
    return hoursByBox
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const spiritGroup = getSpiritGroup(entry.spirit)
      const adversaryBase = stripTrailingLevelLabel(entry.adversary)
      const adversaryGroup = spiritIslandMappings.adversaryGroupByLabel.get(adversaryBase)
      if (spiritGroup) boxes.add(spiritGroup)
      if (adversaryGroup) boxes.add(adversaryGroup)
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...spiritIslandMappings.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours()[box] ?? 0,
      }))
      .sort((a, b) => {
        const byPlays = b.plays - a.plays
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () =>
      Boolean(spiritIslandMappings.costCurrencySymbol) &&
      spiritIslandMappings.boxCostsByName.size > 0,
  )

  const spiritComplexityByKey = createMemo(() => {
    const map = new Map<string, string>()
    for (const spirit of spiritIslandMappings.spirits) {
      const key = normalizeAchievementItemLabel(spirit.display).toLowerCase()
      if (!key) continue
      map.set(key, spirit.complexity)
    }
    return map
  })

  function getSpiritComplexity(spirit: string): string | undefined {
    const key = normalizeAchievementItemLabel(spirit).toLowerCase()
    return spiritComplexityByKey().get(key)
  }

  const spiritGroupByKey = createMemo(() => {
    const map = new Map<string, string>()
    for (const spirit of spiritIslandMappings.spirits) {
      const key = normalizeAchievementItemLabel(spirit.display).toLowerCase()
      if (!key) continue
      map.set(key, spirit.group)
    }
    return map
  })

  function getSpiritGroup(spirit: string): string | undefined {
    const key = normalizeAchievementItemLabel(spirit).toLowerCase()
    return spiritGroupByKey().get(key)
  }

  const spiritGroupOrder = createMemo(() => {
    const order = new Map<string, number>()
    for (const spirit of spiritIslandMappings.spirits) {
      const group = spirit.group.trim().toLowerCase()
      if (!group || order.has(group)) continue
      order.set(group, order.size)
    }
    return order
  })

  const isKnownSpiritComplexity = (
    value: string,
  ): value is (typeof SPIRIT_COMPLEXITY_ORDER)[number] =>
    (SPIRIT_COMPLEXITY_ORDER as readonly string[]).includes(value)

  const spiritKeysByComplexity = createMemo(() => {
    const all = mergeCanonicalKeys(
      sortKeysByCountDesc(spiritCounts()),
      spiritIslandMappings.spirits.map((spirit) => spirit.display),
    )

    const counts = spiritCounts()
    const sortWithinGroup = (a: string, b: string) => {
      const delta = (counts[b] ?? 0) - (counts[a] ?? 0)
      if (delta !== 0) return delta
      return a.localeCompare(b)
    }

    const grouped = new Map<string, string[]>()
    const unknown: string[] = []

    for (const spirit of all) {
      const complexity = getSpiritComplexity(spirit)
      if (complexity && isKnownSpiritComplexity(complexity)) {
        const list = grouped.get(complexity) ?? []
        list.push(spirit)
        grouped.set(complexity, list)
        continue
      }
      unknown.push(spirit)
    }

    const ordered: string[] = []
    for (const complexity of SPIRIT_COMPLEXITY_ORDER) {
      const list = grouped.get(complexity)?.slice() ?? []
      list.sort(sortWithinGroup)
      ordered.push(...list)
    }
    unknown.sort(sortWithinGroup)
    ordered.push(...unknown)
    return ordered
  })

  const spiritKeysByGroup = createMemo(() => {
    const all = spiritKeysByComplexity()
    const counts = spiritCounts()

    return all.slice().sort((a, b) => {
      const aGroup = (getSpiritGroup(a) || '').trim().toLowerCase()
      const bGroup = (getSpiritGroup(b) || '').trim().toLowerCase()
      const byGroup = (spiritGroupOrder().get(aGroup) ?? Number.MAX_SAFE_INTEGER) - (spiritGroupOrder().get(bGroup) ?? Number.MAX_SAFE_INTEGER)
      if (byGroup !== 0) return byGroup

      const delta = (counts[b] ?? 0) - (counts[a] ?? 0)
      if (delta !== 0) return delta
      return a.localeCompare(b)
    })
  })

  const adversaryKeys = createMemo(() =>
    mergeCanonicalKeys(
      sortKeysByCountDesc(adversaryCounts()),
      [...spiritIslandMappings.adversariesById.values(), 'No adversary'],
    ),
  )

  const spiritLabelToId = createMemo(() =>
    buildLabelToIdLookup(
      [...spiritIslandMappings.spiritsById.entries()].map(([id, label]) => ({ id, label })),
    ),
  )
  const adversaryLabelToId = createMemo(() =>
    buildLabelToIdLookup(
      [...spiritIslandMappings.adversariesById.entries()].map(([id, label]) => ({ id, label })),
    ),
  )

  function getSpiritNextAchievement(spirit: string) {
    const normalized = normalizeAchievementItemLabel(spirit).toLowerCase()
    const id = spiritLabelToId().get(normalized) ?? slugifyAchievementItemId(spirit)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`spiritPlays:${id}`])
  }

  function getAdversaryNextAchievement(adversary: string) {
    const normalized = normalizeAchievementItemLabel(adversary).toLowerCase()
    const id = adversaryLabelToId().get(normalized) ?? slugifyAchievementItemId(adversary)
    const slug = slugifyAchievementItemId(adversary)
    const trackIds = [
      `adversaryWins:${id}`,
      ...SPIRIT_ISLAND_LEVELS.map((level) => `adversaryLevelWin:${slug}-l${level}`),
    ]
    return pickBestAvailableAchievementForTrackIds(achievements(), trackIds)
  }

  const spiritKeysByGrouping = createMemo(() =>
    spiritGroupingMode() === 'group' ? spiritKeysByGroup() : spiritKeysByComplexity(),
  )
  const spiritGroupingLabel = (spirit: string) =>
    spiritGroupingMode() === 'group'
      ? (getSpiritGroup(spirit) ?? 'Other')
      : (getSpiritComplexity(spirit) ?? 'Other')

  const matrixRows = createMemo(() => spiritKeysByGrouping())
  const matrixCols = createMemo(() => adversaryKeys())

  const matrixMax = createMemo(() => {
    let max = 0
    const rows = matrixRows()
    const cols = matrixCols()
    for (const row of rows) {
      for (const col of cols) {
        const value = matrix()[row]?.[col] ?? 0
        if (value > max) max = value
      }
    }
    return max
  })

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={SPIRIT_ISLAND_OBJECT_ID}
          image={spiritIslandThing()?.image}
          thumbnail={spiritIslandThing()?.thumbnail}
          alt="Spirit Island thumbnail"
        />
        <div class="meta">
          Spirit Island plays in dataset:{' '}
          <span class="mono">{totalSpiritIslandPlays().toLocaleString()}</span>
          {' • '}
          <button
            class="linkButton"
            type="button"
            disabled={allPlayIds().length === 0}
            onClick={() =>
              props.onOpenPlays({
                title: 'Spirit Island • All plays',
                playIds: allPlayIds(),
              })
            }
          >
            View all plays
          </button>
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
            <Show
              when={props.spiritIslandSessionsLoading}
              fallback={
                props.spiritIslandSessionsError
                  ? `Failed to load Spirit Island sessions: ${props.spiritIslandSessionsError}`
                  : 'No Spirit Island sessions found.'
              }
            >
              Loading Spirit Island sessions…
            </Show>
          </div>
        }
      >
        <div class="statsTitleRow">
          <h3 class="statsTitle">Tables</h3>
          <div class="finalGirlControls">
            <label class="control">
              <span>Spirit grouping</span>
              <select
                value={spiritGroupingMode()}
                onInput={(e) =>
                  setSpiritGroupingMode(e.currentTarget.value as SpiritGroupingMode)
                }
              >
                <option value="group">Group</option>
                <option value="complexity">Complexity</option>
              </select>
            </label>
          </div>
        </div>
        <div class="statsGrid">
          <CountTable
            title={
              spiritGroupingMode() === 'group' ? 'Spirits (By Group)' : 'Spirits (By Complexity)'
            }
            plays={spiritCounts()}
            wins={spiritWins()}
            keys={spiritKeysByGrouping()}
            groupBy={spiritGroupingLabel}
            getNextAchievement={getSpiritNextAchievement}
          />
          <CountTable
            title="Adversaries"
            plays={adversaryCounts()}
            wins={adversaryWins()}
            keys={adversaryKeys()}
            getNextAchievement={getAdversaryNextAchievement}
          />
          <Show when={hasCostTable()}>
            <CostPerPlayTable
              title="Cost per box"
              rows={costRows()}
              currencySymbol={spiritIslandMappings.costCurrencySymbol}
              overallPlays={totalSpiritIslandPlays()}
              overallHours={totalSpiritIslandHours()}
              onPlaysClick={(box) =>
                props.onOpenPlays({
                  title: `Spirit Island • Box: ${box}`,
                  playIds: playIdsByBox()[box] ?? [],
                })
              }
            />
          </Show>
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">Spirit × Adversary</h3>
            <div class="finalGirlControls">
              <label class="control">
                <span>Spirit grouping</span>
                <select
                  value={spiritGroupingMode()}
                  onInput={(e) =>
                    setSpiritGroupingMode(e.currentTarget.value as SpiritGroupingMode)
                  }
                >
                  <option value="group">Group</option>
                  <option value="complexity">Complexity</option>
                </select>
              </label>
              <label class="control">
                <span>Display</span>
                <select
                  value={matrixDisplayMode()}
                  onInput={(e) =>
                    setMatrixDisplayMode(e.currentTarget.value as MatrixDisplayMode)
                  }
                >
                  <option value="count">Count</option>
                  <option value="difficulty">Difficulty</option>
                  <option value="played">Played</option>
                </select>
              </label>
            </div>
          </div>
          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            maxCount={matrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            rowHeader="Spirit"
            colHeader="Adversary"
            rowGroupBy={spiritGroupingLabel}
            getCount={(row, col) => matrix()[row]?.[col] ?? 0}
            getWinCount={(row, col) => matrixWins()[row]?.[col] ?? 0}
            getCellDisplayText={(row, col, count) => {
              if (matrixDisplayMode() === 'count') return count === 0 ? '—' : String(count)
              if (matrixDisplayMode() === 'played') return ''
              if (count === 0) return ''
              const highestWinLevel = matrixHighestWinLevel()[row]?.[col]
              if ((highestWinLevel ?? -1) > 0) return `L${highestWinLevel}`
              if (highestWinLevel === 0) return 'W'
              return ''
            }}
            getCellBackgroundColor={(row, col, count, _intensity) => {
              if (count === 0) return 'transparent'
              if (matrixDisplayMode() !== 'difficulty') return undefined
              const highestWinLevel = matrixHighestWinLevel()[row]?.[col]
              if ((highestWinLevel ?? -1) > 0) return difficultyColor(highestWinLevel!)
              if (highestWinLevel === 0) return difficultyColor(1)
              return lossColor()
            }}
            getCellLabel={(row, col, count) => {
              if (matrixDisplayMode() !== 'difficulty')
                return `${row} × ${col}: ${count}`
              if (count === 0) return `${row} × ${col}: 0`
              const highestWinLevel = matrixHighestWinLevel()[row]?.[col]
              if ((highestWinLevel ?? -1) > 0)
                return `${row} × ${col}: ${count}, highest win L${highestWinLevel}`
              if (highestWinLevel === 0)
                return `${row} × ${col}: ${count}, win with no level`
              return `${row} × ${col}: ${count}, all losses`
            }}
          />
          <Show when={matrixDisplayMode() === 'difficulty'}>
            <div class="difficultyLegend">
              <span class="difficultyLegendTitle">Difficulty legend:</span>
              <span class="difficultyLegendItem">
                <span class="difficultyLegendSwatch" style={{ 'background-color': lossColor() }} />
                Losses only
              </span>
              <span class="difficultyLegendItem">
                <span
                  class="difficultyLegendSwatch"
                  style={{ 'background-color': difficultyColor(1) }}
                />
                W = win with no level
              </span>
              <For each={SPIRIT_ISLAND_LEVELS}>
                {(level) => (
                  <span class="difficultyLegendItem">
                    <span
                      class="difficultyLegendSwatch"
                      style={{ 'background-color': difficultyColor(level) }}
                    />
                    L{level} highest win
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
