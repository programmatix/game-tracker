import { For, Show } from 'solid-js'
import type { Achievement } from '../achievements/types'
import GameLink from './GameLink'
import ProgressBar from './ProgressBar'

export default function NewAchievementsBanner(props: {
  unlocked: Achievement[]
  nextAfterDismiss?: Achievement
  onDismissAll: () => void
  onOpenGame?: (gameKey: string) => void
}) {
  return (
    <div class="newAchievementsBanner" role="status" aria-live="polite">
      <div class="newAchievementsBannerHeader">
        <div>
          <div class="newAchievementsBannerTitle">Achievements unlocked since your last visit</div>
          <div class="muted">
            {props.unlocked.length.toLocaleString()}{' '}
            {props.unlocked.length === 1 ? 'achievement' : 'achievements'} waiting to be dismissed
          </div>
        </div>
        <button type="button" onClick={props.onDismissAll}>
          Dismiss all
        </button>
      </div>

      <div class="tableWrap compact">
        <table class="table compactTable">
          <thead>
            <tr>
              <th>Unlocked</th>
              <th class="mono">Progress</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.unlocked}>
              {(achievement) => (
                <tr>
                  <td>
                    <span class="muted">
                      <Show when={props.onOpenGame} fallback={<>{achievement.gameName}</>}>
                        {(onOpenGame) => (
                          <GameLink
                            label={achievement.gameName}
                            gameKey={achievement.gameId}
                            onOpenGame={onOpenGame()}
                            inline
                            class="muted"
                          />
                        )}
                      </Show>{' '}
                      —{' '}
                    </span>
                    <span>{achievement.title}</span>
                  </td>
                  <td class="mono">{achievement.progressLabel}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={props.nextAfterDismiss}>
        {(next) => (
          <div class="newAchievementsBannerNext">
            <div class="muted newAchievementsBannerNextLabel">
              Next achievement after dismissing:
            </div>
            <div class="newAchievementsBannerNextRow">
              <div>
                <span class="muted">
                  <Show when={props.onOpenGame} fallback={<>{next().gameName}</>}>
                    {(onOpenGame) => (
                      <GameLink
                        label={next().gameName}
                        gameKey={next().gameId}
                        onOpenGame={onOpenGame()}
                        inline
                        class="muted"
                      />
                    )}
                  </Show>{' '}
                  —{' '}
                </span>
                <span>{next().title}</span>
              </div>
              <ProgressBar
                value={next().progressValue}
                target={next().progressTarget}
                widthPx={240}
                label={next().progressLabel}
              />
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
