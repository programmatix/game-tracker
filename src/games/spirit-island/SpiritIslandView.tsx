import { For, Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
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

const SPIRIT_ISLAND_LEVELS = [1, 2, 3, 4, 5, 6]
const SPIRIT_COMPLEXITY_ORDER = ['Low', 'Moderate', 'High', 'Very High'] as const

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
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [hideCounts, setHideCounts] = createSignal(true)

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

  const spiritKeysByComplexityLevel = createMemo(() => {
    const counts = spiritCounts()
    const sortWithinGroup = (a: string, b: string) => {
      const delta = (counts[b] ?? 0) - (counts[a] ?? 0)
      if (delta !== 0) return delta
      return a.localeCompare(b)
    }

    const grouped: Record<(typeof SPIRIT_COMPLEXITY_ORDER)[number], string[]> = {
      Low: [],
      Moderate: [],
      High: [],
      'Very High': [],
    }
    const other: string[] = []

    for (const spirit of spiritKeysByComplexity()) {
      const complexity = getSpiritComplexity(spirit)
      if (complexity && complexity in grouped)
        grouped[complexity as keyof typeof grouped].push(spirit)
      else other.push(spirit)
    }

    for (const complexity of SPIRIT_COMPLEXITY_ORDER) grouped[complexity].sort(sortWithinGroup)
    other.sort(sortWithinGroup)
    return { grouped, other }
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

  const matrixRows = createMemo(() => (flipAxes() ? adversaryKeys() : spiritKeysByComplexity()))
  const matrixCols = createMemo(() => (flipAxes() ? spiritKeysByComplexity() : adversaryKeys()))

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
        <div class="statsGrid">
          <For each={SPIRIT_COMPLEXITY_ORDER}>
            {(complexity) => (
              <CountTable
                title={`Spirits (${complexity})`}
                plays={spiritCounts()}
                wins={spiritWins()}
                keys={spiritKeysByComplexityLevel().grouped[complexity]}
                getNextAchievement={getSpiritNextAchievement}
              />
            )}
          </For>
          <Show when={spiritKeysByComplexityLevel().other.length > 0}>
            <CountTable
              title="Spirits (Other)"
              plays={spiritCounts()}
              wins={spiritWins()}
              keys={spiritKeysByComplexityLevel().other}
              getNextAchievement={getSpiritNextAchievement}
            />
          </Show>
          <CountTable
            title="Adversaries"
            plays={adversaryCounts()}
            wins={adversaryWins()}
            keys={adversaryKeys()}
            getNextAchievement={getAdversaryNextAchievement}
          />
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">{flipAxes() ? 'Adversary × Spirit' : 'Spirit × Adversary'}</h3>
            <div class="finalGirlControls">
              <label class="control">
                <input
                  type="checkbox"
                  checked={flipAxes()}
                  onInput={(e) => setFlipAxes(e.currentTarget.checked)}
                />
                Flip axes
              </label>
              <label class="control">
                <input
                  type="checkbox"
                  checked={hideCounts()}
                  onInput={(e) => setHideCounts(e.currentTarget.checked)}
                />
                Hide count
              </label>
            </div>
          </div>
          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            maxCount={matrixMax()}
            hideCounts={hideCounts()}
            rowHeader={flipAxes() ? 'Adversary' : 'Spirit'}
            colHeader={flipAxes() ? 'Spirit' : 'Adversary'}
            rowGroupBy={flipAxes() ? undefined : getSpiritComplexity}
            colGroupBy={flipAxes() ? getSpiritComplexity : undefined}
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
          />
        </div>
      </Show>
    </div>
  )
}
