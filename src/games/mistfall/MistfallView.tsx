import { Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import CountTable from '../../components/CountTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { incrementCount, sortKeysByCountDesc } from '../../stats'
import { computeGameAchievements } from '../../achievements/games'
import {
  buildLabelToIdLookup,
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import mappingsText from './content.yaml?raw'
import {
  normalizeMistfallName,
  parseMistfallMappings,
  resolveMistfallHero,
  resolveMistfallQuest,
} from './mappings'

const MISTFALL_BASE_OBJECT_ID = '168274'
const HEART_OF_THE_MISTS_OBJECT_ID = '193953'
const mappings = parseMistfallMappings(mappingsText)

type MistfallEntry = {
  play: BggPlay
  hero: string
  quest: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function normalizeMistfallQuestNumber(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const match =
    trimmed.match(/^(?:quest|q)\s*(\d+)\b/i) ||
    trimmed.match(/^q\s*[:：]?\s*(\d+)\b/i)
  if (!match) return undefined

  const num = Number(match[1])
  if (!Number.isFinite(num) || num <= 0) return undefined
  return String(num)
}

function normalizeMistfallQuestToken(
  input: string,
  kind: 'mistfall' | 'hotm',
): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const normalizedId = trimmed.replace(/\s+/g, '')
  const directMatch = /^(?:M|MF|Mistfall)\s*([0-9]+)$/i.exec(normalizedId)
  if (directMatch) return `M${directMatch[1]}`

  const hotmMatch =
    /^(?:H|HOM|HOTM|Heart(?:ofthe)?mists?)\s*([0-9]+)$/i.exec(normalizedId)
  if (hotmMatch) return `H${hotmMatch[1]}`

  const questNumber = normalizeMistfallQuestNumber(trimmed)
  if (!questNumber) return undefined
  return kind === 'mistfall' ? `M${questNumber}` : `H${questNumber}`
}

function resolveQuest(color: string, tags: string[], kind: 'mistfall' | 'hotm'): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey = getBgStatsValue(parsed, ['Q', 'Quest', 'Scenario'])
  if (fromKey) {
    const token = normalizeMistfallQuestToken(fromKey, kind)
    if (token) return resolveMistfallQuest(token, mappings) || `Quest ${token.slice(1)}`
    return resolveMistfallQuest(fromKey, mappings) || fromKey.trim()
  }

  for (const tag of tags) {
    const token = normalizeMistfallQuestToken(tag, kind)
    if (token) return resolveMistfallQuest(token, mappings) || `Quest ${token.slice(1)}`

    const resolved = resolveMistfallQuest(tag, mappings)
    if (resolved) return resolved
  }

  return 'Unknown quest'
}

function resolveHero(color: string, tags: string[]): string {
  const parsed = parseBgStatsKeyValueSegments(color)
  const fromKey = getBgStatsValue(parsed, ['H', 'Hero', 'Character'])
  if (fromKey) return resolveMistfallHero(fromKey, mappings) || fromKey.trim()

  for (const tag of tags) {
    if (normalizeMistfallQuestToken(tag, 'mistfall') || normalizeMistfallQuestToken(tag, 'hotm'))
      continue
    const resolved = resolveMistfallHero(tag, mappings)
    if (resolved) return resolved
    const trimmed = tag.trim()
    if (trimmed) return trimmed
  }

  return 'Unknown hero'
}

export default function MistfallView(props: {
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

  const [mistfallThing] = createResource(
    () => ({ id: MISTFALL_BASE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo<MistfallEntry[]>(() => {
    const result: MistfallEntry[] = []
    const user = props.username.toLowerCase()

    for (const play of props.plays) {
      const objectid = play.item?.attributes.objectid || ''
      const name = play.item?.attributes.name || ''
      const isMistfall = objectid === MISTFALL_BASE_OBJECT_ID || name === 'Mistfall'
      const isHeartOfTheMists =
        objectid === HEART_OF_THE_MISTS_OBJECT_ID || name === 'Mistfall: Heart of the Mists'
      if (!isMistfall && !isHeartOfTheMists) continue
      const kind: 'mistfall' | 'hotm' = isHeartOfTheMists ? 'hotm' : 'mistfall'

      const player = play.players.find(
        (p) => (p.attributes.username || '').toLowerCase() === user,
      )
      const color = player?.attributes.color || ''
      const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

      const hero = resolveHero(color, tags)
      const quest = resolveQuest(color, tags, kind)

      result.push({
        play,
        hero,
        quest,
        quantity: playQuantity(play),
        isWin: player?.attributes.win === '1',
      })
    }

    return result
  })

  const achievements = createMemo(() =>
    computeGameAchievements('mistfall', props.plays, props.username),
  )

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))

  function mergeKnownKeys(played: string[], known: string[]): string[] {
    const seen = new Set(played.map(normalizeMistfallName))
    const merged = [...played]
    for (const value of known) {
      const normalized = normalizeMistfallName(value)
      if (!seen.has(normalized)) {
        seen.add(normalized)
        merged.push(value)
      }
    }
    return merged
  }

  const heroCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.hero, entry.quantity)
    return counts
  })

  const playIdsByHero = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.hero] ||= []).push(entry.play.id)
    }
    return ids
  })

  const heroWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.hero, entry.quantity)
    }
    return counts
  })

  const questCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.quest, entry.quantity)
    return counts
  })

  const playIdsByQuest = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      ;(ids[entry.quest] ||= []).push(entry.play.id)
    }
    return ids
  })

  const questWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.quest, entry.quantity)
    }
    return counts
  })

  const matrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    for (const entry of entries()) {
      counts[entry.hero] ||= {}
      incrementCount(counts[entry.hero]!, entry.quest, entry.quantity)
    }
    return counts
  })

  const playIdsByPair = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = `${entry.hero}|||${entry.quest}`
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const heroLabelToId = createMemo(() =>
    buildLabelToIdLookup([...mappings.heroesById.entries()].map(([id, label]) => ({ id, label }))),
  )
  const questLabelToId = createMemo(() =>
    buildLabelToIdLookup([...mappings.questsById.entries()].map(([id, label]) => ({ id, label }))),
  )

  function getHeroNextAchievement(hero: string) {
    const normalized = normalizeAchievementItemLabel(hero).toLowerCase()
    const id = heroLabelToId().get(normalized) ?? slugifyAchievementItemId(hero)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`heroPlays:${id}`])
  }

  function getQuestNextAchievement(quest: string) {
    const normalized = normalizeAchievementItemLabel(quest).toLowerCase()
    const id = questLabelToId().get(normalized) ?? slugifyAchievementItemId(quest)
    return pickBestAvailableAchievementForTrackIds(achievements(), [
      `questPlays:${id}`,
      `questWins:${id}`,
    ])
  }

  const matrixRows = createMemo(() =>
    flipAxes()
      ? mergeKnownKeys(sortKeysByCountDesc(questCounts()), mappings.allQuests)
      : mergeKnownKeys(sortKeysByCountDesc(heroCounts()), mappings.allHeroes),
  )
  const matrixCols = createMemo(() =>
    flipAxes()
      ? mergeKnownKeys(sortKeysByCountDesc(heroCounts()), mappings.allHeroes)
      : mergeKnownKeys(sortKeysByCountDesc(questCounts()), mappings.allQuests),
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
        <Show when={mistfallThing()?.image || mistfallThing()?.thumbnail}>
          {(thumbnail) => (
            <a
              class="finalGirlThumbLink"
              href={`https://boardgamegeek.com/boardgame/${MISTFALL_BASE_OBJECT_ID}`}
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
          Mistfall plays in dataset: <span class="mono">{totalPlays().toLocaleString()}</span>
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
            No Mistfall plays found. For BG Stats tags, put values in the player{' '}
            <span class="mono">color</span> field like{' '}
            <span class="mono">Fengray／Quest 2</span>, <span class="mono">H: Elatha／Q: H1</span>, or{' '}
            <span class="mono">Hareag／M4</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="Heroes"
            plays={heroCounts()}
            wins={heroWins()}
            keys={mergeKnownKeys(sortKeysByCountDesc(heroCounts()), mappings.allHeroes)}
            getNextAchievement={getHeroNextAchievement}
            onPlaysClick={(hero) =>
              props.onOpenPlays({
                title: `Mistfall • Hero: ${hero}`,
                playIds: playIdsByHero()[hero] ?? [],
              })
            }
          />
          <CountTable
            title="Quests"
            plays={questCounts()}
            wins={questWins()}
            keys={mergeKnownKeys(sortKeysByCountDesc(questCounts()), mappings.allQuests)}
            getNextAchievement={getQuestNextAchievement}
            onPlaysClick={(quest) =>
              props.onOpenPlays({
                title: `Mistfall • Quest: ${quest}`,
                playIds: playIdsByQuest()[quest] ?? [],
              })
            }
          />
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
            onCellClick={(row, col) => {
              const hero = flipAxes() ? col : row
              const quest = flipAxes() ? row : col
              const key = `${hero}|||${quest}`
              props.onOpenPlays({
                title: `Mistfall • ${hero} × ${quest}`,
                playIds: playIdsByPair().get(key) ?? [],
              })
            }}
          />
        </div>
      </Show>
    </div>
  )
}
