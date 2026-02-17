import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { skytearHordeContent } from './content'
import {
  getSkytearHordeEntries,
  SKYTEAR_HORDE_OBJECT_ID,
  type SkytearHordeEntry,
} from './skytearHordeEntries'

export default function SkytearHordeView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [hideCounts, setHideCounts] = createSignal(true)

  const [thing] = createResource(
    () => ({ id: SKYTEAR_HORDE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getSkytearHordeEntries(props.plays, props.username))

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))

  const heroCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.heroPrecon, entry.quantity)
    return counts
  })

  const enemyCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.enemyPrecon, entry.quantity)
    return counts
  })

  const playIdsByHero = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.heroPrecon] ||= []).push(entry.play.id)
    }
    return ids
  })

  const playIdsByEnemy = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.enemyPrecon] ||= []).push(entry.play.id)
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.heroPrecon] ||= {}
      incrementCount(counts[entry.heroPrecon]!, entry.enemyPrecon, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = `${entry.heroPrecon}|||${entry.enemyPrecon}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const heroKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(heroCounts()), skytearHordeContent.heroPrecons),
  )
  const enemyKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(enemyCounts()), skytearHordeContent.enemyPrecons),
  )

  const matrixRows = createMemo(() => (flipAxes() ? enemyKeys() : heroKeys()))
  const matrixCols = createMemo(() => (flipAxes() ? heroKeys() : enemyKeys()))

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

  const rowGroupBy = (row: string) =>
    flipAxes()
      ? skytearHordeContent.enemyBoxByPrecon.get(row)
      : skytearHordeContent.heroBoxByPrecon.get(row)
  const colGroupBy = (col: string) =>
    flipAxes()
      ? skytearHordeContent.heroBoxByPrecon.get(col)
      : skytearHordeContent.enemyBoxByPrecon.get(col)

  return (
    <div class="gameView">
      <div class="gameHeader">
        <div class="gameHeaderLeft">
          <h2>Skytear Horde</h2>
          <div class="muted">
            <span class="mono">{totalPlays().toLocaleString()}</span> plays
          </div>
        </div>
        <div class="gameHeaderRight">
          <Show when={thing()}>
            {(resolved) => (
              <Show when={resolved().thumbnail}>
                {(thumb) => <img class="gameThumb" src={thumb()} alt="Skytear Horde" />}
              </Show>
            )}
          </Show>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Skytear Horde plays found. In BG Stats, tag the player{' '}
            <span class="mono">color</span> field like{' '}
            <span class="mono">H: Frostbite／E: Undead</span> (or{' '}
            <span class="mono">Frostbite／Undead</span>).
          </div>
        }
      >
        <div class="matrixControls">
          <label class="checkboxLabel">
            <input
              type="checkbox"
              checked={flipAxes()}
              onInput={(e) => setFlipAxes(e.currentTarget.checked)}
            />{' '}
            Flip axes
          </label>
          <label class="checkboxLabel">
            <input
              type="checkbox"
              checked={hideCounts()}
              onInput={(e) => setHideCounts(e.currentTarget.checked)}
            />{' '}
            Hide counts
          </label>
        </div>

        <div class="statsGrid">
          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            rowHeader={flipAxes() ? 'Enemy precon' : 'Hero precon'}
            colHeader={flipAxes() ? 'Hero precon' : 'Enemy precon'}
            rowGroupBy={rowGroupBy}
            colGroupBy={colGroupBy}
            maxCount={matrixMax()}
            hideCounts={hideCounts()}
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
            onCellClick={(row, col) => {
              const hero = flipAxes() ? col : row
              const enemy = flipAxes() ? row : col
              const key = `${hero}|||${enemy}`
              props.onOpenPlays({
                title: `Skytear Horde • ${hero} × ${enemy}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />

          <CountTable
            title="Hero precons"
            plays={heroCounts()}
            keys={heroKeys()}
            onPlaysClick={(hero) =>
              props.onOpenPlays({
                title: `Skytear Horde • Hero precon: ${hero}`,
                playIds: playIdsByHero()[hero] ?? [],
              })
            }
          />
        </div>

        <div class="statsGrid">
          <CountTable
            title="Enemy precons"
            plays={enemyCounts()}
            keys={enemyKeys()}
            onPlaysClick={(enemy) =>
              props.onOpenPlays({
                title: `Skytear Horde • Enemy precon: ${enemy}`,
                playIds: playIdsByEnemy()[enemy] ?? [],
              })
            }
          />
        </div>
      </Show>
    </div>
  )
}

