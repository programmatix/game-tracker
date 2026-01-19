import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { computeGameAchievements } from '../../achievements/games'
import {
  buildLabelToIdLookup,
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { getSpiritIslandEntries, SPIRIT_ISLAND_OBJECT_ID, spiritIslandMappings } from './spiritIslandEntries'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'

function stripTrailingLevelLabel(value: string): string {
  return value.replace(/\s+L\d+\s*$/i, '').trim()
}

const SPIRIT_ISLAND_LEVELS = [1, 2, 3, 4, 5, 6]

export default function SpiritIslandView(props: {
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

  const [spiritIslandThing] = createResource(
    () => ({ id: SPIRIT_ISLAND_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getSpiritIslandEntries(props.plays, props.username))

  const achievements = createMemo(() =>
    computeGameAchievements('spiritIsland', props.plays, props.username),
  )

  const totalSpiritIslandPlays = createMemo(() =>
    entries().reduce((sum, entry) => sum + entry.quantity, 0),
  )

  const spiritCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.spirit, entry.quantity)
    return counts
  })

  const playIdsBySpirit = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.spirit] ||= []).push(entry.play.id)
    }
    return ids
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

  const playIdsByAdversary = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const key = stripTrailingLevelLabel(entry.adversary)
      ;(ids[key] ||= []).push(entry.play.id)
    }
    return ids
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

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const spirit = entry.spirit
      const adversary = stripTrailingLevelLabel(entry.adversary)
      const key = `${spirit}|||${adversary}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const spiritKeys = createMemo(() =>
    mergeCanonicalKeys(
      sortKeysByCountDesc(spiritCounts()),
      [...spiritIslandMappings.spiritsById.values()],
    ),
  )

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

  const matrixRows = createMemo(() => (flipAxes() ? adversaryKeys() : spiritKeys()))
  const matrixCols = createMemo(() => (flipAxes() ? spiritKeys() : adversaryKeys()))

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
        <Show when={spiritIslandThing()?.thumbnail}>
          {(thumbnail) => (
            <a
              class="finalGirlThumbLink"
              href={`https://boardgamegeek.com/boardgame/${SPIRIT_ISLAND_OBJECT_ID}`}
              target="_blank"
              rel="noreferrer"
              title="View on BoardGameGeek"
            >
              <img
                class="finalGirlThumb"
                src={thumbnail()}
                alt="Spirit Island thumbnail"
                loading="lazy"
              />
            </a>
          )}
        </Show>
        <div class="meta">
          Spirit Island plays in dataset:{' '}
          <span class="mono">{totalSpiritIslandPlays().toLocaleString()}</span>
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
            No Spirit Island plays found. For BG Stats tags, put values in the player{' '}
            <span class="mono">color</span> field like{' '}
            <span class="mono">RisingHeat／PrussiaL3</span> or{' '}
            <span class="mono">S: RisingHeat／AL: PrussiaL3</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Spirits"
            plays={spiritCounts()}
            wins={spiritWins()}
            keys={spiritKeys()}
            getNextAchievement={getSpiritNextAchievement}
            onPlaysClick={(spirit) =>
              props.onOpenPlays({
                title: `Spirit Island • Spirit: ${spirit}`,
                playIds: playIdsBySpirit()[spirit] ?? [],
              })
            }
          />
          <CountTable
            title="Adversaries"
            plays={adversaryCounts()}
            wins={adversaryWins()}
            keys={adversaryKeys()}
            getNextAchievement={getAdversaryNextAchievement}
            onPlaysClick={(adversary) =>
              props.onOpenPlays({
                title: `Spirit Island • Adversary: ${adversary}`,
                playIds: playIdsByAdversary()[adversary] ?? [],
              })
            }
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
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
            onCellClick={(row, col) => {
              const spirit = flipAxes() ? col : row
              const adversary = flipAxes() ? row : col
              const key = `${spirit}|||${adversary}`
              props.onOpenPlays({
                title: `Spirit Island • ${spirit} × ${adversary}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />
        </div>
      </Show>
    </div>
  )
}
