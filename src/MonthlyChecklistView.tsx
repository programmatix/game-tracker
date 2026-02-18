import { For, createMemo } from 'solid-js'
import type { BggPlay } from './bgg'

type ChecklistItem = {
  key: string
  label: string
  objectIds?: string[]
  titleIncludes?: string[]
}

type MonthlyChecklistRow = {
  key: string
  label: string
  played: boolean
  playCount: number
  totalMinutes: number
  dates: string[]
}

function normalizeTitle(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function playLengthMinutes(play: BggPlay): number {
  const parsed = Number(play.attributes.length || '0')
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

const CHECKLIST: ReadonlyArray<ChecklistItem> = [
  { key: 'vantage', label: 'Vantage', titleIncludes: ['vantage'] },
  {
    key: 'starTrekCaptainsChair',
    label: "Star Trek Captain's Chair",
    titleIncludes: ["star trek: captain's chair", "star trek captain's chair"],
  },
  {
    key: 'marvelChampions',
    label: 'Marvel Champions',
    titleIncludes: ['marvel champions'],
  },
  {
    key: 'robinsonCrusoe',
    label: 'Robinson Crusoe',
    titleIncludes: ['robinson crusoe'],
  },
  { key: 'mageKnight', label: 'Mage Knight', titleIncludes: ['mage knight'] },
  {
    key: 'skytearHorde',
    label: 'Sky Tear Horde',
    titleIncludes: ['skytear horde', 'sky tear horde'],
  },
  { key: 'deckers', label: 'Deckers', titleIncludes: ['deckers'] },
  {
    key: 'mandalorianAdventures',
    label: 'Mandalorian Adventures',
    titleIncludes: ['mandalorian adventures', 'the mandalorian: adventures', 'the mandalorian adventures'],
  },
  { key: 'undaunted', label: 'Undaunted', titleIncludes: ['undaunted'] },
  { key: 'mistfall', label: 'Mistfall', titleIncludes: ['mistfall'] },
  { key: 'unsettled', label: 'Unsettled', objectIds: ['290484'], titleIncludes: ['unsettled'] },
  { key: 'finalGirl', label: 'Final Girl', objectIds: ['277659'], titleIncludes: ['final girl'] },
  {
    key: 'tooManyBones',
    label: 'Too Many Bones',
    objectIds: ['192135'],
    titleIncludes: ['too many bones'],
  },
  {
    key: 'elderScrolls',
    label: 'Elder Scrolls',
    objectIds: ['356080'],
    titleIncludes: ['elder scrolls'],
  },
  {
    key: 'spiritIsland',
    label: 'Spirit Island',
    titleIncludes: ['spirit island'],
  },
  { key: 'gloomhaven', label: 'Gloomhaven', titleIncludes: ['gloomhaven'] },
  { key: 'bullet', label: 'Bullet', titleIncludes: ['bullet'] },
] as const

function isPlayForItem(play: BggPlay, item: ChecklistItem): boolean {
  const objectId = play.item?.attributes.objectid || ''
  if (item.objectIds && item.objectIds.includes(objectId)) return true

  const title = normalizeTitle(play.item?.attributes.name || '')
  if (!title) return false

  const patterns = item.titleIncludes?.map(normalizeTitle).filter(Boolean) || []
  return patterns.some((p) => title.includes(p))
}

function currentMonthPrefix(now: Date): { prefix: string; label: string } {
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const month = String(monthIndex + 1).padStart(2, '0')
  const prefix = `${year}-${month}-`
  const label = new Date(year, monthIndex, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  return { prefix, label }
}

export default function MonthlyChecklistView(props: { plays: BggPlay[] }) {
  const month = createMemo(() => currentMonthPrefix(new Date()))
  const monthPlays = createMemo(() => {
    const prefix = month().prefix
    return props.plays.filter((p) => (p.attributes.date || '').startsWith(prefix))
  })

  const rows = createMemo<MonthlyChecklistRow[]>(() => {
    const plays = monthPlays()

    return CHECKLIST.map((item) => {
      let playCount = 0
      let totalMinutes = 0
      const dates = new Set<string>()

      for (const play of plays) {
        if (!isPlayForItem(play, item)) continue
        const qty = playQuantity(play)
        playCount += qty
        totalMinutes += playLengthMinutes(play) * qty
        const date = play.attributes.date || ''
        if (date) dates.add(date)
      }

      return {
        key: item.key,
        label: item.label,
        played: playCount > 0,
        playCount,
        totalMinutes,
        dates: Array.from(dates).sort(),
      }
    })
  })

  return (
    <div class="finalGirl">
      <div class="meta">
        Month: <span class="mono">{month().label}</span>
      </div>

      <div class="tableWrap">
        <table class="table tableCompact">
          <thead>
            <tr>
              <th>Game</th>
              <th>Played</th>
              <th>Play count</th>
              <th>Total time</th>
              <th>When played</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => (
                <tr>
                  <td>{row.label}</td>
                  <td class="mono">{row.played ? '✓' : ''}</td>
                  <td class="mono">{row.playCount ? row.playCount.toLocaleString() : '0'}</td>
                  <td class="mono">{row.totalMinutes ? `${row.totalMinutes}m` : '0m'}</td>
                  <td class="mono">{row.dates.length > 0 ? row.dates.join(', ') : '—'}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}

