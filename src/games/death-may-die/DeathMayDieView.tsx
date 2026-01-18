import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { incrementCount, sortKeysByCountDesc } from '../../stats'
import { computeGameAchievements } from '../../achievements/games'
import {
  normalizeDeathMayDieElderOne,
  normalizeDeathMayDieScenario,
  parseDeathMayDiePlayerColor,
} from './deathMayDie'

const DEATH_MAY_DIE_OBJECT_ID = '253344'

type DeathMayDieEntry = {
  play: BggPlay
  elderOne: string
  scenario: string
  investigators: string[]
  myInvestigator?: string
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function chooseMostCommonOrFirst(candidates: string[]): string | undefined {
  const normalized = candidates.map((value) => value.trim()).filter(Boolean)
  if (normalized.length === 0) return undefined
  const counts = new Map<string, number>()
  for (const value of normalized) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: { value: string; count: number } | undefined
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count }
  }
  return best?.value ?? normalized[0]
}

export default function DeathMayDieView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
}) {
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [hideCounts, setHideCounts] = createSignal(true)

  const [deathMayDieThing] = createResource(
    () => ({ id: DEATH_MAY_DIE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo<DeathMayDieEntry[]>(() => {
    const result: DeathMayDieEntry[] = []
    const user = props.username.toLowerCase()

    for (const play of props.plays) {
      const objectid = play.item?.attributes.objectid || ''
      const name = play.item?.attributes.name || ''
      const isDeathMayDie = objectid === DEATH_MAY_DIE_OBJECT_ID || name === 'Cthulhu: Death May Die'
      if (!isDeathMayDie) continue

      const parsedPlayers = play.players
        .map((player) => {
          const rawColor = player.attributes.color || ''
          const parsed = parseDeathMayDiePlayerColor(rawColor)
          return {
            username: (player.attributes.username || '').toLowerCase(),
            investigator: parsed.investigator,
            elderOne: parsed.elderOne,
            scenario: parsed.scenario,
          }
        })
        .filter((player) => Boolean(player.investigator || player.elderOne || player.scenario))

      const investigators = parsedPlayers
        .map((p) => p.investigator)
        .filter(Boolean)
        .map((token) => token!.trim())
        .filter(Boolean)

      const myInvestigator = parsedPlayers.find((p) => p.username === user)?.investigator

      const elderCandidates = parsedPlayers
        .map((p) => p.elderOne)
        .filter(Boolean)
        .map((token) => normalizeDeathMayDieElderOne(token!))

      const scenarioCandidates = parsedPlayers
        .map((p) => p.scenario)
        .filter(Boolean)
        .map((token) => normalizeDeathMayDieScenario(token!) || token!)

      const elderOne = chooseMostCommonOrFirst(elderCandidates) || 'Unknown elder one'
      const scenario = chooseMostCommonOrFirst(scenarioCandidates) || 'Unknown scenario'

      const qty = playQuantity(play)
      for (let i = 0; i < qty; i += 1) {
        result.push({ play, elderOne, scenario, investigators, myInvestigator })
      }
    }

    return result
  })

  const achievements = createMemo(() =>
    computeGameAchievements('deathMayDie', props.plays, props.username),
  )

  const elderOneCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.elderOne)
    return counts
  })

  const scenarioCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.scenario)
    return counts
  })

  const investigatorCountsAll = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const investigator of entry.investigators) incrementCount(counts, investigator)
    }
    return counts
  })

  const investigatorCountsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myInvestigator) continue
      incrementCount(counts, entry.myInvestigator)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.elderOne] ||= {}
      incrementCount(counts[entry.elderOne]!, entry.scenario)
    }
    return counts
  })

  const matrixRows = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(scenarioCounts()) : sortKeysByCountDesc(elderOneCounts()),
  )
  const matrixCols = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(elderOneCounts()) : sortKeysByCountDesc(scenarioCounts()),
  )

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
        <Show when={deathMayDieThing()?.thumbnail}>
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
          <span class="mono">{entries().length.toLocaleString()}</span>
        </div>
      </div>

      <AchievementsPanel achievements={achievements()} nextLimit={5} />

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
          <CountTable title="Elder Ones" counts={elderOneCounts()} />
          <CountTable title="Scenarios" counts={scenarioCounts()} />
          <CountTable title="My Investigators" counts={investigatorCountsMine()} />
          <CountTable title="All Investigators" counts={investigatorCountsAll()} />
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
          />
        </div>
      </Show>
    </div>
  )
}
