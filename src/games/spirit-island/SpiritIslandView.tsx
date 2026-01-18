import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import CountTable from '../../components/CountTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { incrementCount, sortKeysByCountDesc } from '../../stats'
import { computeGameAchievements } from '../../achievements/games'
import mappingsText from './mappings.txt?raw'
import {
  formatSpiritIslandAdversaryLabel,
  parseSpiritIslandMappings,
  resolveSpiritIslandAdversary,
  resolveSpiritIslandSpirit,
} from './mappings'

const SPIRIT_ISLAND_OBJECT_ID = '162886'
const mappings = parseSpiritIslandMappings(mappingsText)

type SpiritIslandEntry = {
  play: BggPlay
  spirit: string
  adversary: string
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function resolveSpirit(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey =
    getBgStatsValue(parsed, ['S', 'Spirit']) ||
    getBgStatsValue(parsed, ['Sp', 'SpiritIslandSpirit'])

  if (fromKey) return resolveSpiritIslandSpirit(fromKey, mappings) || fromKey.trim()

  for (const tag of tags) {
    const resolved = resolveSpiritIslandSpirit(tag, mappings)
    if (resolved) return resolved
  }

  const fallback = tags[0]?.trim()
  return fallback || 'Unknown spirit'
}

function resolveAdversary(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey =
    getBgStatsValue(parsed, ['A', 'Adv', 'Adversary']) ||
    getBgStatsValue(parsed, ['AL', 'AdversaryLevel'])
  const level = getBgStatsValue(parsed, ['L', 'Level'])

  if (fromKey) {
    const resolved = resolveSpiritIslandAdversary(fromKey, mappings)
    if (resolved) return formatSpiritIslandAdversaryLabel(resolved)
    if (level) return `${fromKey.trim()} L${level.trim()}`
    return fromKey.trim()
  }

  if (level) {
    const baseToken = tags.find((tag) => resolveSpiritIslandAdversary(tag, mappings))
    if (baseToken) {
      const resolved = resolveSpiritIslandAdversary(baseToken, mappings)
      if (resolved) return formatSpiritIslandAdversaryLabel({ ...resolved, level })
      return `${baseToken.trim()} L${level.trim()}`
    }
  }

  for (const tag of tags) {
    const resolved = resolveSpiritIslandAdversary(tag, mappings)
    if (resolved) return formatSpiritIslandAdversaryLabel(resolved)
  }

  const fallback = tags[1]?.trim()
  return fallback || 'No adversary'
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

  const entries = createMemo<SpiritIslandEntry[]>(() => {
    const result: SpiritIslandEntry[] = []
    const user = props.username.toLowerCase()

    for (const play of props.plays) {
      const objectid = play.item?.attributes.objectid || ''
      const name = play.item?.attributes.name || ''
      const isSpiritIsland = objectid === SPIRIT_ISLAND_OBJECT_ID || name === 'Spirit Island'
      if (!isSpiritIsland) continue

      const player = play.players.find(
        (p) => (p.attributes.username || '').toLowerCase() === user,
      )
      const color = player?.attributes.color || ''
      const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

      const spirit = resolveSpirit(color, tags)
      const adversary = resolveAdversary(color, tags)

      const qty = playQuantity(play)
      for (let i = 0; i < qty; i += 1) result.push({ play, spirit, adversary })
    }

    return result
  })

  const achievements = createMemo(() =>
    computeGameAchievements('spiritIsland', props.plays, props.username),
  )

  const spiritCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.spirit)
    return counts
  })

  const adversaryCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.adversary)
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.spirit] ||= {}
      incrementCount(counts[entry.spirit]!, entry.adversary)
    }
    return counts
  })

  const matrixRows = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(adversaryCounts()) : sortKeysByCountDesc(spiritCounts()),
  )
  const matrixCols = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(spiritCounts()) : sortKeysByCountDesc(adversaryCounts()),
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
          <span class="mono">{entries().length.toLocaleString()}</span>
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
          <CountTable title="Spirits" counts={spiritCounts()} />
          <CountTable title="Adversaries" counts={adversaryCounts()} />
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
