import { For } from 'solid-js'
import { GAME_STATUS_OPTIONS, type GameStatus } from '../gamePreferences'

export default function StandardGameFilters(props: {
  visibleStatuses: readonly GameStatus[]
  onToggleStatus: (status: GameStatus) => void
  checklistOnly: boolean
  onSetChecklistOnly: (value: boolean) => void
  checklistGroupAriaLabel: string
  mobileSortOptions?: readonly { value: string; label: string }[]
  mobileSortValue?: string
  onSetMobileSortValue?: (value: string) => void
  groupMultipleCampaigns?: boolean
  onSetGroupMultipleCampaigns?: (value: boolean) => void
}) {
  return (
    <>
      {props.mobileSortOptions && props.mobileSortOptions.length > 0 && (
        <div class="costToolbarGroup mobileOnly">
          <label class="tabSelectLabel" for="standard-game-mobile-sort">
            Sort by
          </label>
          <select
            id="standard-game-mobile-sort"
            class="tabSelect"
            value={props.mobileSortValue}
            aria-label="Sort games"
            onChange={(event) => props.onSetMobileSortValue?.(event.currentTarget.value)}
          >
            <For each={props.mobileSortOptions}>
              {(option) => <option value={option.value}>{option.label}</option>}
            </For>
          </select>
        </div>
      )}

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

      {typeof props.groupMultipleCampaigns === 'boolean' && props.onSetGroupMultipleCampaigns ? (
        <div class="costToolbarGroup">
          <div class="muted">Campaign rows</div>
          <div class="costTargetGroup" role="group" aria-label="Campaign row grouping">
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: props.groupMultipleCampaigns }}
              onClick={() => props.onSetGroupMultipleCampaigns?.(true)}
            >
              Grouped
            </button>
            <button
              type="button"
              class="tabButton"
              classList={{ tabButtonActive: !props.groupMultipleCampaigns }}
              onClick={() => props.onSetGroupMultipleCampaigns?.(false)}
            >
              Individual
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
