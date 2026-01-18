import { createMemo } from 'solid-js'
import type { BggPlay } from './bgg'
import AchievementsPanel from './components/AchievementsPanel'
import { computeAllGameAchievementSummaries } from './achievements/games'

export default function AchievementsView(props: { plays: BggPlay[]; username: string }) {
  const achievements = createMemo(() => {
    const summaries = computeAllGameAchievementSummaries(props.plays, props.username)
    return summaries.flatMap((summary) => summary.achievements)
  })

  return (
    <div class="finalGirl">
      <AchievementsPanel
        title="Next 10 achievements (all games)"
        achievements={achievements()}
        nextLimit={10}
        showGameName
      />
    </div>
  )
}

