import { For } from 'solid-js'
import { GAME_STATUS_OPTIONS, type GameStatus } from '../gamePreferences'

export default function StandardGameFilters(props: {
  visibleStatuses: readonly GameStatus[]
  onToggleStatus: (status: GameStatus) => void
  checklistOnly: boolean
  onSetChecklistOnly: (value: boolean) => void
  checklistGroupAriaLabel: string
}) {
  return (
    <>
      <div class="costToolbarGroup">
        <div class="muted">Show statuses</div>
        <div class="costTargetGroup" role="group" aria-label="Visible game statuses">
          <For each={GAME_STATUS_OPTIONS}>
            {(status) => (
              <button
                type="button"
                class="tabButton"
                classList={{ tabButtonActive: props.visibleStatuses.includes(status.value) }}
                onClick={() => props.onToggleStatus(status.value)}
              >
                {status.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="costToolbarGroup">
        <div class="muted">Games</div>
        <div class="costTargetGroup" role="group" aria-label={props.checklistGroupAriaLabel}>
          <button
            type="button"
            class="tabButton"
            classList={{ tabButtonActive: !props.checklistOnly }}
            onClick={() => props.onSetChecklistOnly(false)}
          >
            All
          </button>
          <button
            type="button"
            class="tabButton"
            classList={{ tabButtonActive: props.checklistOnly }}
            onClick={() => props.onSetChecklistOnly(true)}
          >
            Checklist only
          </button>
        </div>
      </div>
    </>
  )
}
