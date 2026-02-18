import { For, Show, createMemo, createResource } from 'solid-js'
import { fetchThingSummary, type BggPlay } from './bgg'

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
  hasAssumedMinutes: boolean
  dateMinutes: Array<{ date: string; minutes: number; assumed: boolean }>
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

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours <= 0) return `${mins}m`
  if (mins <= 0) return `${hours}h`
  return `${hours}h${String(mins).padStart(2, '0')}m`
}

function thingAssumedPlayTimeMinutes(raw: unknown): number | null {
  const record = raw as Record<string, unknown> | null
  const candidates = ['playingtime', 'minplaytime', 'maxplaytime']

  for (const key of candidates) {
    const node = record?.[key] as Record<string, unknown> | undefined
    const attrs = (node?.$ as Record<string, unknown> | undefined) || undefined
    const value = attrs?.value
    if (typeof value !== 'string') continue
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) continue
    return parsed
  }

  return null
}

function playMinutesWithAssumption(
  play: BggPlay,
  assumedMinutesByObjectId: Map<string, number> | undefined,
): { minutes: number; assumed: boolean } {
  const actual = playLengthMinutes(play)
  if (actual > 0) return { minutes: actual, assumed: false }

  const objectId = play.item?.attributes.objectid || ''
  if (!objectId) return { minutes: 0, assumed: false }
  const assumed = assumedMinutesByObjectId?.get(objectId)
  if (!assumed) return { minutes: 0, assumed: false }
  return { minutes: assumed, assumed: true }
}

const CHECKLIST: ReadonlyArray<ChecklistItem> = [
  { key: 'vantage', label: 'Vantage', titleIncludes: ['vantage'] },
  // {
  //   key: 'starTrekCaptainsChair',
  //   label: "Star Trek Captain's Chair",
  //   titleIncludes: ["star trek: captain's chair", "star trek captain's chair"],
  // },
  // {
  //   key: 'marvelChampions',
  //   label: 'Marvel Champions',
  //   titleIncludes: ['marvel champions'],
  // },
  // {
  //   key: 'robinsonCrusoe',
  //   label: 'Robinson Crusoe',
  //   titleIncludes: ['robinson crusoe'],
  // },
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

function isPlayInChecklist(play: BggPlay): boolean {
  for (const item of CHECKLIST) {
    if (isPlayForItem(play, item)) return true
  }
  return false
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

export default function MonthlyChecklistView(props: { plays: BggPlay[]; authToken?: string }) {
  const month = createMemo(() => currentMonthPrefix(new Date()))
  const monthPlays = createMemo(() => {
    const prefix = month().prefix
    return props.plays.filter((p) => (p.attributes.date || '').startsWith(prefix))
  })

  const assumedObjectIds = createMemo(() => {
    const ids = new Set<string>()
    for (const play of monthPlays()) {
      if (playLengthMinutes(play) > 0) continue
      const objectId = play.item?.attributes.objectid || ''
      if (objectId) ids.add(objectId)
    }
    return Array.from(ids).sort()
  })

  const [assumedMinutesByObjectId] = createResource(assumedObjectIds, async (ids) => {
    const result = new Map<string, number>()
    for (const objectId of ids) {
      try {
        const thing = await fetchThingSummary(objectId, { authToken: props.authToken })
        const minutes = thingAssumedPlayTimeMinutes(thing.raw)
        if (minutes) result.set(objectId, minutes)
      } catch {
        // ignore missing/rate-limited assumed play time
      }
    }
    return result
  })

  const rows = createMemo<MonthlyChecklistRow[]>(() => {
    const plays = monthPlays()
    const assumed = assumedMinutesByObjectId()

    return CHECKLIST.map((item) => {
      let playCount = 0
      let totalMinutes = 0
      const minutesByDate = new Map<string, number>()
      const assumedByDate = new Map<string, boolean>()
      let hasAssumedMinutes = false

      for (const play of plays) {
        if (!isPlayForItem(play, item)) continue
        const qty = playQuantity(play)
        const resolved = playMinutesWithAssumption(play, assumed)
        const minutes = resolved.minutes * qty
        playCount += qty
        totalMinutes += minutes
        const date = play.attributes.date || ''
        if (date) {
          minutesByDate.set(date, (minutesByDate.get(date) || 0) + minutes)
          if (resolved.assumed) {
            assumedByDate.set(date, true)
            hasAssumedMinutes = true
          }
        }
      }

      return {
        key: item.key,
        label: item.label,
        played: playCount > 0,
        playCount,
        totalMinutes,
        hasAssumedMinutes,
        dateMinutes: Array.from(minutesByDate.entries())
          .map(([date, minutes]) => ({ date, minutes, assumed: assumedByDate.get(date) === true }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }
    })
  })

  const otherRows = createMemo(() => {
    const plays = monthPlays().filter((p) => !isPlayInChecklist(p))
    const assumed = assumedMinutesByObjectId()

    const byGame = new Map<
      string,
      {
        label: string
        playCount: number
        totalMinutes: number
        minutesByDate: Map<string, number>
        assumedByDate: Map<string, boolean>
        hasAssumedMinutes: boolean
      }
    >()

    for (const play of plays) {
      const label = play.item?.attributes.name || 'Unknown game'
      const objectId = play.item?.attributes.objectid || ''
      const key = `${label}|||${objectId}`

      const qty = playQuantity(play)
      const resolved = playMinutesWithAssumption(play, assumed)
      const minutes = resolved.minutes * qty
      const date = play.attributes.date || ''

      const existing = byGame.get(key) || {
        label,
        playCount: 0,
        totalMinutes: 0,
        minutesByDate: new Map<string, number>(),
        assumedByDate: new Map<string, boolean>(),
        hasAssumedMinutes: false,
      }

      existing.playCount += qty
      existing.totalMinutes += minutes
      if (date) {
        existing.minutesByDate.set(date, (existing.minutesByDate.get(date) || 0) + minutes)
        if (resolved.assumed) {
          existing.assumedByDate.set(date, true)
          existing.hasAssumedMinutes = true
        }
      }
      byGame.set(key, existing)
    }

    return Array.from(byGame.values())
      .map((row) => ({
        key: row.label,
        label: row.label,
        played: true,
        playCount: row.playCount,
        totalMinutes: row.totalMinutes,
        hasAssumedMinutes: row.hasAssumedMinutes,
        dateMinutes: Array.from(row.minutesByDate.entries())
          .map(([date, minutes]) => ({ date, minutes, assumed: row.assumedByDate.get(date) === true }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  const anyAssumedMinutes = createMemo(() => {
    for (const row of rows()) {
      if (row.hasAssumedMinutes) return true
    }
    for (const row of otherRows()) {
      if (row.hasAssumedMinutes) return true
    }
    return false
  })

  const totals = createMemo(() => {
    let checklistMinutes = 0
    let otherMinutes = 0
    let checklistAssumed = false
    let otherAssumed = false

    for (const row of rows()) {
      checklistMinutes += row.totalMinutes
      if (row.hasAssumedMinutes) checklistAssumed = true
    }
    for (const row of otherRows()) {
      otherMinutes += row.totalMinutes
      if (row.hasAssumedMinutes) otherAssumed = true
    }

    const totalMinutes = checklistMinutes + otherMinutes
    return {
      checklistMinutes,
      otherMinutes,
      totalMinutes,
      checklistAssumed,
      otherAssumed,
      totalAssumed: checklistAssumed || otherAssumed,
    }
  })

  return (
    <div class="finalGirl">
      <div class="meta">
        Month: <span class="mono">{month().label}</span>
      </div>

      <div class="meta">
        Total time:{' '}
        <span class="mono">
          {formatMinutes(totals().totalMinutes)}
          {totals().totalAssumed ? '*' : ''}
        </span>
        {' • '}
        Checklist:{' '}
        <span class="mono">
          {formatMinutes(totals().checklistMinutes)}
          {totals().checklistAssumed ? '*' : ''}
        </span>
        {' • '}
        Other:{' '}
        <span class="mono">
          {formatMinutes(totals().otherMinutes)}
          {totals().otherAssumed ? '*' : ''}
        </span>
      </div>

      <div class="tableWrap">
        <table class="table tableCompact">
          <thead>
            <tr>
              <th>Game</th>
              <th>Played</th>
              <th>Play count</th>
              <th>Total time</th>
              <th class="hideOnMobile">When played</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => (
                <tr>
                  <td>{row.label}</td>
                  <td class="mono">{row.played ? '✓' : ''}</td>
                  <td class="mono">{row.playCount ? row.playCount.toLocaleString() : '0'}</td>
                  <td class="mono">
                    {formatMinutes(row.totalMinutes)}
                    {row.hasAssumedMinutes ? '*' : ''}
                  </td>
                  <td class="mono hideOnMobile">
                    {row.dateMinutes.length > 0
                      ? row.dateMinutes
                          .map(
                            (d) =>
                              `${d.date} (${formatMinutes(d.minutes)}${d.assumed ? '*' : ''})`,
                          )
                          .join(', ')
                      : '—'}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={anyAssumedMinutes()}>
        <div class="muted">
          <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has
          no recorded length.
        </div>
      </Show>

      <div class="meta">
        Other games played: <span class="mono">{otherRows().length.toLocaleString()}</span>
      </div>

      <div class="tableWrap">
        <table class="table tableCompact">
          <thead>
            <tr>
              <th>Game</th>
              <th>Played</th>
              <th>Play count</th>
              <th>Total time</th>
              <th class="hideOnMobile">When played</th>
            </tr>
          </thead>
          <tbody>
            <For each={otherRows()}>
              {(row) => (
                <tr>
                  <td>{row.label}</td>
                  <td class="mono">{row.played ? '✓' : ''}</td>
                  <td class="mono">{row.playCount ? row.playCount.toLocaleString() : '0'}</td>
                  <td class="mono">
                    {formatMinutes(row.totalMinutes)}
                    {row.hasAssumedMinutes ? '*' : ''}
                  </td>
                  <td class="mono hideOnMobile">
                    {row.dateMinutes.length > 0
                      ? row.dateMinutes
                          .map(
                            (d) =>
                              `${d.date} (${formatMinutes(d.minutes)}${d.assumed ? '*' : ''})`,
                          )
                          .join(', ')
                      : '—'}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
