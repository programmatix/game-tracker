import { Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { User } from 'firebase/auth'
import type { BggPlay } from './bgg'
import {
  isGameMainTab,
  MAIN_TAB_GROUPS,
  PLAYS_VIEW_OPTIONS,
  isMainTab,
  type MainTabOption,
  type MainTab,
} from './appNav'
import type { PlaysDrilldownRequest } from './playsDrilldown'
import type { PlaysView as PlaysViewMode } from './appNav'
import type { PlaysByGameRow } from './playsHelpers'
import { isConfigurableGameId } from './configurableGames'
import { isGameTab } from './gameCatalog'
import FinalGirlView from './games/final-girl/FinalGirlView'
import DeathMayDieView from './games/death-may-die/DeathMayDieView'
import MistfallView from './games/mistfall/MistfallView'
import SpiritIslandView from './games/spirit-island/SpiritIslandView'
import BulletView from './games/bullet/BulletView'
import TooManyBonesView from './games/too-many-bones/TooManyBonesView'
import MageKnightView from './games/mage-knight/MageKnightView'
import UndauntedNormandyView from './games/undaunted-normandy/UndauntedNormandyView'
import UnsettledView from './games/unsettled/UnsettledView'
import SkytearHordeView from './games/skytear-horde/SkytearHordeView'
import CloudspireView from './games/cloudspire/CloudspireView'
import BurncycleView from './games/burncycle/BurncycleView'
import MandalorianAdventuresView from './games/mandalorian-adventures/MandalorianAdventuresView'
import PaleoView from './games/paleo/PaleoView'
import RobinsonCrusoeView from './games/robinson-crusoe/RobinsonCrusoeView'
import RobinHoodView from './games/robin-hood/RobinHoodView'
import EarthborneRangersView from './games/earthborne-rangers/EarthborneRangersView'
import ElderScrollsView from './games/elder-scrolls/ElderScrollsView'
import StarTrekCaptainsChairView from './games/star-trek-captains-chair/StarTrekCaptainsChairView'
import DeckersView from './games/deckers/DeckersView'
import OathswornView from './games/oathsworn/OathswornView'
import TaintedGrailView from './games/tainted-grail/TaintedGrailView'
import IsofarianGuardView from './games/isofarian-guard/IsofarianGuardView'
import ArkhamHorrorLcgView from './games/arkham-horror-lcg/ArkhamHorrorLcgView'
import KingdomsForlornView from './games/kingdoms-forlorn/KingdomsForlornView'
import NanolithView from './games/nanolith/NanolithView'
import LeviathanWildsView from './games/leviathan-wilds/LeviathanWildsView'
import AchievementsView from './AchievementsView'
import PinnedAchievementsView from './PinnedAchievementsView'
import CampaignsView from './CampaignsView'
import CostsView from './CostsView'
import TimeView from './TimeView'
import ReviewView from './ReviewView'
import FulfilmentView from './FulfilmentView'
import GameOptionsView from './GameOptionsView'
import OverallOptionsView from './OverallOptionsView'
import MonthlyChecklistView from './MonthlyChecklistView'
import MonthlySummaryView from './MonthlySummaryView'
import FeedbackView from './feedback/FeedbackView'
import FeedbackComposer from './feedback/FeedbackComposer'
import GameCostMini from './GameCostMini'
import GenericGameView from './GenericGameView'
import PlaysView, { PlaysPager } from './PlaysView'
import type { SpiritIslandSession } from './games/spirit-island/mindwanderer'
import type { GamePreferences, ResolvedGamePreferencesById } from './gamePreferences'

type SharedGameViewProps = {
  plays: BggPlay[]
  username: string
  authToken: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}

type AppContentProps = {
  mainTab: MainTab
  mainTabOptions: ReadonlyArray<MainTabOption>
  playsView: PlaysViewMode
  selectedOptionsGameId: string | null
  selectedMonthKey: string | null
  username: string
  authToken: string
  plays: BggPlay[]
  gamePreferencesById: ResolvedGamePreferencesById
  pinnedAchievementIds: ReadonlySet<string>
  pinnedAchievementsLoading: boolean
  suppressAvailableAchievementTrackIds: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenGameOptions: (gameId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
  onSelectOptionsGame: (gameId: string) => void
  onUpdateGamePreferences: (gameId: string, patch: Partial<GamePreferences>) => void
  onClearBggThingCache: () => number
  spiritIslandSessions: SpiritIslandSession[] | undefined
  spiritIslandSessionsLoading: boolean
  spiritIslandSessionsError: string | null
  assumedMinutesByObjectId: ReadonlyMap<string, number>
  costTimeEstimateStatus: {
    total: number
    complete: number
    assumed: number
    checkedWithoutEstimate: number
    failed: number
    inFlight: number
    queued: number
    pending: number
    active: boolean
  }
  feedbackUser: User | null
  isFeedbackAdmin: boolean
  page: number
  pageDraft: string
  currentTotalPages: number
  onPageDraftInput: (value: string) => void
  onGoToPage: (page: number) => void
  onClosePlaysDetail: () => void
  onSwitchPlaysView: (nextView: Extract<PlaysViewMode, 'plays' | 'byGame'>) => void
  onSwitchMainTab: (nextTab: MainTab) => void
  onOpenGame: (gameKey: string) => void
  onOpenMonthlyChecklist: (monthKey: string) => void
  onOpenPlayGame: (play: BggPlay) => void
  playsByGame: PlaysByGameRow[]
  thumbnailsByObjectId: ReadonlyMap<string, string>
  totalPlayCount: number
  pagedPlays: BggPlay[]
  selectedGameName?: string
  selectedGameMostRecentDate?: string
  selectedGamePlayCount: number
  selectedGamePagedPlays: BggPlay[]
  drilldownTitle?: string
  drilldownPlaysCount: number
  drilldownPagedPlays: BggPlay[]
  playTimeDisplay: (play: BggPlay) => string
}

function renderSharedGameView(tab: MainTab, props: SharedGameViewProps) {
  switch (tab) {
    case 'finalGirl':
      return <FinalGirlView {...props} />
    case 'skytearHorde':
      return <SkytearHordeView {...props} />
    case 'cloudspire':
      return <CloudspireView {...props} />
    case 'burncycle':
      return <BurncycleView {...props} />
    case 'paleo':
      return <PaleoView {...props} />
    case 'robinsonCrusoe':
      return <RobinsonCrusoeView {...props} />
    case 'robinHood':
      return <RobinHoodView {...props} />
    case 'earthborneRangers':
      return <EarthborneRangersView {...props} />
    case 'starTrekCaptainsChair':
      return <StarTrekCaptainsChairView {...props} />
    case 'unsettled':
      return <UnsettledView {...props} />
    case 'mistfall':
      return <MistfallView {...props} />
    case 'deathMayDie':
      return <DeathMayDieView {...props} />
    case 'bullet':
      return <BulletView {...props} />
    case 'tooManyBones':
      return <TooManyBonesView {...props} />
    case 'mageKnight':
      return <MageKnightView {...props} />
    case 'mandalorianAdventures':
      return <MandalorianAdventuresView {...props} />
    case 'deckers':
      return <DeckersView {...props} />
    case 'oathsworn':
      return <OathswornView {...props} />
    case 'taintedGrail':
      return <TaintedGrailView {...props} />
    case 'isofarianGuard':
      return <IsofarianGuardView {...props} />
    case 'arkhamHorrorLcg':
      return <ArkhamHorrorLcgView {...props} />
    case 'kingdomsForlorn':
      return <KingdomsForlornView {...props} />
    case 'nanolith':
      return <NanolithView {...props} />
    case 'leviathanWilds':
      return <LeviathanWildsView {...props} />
    case 'elderScrolls':
      return <ElderScrollsView {...props} />
    case 'undauntedNormandy':
      return <UndauntedNormandyView {...props} />
    default:
      return null
  }
}

export default function AppContent(props: AppContentProps) {
  const [isQuickFeedbackOpen, setIsQuickFeedbackOpen] = createSignal(false)
  const sharedGameViewProps: SharedGameViewProps = {
    get plays() {
      return props.plays
    },
    get username() {
      return props.username
    },
    get authToken() {
      return props.authToken
    },
    get pinnedAchievementIds() {
      return props.pinnedAchievementIds
    },
    get suppressAvailableAchievementTrackIds() {
      return props.suppressAvailableAchievementTrackIds
    },
    get onTogglePin() {
      return props.onTogglePin
    },
    get onOpenPlays() {
      return props.onOpenPlays
    },
  }

  const dedicatedGameView = createMemo(() => renderSharedGameView(props.mainTab, sharedGameViewProps))

  const genericGameId = createMemo(() => {
    if (!isGameMainTab(props.mainTab)) return null
    if (props.mainTab === 'spiritIsland') return null
    if (dedicatedGameView()) return null
    return isConfigurableGameId(props.mainTab) ? props.mainTab : null
  })

  createEffect(() => {
    if (!isQuickFeedbackOpen()) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsQuickFeedbackOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  return (
    <>
      <Show when={isQuickFeedbackOpen()}>
        <div
          class="feedbackModalBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsQuickFeedbackOpen(false)
            }
          }}
        >
          <div class="panel feedbackModal" role="dialog" aria-modal="true" aria-labelledby="quick-feedback-title">
            <FeedbackComposer
              user={props.feedbackUser}
              title="Add feedback"
              titleId="quick-feedback-title"
              submitLabel="Submit"
              autoFocus
              onCancel={() => setIsQuickFeedbackOpen(false)}
              onSubmitted={() => setIsQuickFeedbackOpen(false)}
            />
          </div>
        </div>
      </Show>

      <div class="panelHeader playsHeader">
        <div class="panelHeaderLeft">
          <h2 class="mobileOnly">Views</h2>
          <div class="tabSelectWrap mobileOnly">
            <label class="tabSelectLabel" for="main-tab-select">
              View
            </label>
            <select
              id="main-tab-select"
              class="tabSelect"
              value={props.mainTab}
              aria-label="Views"
              onChange={(e) => {
                const next = e.currentTarget.value
                if (!isMainTab(next)) return
                props.onSwitchMainTab(next)
              }}
            >
              {MAIN_TAB_GROUPS.map((group) => (
                <optgroup label={group.label}>
                  {props.mainTabOptions.filter((option) => option.group === group.id).map((option) => (
                    <option value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <Show when={props.mainTab === 'plays'}>
            <Show
              when={props.playsView === 'gameDetail' || props.playsView === 'drilldown'}
              fallback={
                <>
                  <div class="tabSelectWrap mobileOnly">
                    <label class="tabSelectLabel" for="plays-view-select">
                      Plays view
                    </label>
                    <select
                      id="plays-view-select"
                      class="tabSelect"
                      value={props.playsView === 'byGame' ? 'byGame' : 'plays'}
                      aria-label="Plays views"
                      onChange={(e) => {
                        const next = e.currentTarget.value
                        if (next !== 'plays' && next !== 'byGame') return
                        props.onSwitchPlaysView(next)
                      }}
                    >
                      {PLAYS_VIEW_OPTIONS.map((option) => (
                        <option value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div class="tabs desktopOnly" role="tablist" aria-label="Plays views">
                    <button
                      class="tabButton"
                      classList={{ tabButtonActive: props.playsView === 'plays' }}
                      onClick={() => props.onSwitchPlaysView('plays')}
                      type="button"
                      role="tab"
                      aria-selected={props.playsView === 'plays'}
                    >
                      All plays
                    </button>
                    <button
                      class="tabButton"
                      classList={{ tabButtonActive: props.playsView === 'byGame' }}
                      onClick={() => props.onSwitchPlaysView('byGame')}
                      type="button"
                      role="tab"
                      aria-selected={props.playsView === 'byGame'}
                    >
                      By game
                    </button>
                  </div>
                </>
              }
            >
              <div class="gameDetailHeader">
                <button class="linkButton" type="button" onClick={props.onClosePlaysDetail}>
                  ← Back
                </button>
                <div class="mono">
                  {props.playsView === 'drilldown'
                    ? props.drilldownTitle || 'Plays'
                    : props.selectedGameName || 'Game'}
                </div>
              </div>
            </Show>
          </Show>
        </div>

        <Show when={props.mainTab === 'plays' && props.playsView !== 'byGame'}>
          <PlaysPager
            page={props.page}
            pageDraft={props.pageDraft}
            currentTotalPages={props.currentTotalPages}
            onPageDraftInput={props.onPageDraftInput}
            onGoToPage={props.onGoToPage}
          />
        </Show>

        <Show when={isGameMainTab(props.mainTab)}>
          <button
            class="linkButton"
            type="button"
            onClick={() => props.onOpenGameOptions(props.mainTab)}
          >
            Game options
          </button>
        </Show>

        <Show when={props.mainTab !== 'feedback'}>
          <button
            class="linkButton"
            type="button"
            onClick={() => setIsQuickFeedbackOpen(true)}
          >
            Add feedback
          </button>
        </Show>
      </div>

      <Show when={props.mainTab === 'monthlyChecklist'}>
        <MonthlyChecklistView
          plays={props.plays}
          authToken={props.authToken}
          selectedMonthKey={props.selectedMonthKey}
          onOpenGame={(gameId) => {
            if (isGameTab(gameId)) {
              props.onSwitchMainTab(gameId)
              return
            }
            props.onOpenGameOptions(gameId)
          }}
          onOpenGameOptions={props.onOpenGameOptions}
        />
      </Show>

      <Show when={props.mainTab === 'monthlySummary'}>
        <MonthlySummaryView
          plays={props.plays}
          assumedMinutesByObjectId={props.assumedMinutesByObjectId}
          onOpenMonth={props.onOpenMonthlyChecklist}
        />
      </Show>

      <Show when={props.mainTab === 'fulfilment'}>
        <FulfilmentView
          gamePreferencesById={props.gamePreferencesById}
          onOpenGame={(gameId) => {
            if (isGameTab(gameId)) {
              props.onSwitchMainTab(gameId)
              return
            }
            props.onOpenGameOptions(gameId)
          }}
          onOpenGameOptions={props.onOpenGameOptions}
        />
      </Show>

      <Show when={props.mainTab === 'gameOptions'}>
        <GameOptionsView
          selectedGameId={props.selectedOptionsGameId}
          gamePreferencesById={props.gamePreferencesById}
          onSelectGame={props.onSelectOptionsGame}
          onUpdateGamePreferences={props.onUpdateGamePreferences}
        />
      </Show>

      <Show when={props.mainTab === 'options'}>
        <OverallOptionsView onClearBggThingCache={props.onClearBggThingCache} />
      </Show>

      <Show when={dedicatedGameView()}>
        {(view) => (
          <div class="gamePageInline">
            <div class="gameCostMiniSlot">
              <GameCostMini
                gameId={props.mainTab}
                plays={props.plays}
                assumedMinutesByObjectId={props.assumedMinutesByObjectId}
              />
            </div>
            {view()}
          </div>
        )}
      </Show>

      <Show when={genericGameId()}>
        {(gameId) => (
          <div class="gamePageInline">
            <div class="gameCostMiniSlot">
              <GameCostMini
                gameId={gameId()}
                plays={props.plays}
                assumedMinutesByObjectId={props.assumedMinutesByObjectId}
              />
            </div>
            <GenericGameView
              gameId={gameId()}
              plays={props.plays}
              username={props.username}
              onOpenPlays={props.onOpenPlays}
            />
          </div>
        )}
      </Show>

      <Show when={props.mainTab === 'spiritIsland'}>
        <div class="gamePageInline">
          <div class="gameCostMiniSlot">
            <GameCostMini
              gameId="spiritIsland"
              plays={props.plays}
              assumedMinutesByObjectId={props.assumedMinutesByObjectId}
            />
          </div>
          <SpiritIslandView
            plays={props.plays}
            username={props.username}
            authToken={props.authToken}
            spiritIslandSessions={props.spiritIslandSessions}
            spiritIslandSessionsLoading={props.spiritIslandSessionsLoading}
            spiritIslandSessionsError={props.spiritIslandSessionsError}
            pinnedAchievementIds={props.pinnedAchievementIds}
            suppressAvailableAchievementTrackIds={props.suppressAvailableAchievementTrackIds}
            onTogglePin={props.onTogglePin}
            onOpenPlays={props.onOpenPlays}
          />
        </div>
      </Show>

      <Show when={props.mainTab === 'achievements'}>
        <AchievementsView
          plays={props.plays}
          username={props.username}
          spiritIslandSessions={props.spiritIslandSessions}
          pinnedAchievementIds={props.pinnedAchievementIds}
          suppressAvailableAchievementTrackIds={props.suppressAvailableAchievementTrackIds}
          onTogglePin={props.onTogglePin}
          onOpenGame={props.onOpenGame}
        />
      </Show>

      <Show when={props.mainTab === 'pinned'}>
        <PinnedAchievementsView
          plays={props.plays}
          username={props.username}
          spiritIslandSessions={props.spiritIslandSessions}
          pinnedAchievementIds={props.pinnedAchievementIds}
          loading={props.pinnedAchievementsLoading}
          onTogglePin={props.onTogglePin}
          onOpenGame={props.onOpenGame}
        />
      </Show>

      <Show when={props.mainTab === 'campaigns'}>
        <CampaignsView
          plays={props.plays}
          username={props.username}
          assumedMinutesByObjectId={props.assumedMinutesByObjectId}
          onOpenGame={props.onOpenGame}
          onOpenGameOptions={props.onOpenGameOptions}
          onUpdateGamePreferences={props.onUpdateGamePreferences}
        />
      </Show>

      <Show when={props.mainTab === 'games'}>
        <ReviewView
          plays={props.plays}
          username={props.username}
          assumedMinutesByObjectId={props.assumedMinutesByObjectId}
          onOpenGame={props.onOpenGame}
          onOpenGameOptions={props.onOpenGameOptions}
          onUpdateGamePreferences={props.onUpdateGamePreferences}
          costTimeEstimateStatus={props.costTimeEstimateStatus}
        />
      </Show>

      <Show when={props.mainTab === 'costs'}>
        <CostsView
          plays={props.plays}
          assumedMinutesByObjectId={props.assumedMinutesByObjectId}
          onOpenGame={props.onOpenGame}
          onOpenGameOptions={props.onOpenGameOptions}
          onUpdateGamePreferences={props.onUpdateGamePreferences}
          costTimeEstimateStatus={props.costTimeEstimateStatus}
        />
      </Show>

      <Show when={props.mainTab === 'time'}>
        <TimeView
          plays={props.plays}
          assumedMinutesByObjectId={props.assumedMinutesByObjectId}
          onOpenGame={props.onOpenGame}
          onOpenGameOptions={props.onOpenGameOptions}
          onUpdateGamePreferences={props.onUpdateGamePreferences}
          costTimeEstimateStatus={props.costTimeEstimateStatus}
        />
      </Show>

      <Show when={props.mainTab === 'plays'}>
        <PlaysView
          username={props.username}
          playsView={props.playsView}
          bggAuthToken={props.authToken}
          totalPlayCount={props.totalPlayCount}
          pagedPlays={props.pagedPlays}
          playsByGame={props.playsByGame}
          thumbnailsByObjectId={props.thumbnailsByObjectId}
          drilldownTitle={props.drilldownTitle}
          drilldownPlaysCount={props.drilldownPlaysCount}
          drilldownPagedPlays={props.drilldownPagedPlays}
          selectedGameName={props.selectedGameName}
          selectedGameMostRecentDate={props.selectedGameMostRecentDate}
          selectedGamePlayCount={props.selectedGamePlayCount}
          selectedGamePagedPlays={props.selectedGamePagedPlays}
          playTimeDisplay={props.playTimeDisplay}
          onOpenGame={props.onOpenGame}
          onOpenGameOptions={props.onOpenGameOptions}
          onOpenPlayGame={props.onOpenPlayGame}
        />
      </Show>

      <Show when={props.mainTab === 'feedback'}>
        <FeedbackView user={props.feedbackUser} isAdmin={props.isFeedbackAdmin} />
      </Show>
    </>
  )
}
