import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import GameThingThumb from '../../components/GameThingThumb'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { undauntedNormandyContent } from './content'
import {
  getUndauntedNormandyEntries,
  UNDAUNTED_NORMANDY_OBJECT_ID,
} from './undauntedNormandyEntries'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function pairKey(scenario: string, side: string): string {
  return `${normalizeLabel(scenario)}|||${normalizeLabel(side)}`
}

type MatrixDisplayMode = 'count' | 'played'

export default function UndauntedNormandyView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [matrixDisplayMode, setMatrixDisplayMode] = createSignal<MatrixDisplayMode>('played')

  const [thing] = createResource(
    () => ({ id: UNDAUNTED_NORMANDY_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getUndauntedNormandyEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))

  const scenarioCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.scenario, entry.quantity)
    return counts
  })

  const sideCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.side, entry.quantity)
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

  const sideWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.side, entry.quantity)
    }
    return counts
  })

  const playIdsByScenario = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.scenario)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const playIdsBySide = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.side)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = pairKey(entry.scenario, entry.side)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.scenario] ||= {}
      incrementCount(counts[entry.scenario]!, entry.side, entry.quantity)
    }
    return counts
  })

  const scenarioKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(scenarioCounts()), undauntedNormandyContent.scenarios),
  )

  const sideKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(sideCounts()), undauntedNormandyContent.sides),
  )

  const matrixRows = createMemo(() => (flipAxes() ? sideKeys() : scenarioKeys()))
  const matrixCols = createMemo(() => (flipAxes() ? scenarioKeys() : sideKeys()))

  const matrixMax = createMemo(() => {
    let max = 0
    const rows = matrixRows()
    const cols = matrixCols()
    for (const row of rows) {
      for (const col of cols) {
        const value = flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
        if (value > max) max = value
      }
    }
    return max
  })

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={UNDAUNTED_NORMANDY_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Undaunted: Normandy thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Undaunted: Normandy</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Undaunted: Normandy • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Scenario tracker by side played (US vs Germans).</div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Undaunted: Normandy plays found. In BG Stats, tag your player{' '}
            <span class="mono">color</span> like <span class="mono">US／Normandy Scenario 3</span>{' '}
            or <span class="mono">Germany／S2</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Scenarios"
            plays={scenarioCounts()}
            wins={scenarioWins()}
            keys={scenarioKeys()}
            onPlaysClick={(scenario) =>
              props.onOpenPlays({
                title: `Undaunted: Normandy • Scenario: ${scenario}`,
                playIds: playIdsByScenario().get(normalizeLabel(scenario)) ?? [],
              })
            }
          />

          <CountTable
            title="Sides"
            plays={sideCounts()}
            wins={sideWins()}
            keys={sideKeys()}
            onPlaysClick={(side) =>
              props.onOpenPlays({
                title: `Undaunted: Normandy • Side: ${side}`,
                playIds: playIdsBySide().get(normalizeLabel(side)) ?? [],
              })
            }
          />
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">{flipAxes() ? 'Side × Scenario' : 'Scenario × Side'}</h3>
            <div class="finalGirlControls">
              <label class="controlCheckbox">
                <input
                  type="checkbox"
                  checked={flipAxes()}
                  onChange={(e) => setFlipAxes(e.currentTarget.checked)}
                />{' '}
                Flip axes
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
                  <option value="played">Played</option>
                </select>
              </label>
            </div>
          </div>

          <HeatmapMatrix
            rows={matrixRows()}
            cols={matrixCols()}
            rowHeader={flipAxes() ? 'Side' : 'Scenario'}
            colHeader={flipAxes() ? 'Scenario' : 'Side'}
            maxCount={matrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
            onCellClick={(row, col) => {
              const scenario = flipAxes() ? col : row
              const side = flipAxes() ? row : col
              const key = pairKey(scenario, side)
              props.onOpenPlays({
                title: `Undaunted: Normandy • ${scenario} × ${side}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />
        </div>
      </Show>
    </div>
  )
}
