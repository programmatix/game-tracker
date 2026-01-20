import { createMemo } from 'solid-js'
import type { BggPlay } from './bgg'
import AchievementsPanel from './components/AchievementsPanel'
import { computeAllGameAchievementSummaries } from './achievements/games'
import type { SpiritIslandSession } from './games/spirit-island/mindwanderer'

export default function AchievementsView(props: {
  plays: BggPlay[]
  username: string
  spiritIslandSessions?: SpiritIslandSession[]
  pinnedAchievementIds: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
}) {
  const achievements = createMemo(() => {
    const summaries = computeAllGameAchievementSummaries(props.plays, props.username, {
      spiritIslandSessions: props.spiritIslandSessions,
    })
    return summaries.flatMap((summary) => summary.achievements)
  })

  return (
    <div class="finalGirl">
      <AchievementsPanel
        title="Next 10 achievements (all games)"
        achievements={achievements()}
        nextLimit={10}
        showGameName
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />
    </div>
  )
}
