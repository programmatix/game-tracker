import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { computeGameAchievements } from '../../achievements/games'
import { getSpiritIslandEntries, SPIRIT_ISLAND_OBJECT_ID, spiritIslandMappings } from './spiritIslandEntries'

function stripTrailingLevelLabel(value: string): string {
  return value.replace(/\s+L\d+\s*$/i, '').trim()
}

export default function SpiritIslandView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
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

  const adversaryCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries())
      incrementCount(counts, stripTrailingLevelLabel(entry.adversary), entry.quantity)
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

      <AchievementsPanel achievements={achievements()} nextLimit={5} />

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
          <CountTable title="Spirits" counts={spiritCounts()} keys={spiritKeys()} />
          <CountTable title="Adversaries" counts={adversaryCounts()} keys={adversaryKeys()} />
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
          />
        </div>
      </Show>
    </div>
  )
}
