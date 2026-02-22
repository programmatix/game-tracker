import { Show, createMemo, createResource } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import CountTable from '../../components/CountTable'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import AchievementsPanel from '../../components/AchievementsPanel'
import GameThingThumb from '../../components/GameThingThumb'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { totalPlayMinutes } from '../../playDuration'
import { mageKnightContent } from './content'
import { getMageKnightEntries } from './mageKnightEntries'

const MAGE_KNIGHT_ULTIMATE_OBJECT_ID = '248562'

export default function MageKnightView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: MAGE_KNIGHT_ULTIMATE_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )

  const entries = createMemo(() => getMageKnightEntries(props.plays, props.username))
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('mageKnight', props.plays, props.username),
  )

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(
    () =>
      entries().reduce(
        (sum, entry) => sum + totalPlayMinutes(entry.play.attributes, entry.quantity) / 60,
        0,
      ),
  )

  const heroCountsAll = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      for (const hero of entry.heroes) incrementCount(counts, hero, entry.quantity)
    }
    return counts
  })

  const playIdsByHeroAll = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      for (const hero of entry.heroes) {
        ;(ids[hero] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const heroCountsMine = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myHero) continue
      incrementCount(counts, entry.myHero, entry.quantity)
    }
    return counts
  })

  const playIdsByHeroMine = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      if (!entry.myHero) continue
      ;(ids[entry.myHero] ||= []).push(entry.play.id)
    }
    return ids
  })

  const heroWinsMine = createMemo(() => {
    const wins: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myHero || !entry.isWin) continue
      incrementCount(wins, entry.myHero, entry.quantity)
    }
    return wins
  })

  const heroKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(heroCountsMine()), mageKnightContent.heroes),
  )

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      for (const hero of entry.heroes) {
        const box = mageKnightContent.heroBoxByName.get(hero)
        if (box) boxes.add(box)
      }
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })

  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      for (const hero of entry.heroes) {
        const box = mageKnightContent.heroBoxByName.get(hero)
        if (box) boxes.add(box)
      }
      const hours = totalPlayMinutes(entry.play.attributes, entry.quantity) / 60
      if (hours <= 0) continue
      for (const box of boxes) incrementCount(hoursByBox, box, hours)
    }
    return hoursByBox
  })

  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      for (const hero of entry.heroes) {
        const box = mageKnightContent.heroBoxByName.get(hero)
        if (box) boxes.add(box)
      }
      for (const box of boxes) {
        ;(ids[box] ||= []).push(entry.play.id)
      }
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...mageKnightContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours()[box] ?? 0,
      }))
      .sort((a, b) => {
        const byPlays = b.plays - a.plays
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () =>
      Boolean(mageKnightContent.costCurrencySymbol) &&
      mageKnightContent.boxCostsByName.size > 0,
  )

  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={MAGE_KNIGHT_ULTIMATE_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Mage Knight thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Mage Knight</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({ title: 'Mage Knight • All plays', playIds: allPlayIds() })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">Hero tracker: which heroes you have played.</div>
        </div>
      </div>

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Mage Knight plays found. In BG Stats, put your hero in the player{' '}
            <span class="mono">color</span> field like <span class="mono">Goldyx</span> or{' '}
            <span class="mono">H: Goldyx</span>.
          </div>
        }
      >
        <div class="statsGrid">
          <CountTable
            title="My heroes"
            plays={heroCountsMine()}
            wins={heroWinsMine()}
            keys={heroKeys()}
            getNextAchievement={(hero) =>
              pickBestAvailableAchievementForTrackIds(achievements(), [
                `heroPlays:${slugifyAchievementItemId(hero)}`,
                `heroWins:${slugifyAchievementItemId(hero)}`,
              ])
            }
            onPlaysClick={(hero) =>
              props.onOpenPlays({
                title: `Mage Knight • My hero: ${hero}`,
                playIds: playIdsByHeroMine()[hero] ?? [],
              })
            }
          />
          <CountTable
            title="All heroes"
            plays={heroCountsAll()}
            keys={heroKeys()}
            getNextAchievement={(hero) => getNextAchievement('heroPlays', hero)}
            onPlaysClick={(hero) =>
              props.onOpenPlays({
                title: `Mage Knight • Hero: ${hero}`,
                playIds: playIdsByHeroAll()[hero] ?? [],
              })
            }
          />
          <Show when={hasCostTable()}>
            <CostPerPlayTable
              title="Cost per box"
              rows={costRows()}
              currencySymbol={mageKnightContent.costCurrencySymbol}
              overallPlays={totalPlays()}
              overallHours={totalHours()}
              onPlaysClick={(box) =>
                props.onOpenPlays({
                  title: `Mage Knight • Box: ${box}`,
                  playIds: playIdsByBox()[box] ?? [],
                })
              }
            />
          </Show>
        </div>
      </Show>
    </div>
  )
}
