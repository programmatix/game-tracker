import { For, Show, createMemo, createSignal } from 'solid-js'
import type { Achievement } from '../achievements/types'
import { sortUnlockedAchievements } from '../achievements/engine'
import ProgressBar from './ProgressBar'

function AchievementCompletionRow(props: { achievement: Achievement }) {
  const completion = () => props.achievement.completion
  return (
    <Show when={props.achievement.status === 'completed' && completion()}>
      <div class="achievementCompletion muted">
        <span>{completion()!.detail}</span>
        <Show when={completion()!.playDate}>
          <span class="mono"> {'—'} {completion()!.playDate}</span>
        </Show>
      </div>
    </Show>
  )
}

type AchievementSortMode = 'remaining' | 'type'

type AchievementTypeGroup = {
  typeLabel: string
  achievements: Achievement[]
}

function groupAchievementsByType(achievements: Achievement[]): AchievementTypeGroup[] {
  const groups = new Map<string, Achievement[]>()
  for (const achievement of achievements) {
    const label = achievement.typeLabel || 'Other'
    const bucket = groups.get(label)
    if (bucket) {
      bucket.push(achievement)
      continue
    }
    groups.set(label, [achievement])
  }
  return [...groups.entries()].map(([typeLabel, groupedAchievements]) => ({
    typeLabel,
    achievements: groupedAchievements,
  }))
}

function compareAchievementsByRemaining(a: Achievement, b: Achievement) {
  const aCompleted = a.status === 'completed'
  const bCompleted = b.status === 'completed'
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1
  if (a.remainingPlays !== b.remainingPlays) return a.remainingPlays - b.remainingPlays
  if (a.playsSoFar !== b.playsSoFar) return b.playsSoFar - a.playsSoFar
  return a.title.localeCompare(b.title)
}

function compareAchievementsWithinType(a: Achievement, b: Achievement) {
  const aCompleted = a.status === 'completed'
  const bCompleted = b.status === 'completed'
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1
  if (!aCompleted && !bCompleted) return compareAchievementsByRemaining(a, b)
  if (b.level !== a.level) return b.level - a.level
  return a.title.localeCompare(b.title)
}

function AchievementLabel(props: {
  achievement: Achievement
  showGameName?: boolean
  isPinned: () => boolean
}) {
  return (
    <>
      <Show when={props.showGameName}>
        <span class="muted">{props.achievement.gameName} — </span>
      </Show>
      <span>{props.achievement.title}</span>
      <Show when={props.isPinned() && props.achievement.status === 'completed'}>
        <span class="achievementTag">Unlocked</span>
      </Show>
      <AchievementCompletionRow achievement={props.achievement} />
    </>
  )
}

function AchievementTableRow(props: {
  achievement: Achievement
  isPinned: () => boolean
  showGameName?: boolean
  onTogglePin: (achievementId: string) => void
  progressWidthPx: number
  showRemainingColumn: boolean
}) {
  const togglePin = (source: 'row' | 'button' | 'keyboard') => {
    console.log('achievement pin toggle requested', {
      source,
      achievementId: props.achievement.id,
      title: props.achievement.title,
      currentlyPinned: props.isPinned(),
    })
    props.onTogglePin(props.achievement.id)
  }

  return (
    <tr
      class="achievementRow"
      tabIndex={0}
      onClick={() => togglePin('row')}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        togglePin('keyboard')
      }}
      aria-label={`${props.isPinned() ? 'Unpin' : 'Pin'} achievement ${props.achievement.title}`}
    >
      <td class="pinCell">
        <button
          class="pinButton"
          classList={{ pinButtonActive: props.isPinned() }}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            togglePin('button')
          }}
          aria-label={props.isPinned() ? 'Unpin achievement' : 'Pin achievement'}
        >
          {props.isPinned() ? '★' : '☆'}
        </button>
      </td>
      <td>
        <AchievementLabel
          achievement={props.achievement}
          showGameName={props.showGameName}
          isPinned={props.isPinned}
        />
      </td>
      <Show when={props.showRemainingColumn}>
        <td class="mono">
          <Show when={props.achievement.status === 'available'} fallback={<span class="muted">—</span>}>
            {props.achievement.remainingPlays.toLocaleString()}
          </Show>
        </td>
      </Show>
      <td>
        <ProgressBar
          value={props.achievement.progressValue}
          target={props.achievement.progressTarget}
          widthPx={props.progressWidthPx}
          label={props.achievement.progressLabel}
        />
      </td>
    </tr>
  )
}

function AchievementsTable(props: {
  achievements: Achievement[]
  showGameName?: boolean
  onTogglePin: (achievementId: string) => void
  isPinned: (achievementId: string) => boolean
  progressWidthPx: number
  showRemainingColumn: boolean
}) {
  return (
    <div class="tableWrap compact">
      <table class="table compactTable">
        <thead>
          <tr>
            <th class="pinCell" aria-label="Pinned"></th>
            <th>Achievement</th>
            <Show when={props.showRemainingColumn}>
              <th class="mono">Remaining</th>
            </Show>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.achievements}>
            {(achievement) => (
              <AchievementTableRow
                achievement={achievement}
                isPinned={() => props.isPinned(achievement.id)}
                showGameName={props.showGameName}
                onTogglePin={props.onTogglePin}
                progressWidthPx={props.progressWidthPx}
                showRemainingColumn={props.showRemainingColumn}
              />
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

function AchievementsByType(props: {
  groups: AchievementTypeGroup[]
  showGameName?: boolean
  onTogglePin: (achievementId: string) => void
  isPinned: (achievementId: string) => boolean
  progressWidthPx: number
  showRemainingColumn: boolean
}) {
  return (
    <For each={props.groups}>
      {(group) => (
        <div class="achievementTypeGroup">
          <h5 class="achievementsTypeTitle">{group.typeLabel}</h5>
          <AchievementsTable
            achievements={group.achievements}
            showGameName={props.showGameName}
            onTogglePin={props.onTogglePin}
            isPinned={props.isPinned}
            progressWidthPx={props.progressWidthPx}
            showRemainingColumn={props.showRemainingColumn}
          />
        </div>
      )}
    </For>
  )
}

export default function AchievementsPanel(props: {
  title?: string
  achievements: Achievement[]
  nextLimit: number
  showGameName?: boolean
  pinnedAchievementIds: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  suppressAvailableTrackIds?: ReadonlySet<string>
}) {
  const isPinned = (achievementId: string) => props.pinnedAchievementIds.has(achievementId)

  const filteredAchievements = createMemo(() => {
    const suppress = props.suppressAvailableTrackIds
    if (!suppress || suppress.size === 0) return props.achievements
    return props.achievements.filter(
      (achievement) =>
        !(
          achievement.status === 'available' &&
          suppress.has(achievement.trackId) &&
          !isPinned(achievement.id)
        ),
    )
  })

  const sorted = createMemo(() =>
    sortUnlockedAchievements(filteredAchievements(), {
      pinnedAchievementIds: props.pinnedAchievementIds,
    }),
  )
  const nextLocked = createMemo(() => {
    const available = sorted().available
    const pinned = available.filter((achievement) => isPinned(achievement.id))
    const unpinned = available.filter((achievement) => !isPinned(achievement.id))
    const remainingSlots = Math.max(0, props.nextLimit - pinned.length)
    return [...pinned, ...unpinned.slice(0, remainingSlots)]
  })
  const [sortMode, setSortMode] = createSignal<AchievementSortMode>('type')
  const [separateCompleted, setSeparateCompleted] = createSignal(false)

  const availableByType = createMemo(() => groupAchievementsByType(sorted().available))
  const completedByType = createMemo(() => groupAchievementsByType(sorted().completed))
  const combinedByType = createMemo(() =>
    groupAchievementsByType([...sorted().available, ...sorted().completed]).map((group) => ({
      ...group,
      achievements: group.achievements.slice().sort(compareAchievementsWithinType),
    })),
  )
  const combinedByRemaining = createMemo(() =>
    [...sorted().available, ...sorted().completed].slice().sort(compareAchievementsByRemaining),
  )

  return (
    <div class="statsBlock">
      <div class="statsTitleRow">
        <h3 class="statsTitle">{props.title ?? 'Achievements'}</h3>
        <div class="muted mono">
          <span>Locked:</span> {sorted().available.length.toLocaleString()}
          {' • '}
          <span>Completed:</span> {sorted().completed.length.toLocaleString()}
        </div>
      </div>

      <Show
        when={nextLocked().length > 0}
        fallback={<div class="muted">No locked achievements.</div>}
      >
        <AchievementsTable
          achievements={nextLocked()}
          showGameName={props.showGameName}
          onTogglePin={props.onTogglePin}
          isPinned={isPinned}
          progressWidthPx={220}
          showRemainingColumn
        />
      </Show>

      <details class="details">
        <summary>View all achievements</summary>
        <div class="achievementsList">
          <div class="achievementSortRow">
            <label class="achievementSortLabel">
              Sort by
              <select
                class="input achievementSortSelect"
                value={sortMode()}
                onChange={(event) => setSortMode(event.currentTarget.value as AchievementSortMode)}
              >
                <option value="remaining">Remaining</option>
                <option value="type">Type</option>
              </select>
            </label>
            <label class="checkboxLabel">
              <input
                type="checkbox"
                checked={separateCompleted()}
                onChange={(event) => setSeparateCompleted(event.currentTarget.checked)}
              />
              Separate completed
            </label>
          </div>

          <Show when={!separateCompleted()}>
            <Show when={combinedByRemaining().length > 0} fallback={<div class="muted">No achievements.</div>}>
              <h4 class="achievementsSectionTitle">Achievements</h4>
              <Show
                when={sortMode() === 'remaining'}
                fallback={
                  <AchievementsByType
                    groups={combinedByType()}
                    showGameName={props.showGameName}
                    onTogglePin={props.onTogglePin}
                    isPinned={isPinned}
                    progressWidthPx={240}
                    showRemainingColumn
                  />
                }
              >
                <AchievementsTable
                  achievements={combinedByRemaining()}
                  showGameName={props.showGameName}
                  onTogglePin={props.onTogglePin}
                  isPinned={isPinned}
                  progressWidthPx={240}
                  showRemainingColumn
                />
              </Show>
            </Show>
          </Show>

          <Show when={separateCompleted()}>
            <Show
              when={sorted().available.length > 0}
              fallback={<div class="muted">No locked achievements.</div>}
            >
              <h4 class="achievementsSectionTitle">Locked</h4>
              <Show
                when={sortMode() === 'remaining'}
                fallback={
                  <AchievementsByType
                    groups={availableByType()}
                    showGameName={props.showGameName}
                    onTogglePin={props.onTogglePin}
                    isPinned={isPinned}
                    progressWidthPx={240}
                    showRemainingColumn
                  />
                }
              >
                <AchievementsTable
                  achievements={sorted().available}
                  showGameName={props.showGameName}
                  onTogglePin={props.onTogglePin}
                  isPinned={isPinned}
                  progressWidthPx={240}
                  showRemainingColumn
                />
              </Show>
            </Show>

            <Show when={sorted().completed.length > 0}>
              <h4 class="achievementsSectionTitle">Completed</h4>
              <Show
                when={sortMode() === 'remaining'}
                fallback={
                  <AchievementsByType
                    groups={completedByType()}
                    showGameName={props.showGameName}
                    onTogglePin={props.onTogglePin}
                    isPinned={isPinned}
                    progressWidthPx={240}
                    showRemainingColumn={false}
                  />
                }
              >
                <AchievementsTable
                  achievements={sorted().completed}
                  showGameName={props.showGameName}
                  onTogglePin={props.onTogglePin}
                  isPinned={isPinned}
                  progressWidthPx={240}
                  showRemainingColumn={false}
                />
              </Show>
            </Show>
          </Show>
        </div>
      </details>
    </div>
  )
}
