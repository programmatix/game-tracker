import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import CountTable from '../../components/CountTable'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { incrementCount, sortKeysByCountDesc } from '../../stats'

const MISTFALL_OBJECT_ID = '193953'

type MistfallEntry = {
  play: BggPlay
  hero: string
  quest: string
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function normalizeMistfallQuestLabel(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const match =
    trimmed.match(/^(?:quest|q)\s*(\d+)\b/i) ||
    trimmed.match(/^q\s*[:：]?\s*(\d+)\b/i)
  if (!match) return undefined

  const num = Number(match[1])
  if (!Number.isFinite(num) || num <= 0) return undefined
  return `Quest ${num}`
}

function resolveQuest(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey = getBgStatsValue(parsed, ['Q', 'Quest', 'Scenario'])
  if (fromKey) return normalizeMistfallQuestLabel(fromKey) || fromKey.trim()

  for (const tag of tags) {
    const normalized = normalizeMistfallQuestLabel(tag)
    if (normalized) return normalized
  }

  return 'Unknown quest'
}

function resolveHero(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey = getBgStatsValue(parsed, ['H', 'Hero', 'Character'])
  if (fromKey) return fromKey.trim()

  for (const tag of tags) {
    if (normalizeMistfallQuestLabel(tag)) continue
    const trimmed = tag.trim()
    if (trimmed) return trimmed
  }

  return 'Unknown hero'
}

export default function MistfallView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
}) {
  const [flipAxes, setFlipAxes] = createSignal(false)
  const [hideCounts, setHideCounts] = createSignal(true)

  const [mistfallThing] = createResource(
    () => ({ id: MISTFALL_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo<MistfallEntry[]>(() => {
    const result: MistfallEntry[] = []
    const user = props.username.toLowerCase()

    for (const play of props.plays) {
      const objectid = play.item?.attributes.objectid || ''
      const name = play.item?.attributes.name || ''
      const isMistfall = objectid === MISTFALL_OBJECT_ID || name === 'Mistfall: Heart of the Mists'
      if (!isMistfall) continue

      const player = play.players.find(
        (p) => (p.attributes.username || '').toLowerCase() === user,
      )
      const color = player?.attributes.color || ''
      const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

      const hero = resolveHero(color, tags)
      const quest = resolveQuest(color, tags)

      const qty = playQuantity(play)
      for (let i = 0; i < qty; i += 1) result.push({ play, hero, quest })
    }

    return result
  })

  const heroCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.hero)
    return counts
  })

  const questCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.quest)
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.hero] ||= {}
      incrementCount(counts[entry.hero]!, entry.quest)
    }
    return counts
  })

  const matrixRows = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(questCounts()) : sortKeysByCountDesc(heroCounts()),
  )
  const matrixCols = createMemo(() =>
    flipAxes() ? sortKeysByCountDesc(heroCounts()) : sortKeysByCountDesc(questCounts()),
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
        <Show when={mistfallThing()?.thumbnail}>
          {(thumbnail) => (
            <a
              class="finalGirlThumbLink"
              href={`https://boardgamegeek.com/boardgame/${MISTFALL_OBJECT_ID}`}
              target="_blank"
              rel="noreferrer"
              title="View on BoardGameGeek"
            >
              <img
                class="finalGirlThumb"
                src={thumbnail()}
                alt="Mistfall thumbnail"
                loading="lazy"
              />
            </a>
          )}
        </Show>
        <div class="meta">
          Mistfall plays in dataset: <span class="mono">{entries().length.toLocaleString()}</span>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Mistfall plays found. For BG Stats tags, put values in the player{' '}
            <span class="mono">color</span> field like <span class="mono">Fengray／Quest 2</span>{' '}
            or <span class="mono">Quest 1／Elatha</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable title="Heroes" counts={heroCounts()} />
          <CountTable title="Quests" counts={questCounts()} />
        </div>

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">{flipAxes() ? 'Quest × Hero' : 'Hero × Quest'}</h3>
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
            rowHeader={flipAxes() ? 'Quest' : 'Hero'}
            colHeader={flipAxes() ? 'Hero' : 'Quest'}
            getCount={(row, col) =>
              flipAxes() ? (matrix()[col]?.[row] ?? 0) : (matrix()[row]?.[col] ?? 0)
            }
          />
        </div>
      </Show>
    </div>
  )
}
