import { Show, createMemo } from 'solid-js'
import {
  CONFIGURABLE_GAME_DEFINITIONS,
  CONFIGURABLE_GAME_OPTIONS,
  DEFAULT_CONFIGURABLE_GAME_ID,
  getConfigurableGameDefinition,
} from './configurableGames'
import {
  GAME_STATUS_OPTIONS,
  isGameStatus,
  type GamePreferences,
  type ResolvedGamePreferencesById,
} from './gamePreferences'

type GameOptionsRowProps = {
  checked: boolean
  title: string
  description: string
  disabled?: boolean
  disabledReason?: string
  onChange: (checked: boolean) => void
}

function GameOptionsRow(props: GameOptionsRowProps) {
  return (
    <label class="gameOptionRow" classList={{ gameOptionRowDisabled: props.disabled }}>
      <div class="gameOptionCopy">
        <div class="gameOptionTitle">{props.title}</div>
        <div class="muted">{props.disabled ? props.disabledReason || props.description : props.description}</div>
      </div>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
    </label>
  )
}

type GameOptionsSelectRowProps = {
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
}

function GameOptionsSelectRow(props: GameOptionsSelectRowProps) {
  return (
    <label class="gameOptionRow">
      <div class="gameOptionCopy">
        <div class="gameOptionTitle">{props.title}</div>
        <div class="muted">{props.description}</div>
      </div>
      <select
        class="gameOptionSelect"
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      >
        {props.options.map((option) => (
          <option value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

type GameOptionsInputRowProps = {
  title: string
  description: string
  value: string
  type?: 'month'
  onChange: (value: string) => void
}

function GameOptionsInputRow(props: GameOptionsInputRowProps) {
  return (
    <label class="gameOptionRow">
      <div class="gameOptionCopy">
        <div class="gameOptionTitle">{props.title}</div>
        <div class="muted">{props.description}</div>
      </div>
      <input
        class="gameOptionSelect"
        type={props.type || 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export default function GameOptionsView(props: {
  selectedGameId: string | null
  gamePreferencesById: ResolvedGamePreferencesById
  onSelectGame: (gameId: string) => void
  onUpdateGamePreferences: (gameId: string, patch: Partial<GamePreferences>) => void
}) {
  const selectedGameId = createMemo<string>(
    () => props.selectedGameId ?? DEFAULT_CONFIGURABLE_GAME_ID ?? CONFIGURABLE_GAME_DEFINITIONS[0]!.id,
  )
  const selectedGame = createMemo(() => getConfigurableGameDefinition(selectedGameId()))
  const selectedPreferences = createMemo(() => props.gamePreferencesById[selectedGameId()])

  return (
    <div class="statsBlock gameOptionsView">
      <div class="statsTitleRow">
        <h3 class="statsTitle">Game options</h3>
        <div class="muted">Changes save to Firebase automatically.</div>
      </div>

      <label class="control gameOptionsPicker">
        <span>Game</span>
        <select
          value={selectedGameId()}
          onChange={(event) => props.onSelectGame(event.currentTarget.value)}
        >
          {CONFIGURABLE_GAME_OPTIONS.map((game) => (
            <option value={game.value}>{game.label}</option>
          ))}
        </select>
      </label>

      <section class="gameOptionsCard">
        <div class="gameOptionsCardHeader">
          <h4>{selectedGame().label}</h4>
          <div class="muted mono">{selectedGame().id}</div>
        </div>

        <div class="gameOptionsRows">
          <GameOptionsSelectRow
            title="Status"
            description="Track whether this game is active, parked, in transit, returned, being sold, or already sold."
            value={selectedPreferences().status}
            options={GAME_STATUS_OPTIONS}
            onChange={(status) => {
              if (!isGameStatus(status)) return
              props.onUpdateGamePreferences(selectedGameId(), {
                status,
                estimatedDeliveryMonth:
                  status === 'waitingOnShipping' ? selectedPreferences().estimatedDeliveryMonth : undefined,
              })
            }}
          />

          <Show when={selectedPreferences().status === 'waitingOnShipping'}>
            <GameOptionsInputRow
              title="Estimated delivery month"
              description="Optional. This is used by the Fulfilment page to group incoming games."
              type="month"
              value={selectedPreferences().estimatedDeliveryMonth || ''}
              onChange={(estimatedDeliveryMonth) =>
                props.onUpdateGamePreferences(selectedGameId(), {
                  estimatedDeliveryMonth: estimatedDeliveryMonth || undefined,
                })
              }
            />
          </Show>

          <GameOptionsRow
            checked={selectedPreferences().showInMonthlyChecklist}
            disabled={!selectedGame().supportsMonthlyChecklist}
            title="Show in monthly checklist"
            description="Include this game in the This month checklist section."
            disabledReason="Monthly checklist matching is not wired up for this game yet."
            onChange={(checked) =>
              props.onUpdateGamePreferences(selectedGameId(), { showInMonthlyChecklist: checked })
            }
          />

          <GameOptionsRow
            checked={selectedPreferences().showAsSeparateTab}
            disabled={!selectedGame().supportsSeparateTab}
            title="Show as separate tab"
            description="Keep this game visible in the main navigation."
            disabledReason="Standalone tabs are not wired up for this game yet."
            onChange={(checked) =>
              props.onUpdateGamePreferences(selectedGameId(), { showAsSeparateTab: checked })
            }
          />

          <GameOptionsRow
            checked={selectedPreferences().showInCostsTable}
            disabled={!selectedGame().supportsCostsTable}
            title="Show in costs table"
            description="Include this game in the costs comparison view."
            disabledReason="Costs data is not wired up for this game yet."
            onChange={(checked) =>
              props.onUpdateGamePreferences(selectedGameId(), { showInCostsTable: checked })
            }
          />

          <GameOptionsRow
            checked={selectedPreferences().calculateAchievements}
            disabled={!selectedGame().supportsAchievements}
            title="Calculate achievements"
            description="Enable achievement calculation for this game across the app."
            disabledReason="This game does not have achievements configured yet."
            onChange={(checked) =>
              props.onUpdateGamePreferences(selectedGameId(), { calculateAchievements: checked })
            }
          />
        </div>
      </section>
    </div>
  )
}
