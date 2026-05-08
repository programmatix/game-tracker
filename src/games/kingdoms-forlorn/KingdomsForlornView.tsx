import { For, Show, createMemo, createResource, createSignal } from 'solid-js'
import type { BggPlay } from '../../bgg'
import { fetchThingSummary } from '../../bgg'
import AchievementsPanel from '../../components/AchievementsPanel'
import CostPerPlayTable from '../../components/CostPerPlayTable'
import CountTable from '../../components/CountTable'
import GameThingThumb from '../../components/GameThingThumb'
import HeatmapMatrix from '../../components/HeatmapMatrix'
import { computeGameAchievements } from '../../achievements/games'
import {
  pickBestAvailableAchievementForTrackIds,
  slugifyAchievementItemId,
} from '../../achievements/nextAchievement'
import { thingAssumedPlayTimeMinutes, totalPlayMinutesWithAssumption } from '../../playDuration'
import type { PlaysDrilldownRequest } from '../../playsDrilldown'
import { BGG_LINK_TOOLTIP, bggPlayUrl } from '../../playsHelpers'
import { incrementCount, mergeCanonicalKeys, sortKeysByCountDesc } from '../../stats'
import { formatPlayLength } from '../../formatPlayLength'
import { kingdomsForlornContent } from './content'
import { kingdomForlornExpeditionStepLabel, type KingdomsForlornExpeditionStep } from './kingdomsForlorn'
import { getKingdomsForlornEntries, KINGDOMS_FORLORN_OBJECT_ID } from './kingdomsForlornEntries'
import type { KingdomsForlornEntry } from './kingdomsForlornEntries'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function uniquePlayIds(values: readonly number[]): number[] {
  return [...new Set(values)]
}

function pairKey(left: string, right: string): string {
  return `${left.trim()}|||${right.trim()}`
}

const EXPEDITION_STEP_ORDER: KingdomsForlornExpeditionStep[] = ['D1', 'EC', 'D2', 'FC']
const UNKNOWN_MONSTER_TIER_KEY = 'Unknown'
const MONSTER_TIER_KEYS = ['1', '2', '3', '4', UNKNOWN_MONSTER_TIER_KEY]

type KingdomsForlornExpeditionSection = {
  key: string
  label: string
  summary: string
  kingdom: string
  quest?: string
  freeRoam: boolean
  myKnight?: string
  knights: string[]
  entries: KingdomsForlornEntry[]
}

type KingdomsForlornExpeditionDisplayItem =
  | { kind: 'expedition'; key: string; section: KingdomsForlornExpeditionSection }
  | { kind: 'unknown'; key: string; entry: KingdomsForlornEntry }

function expeditionStepSortValue(step: KingdomsForlornExpeditionStep): number {
  return EXPEDITION_STEP_ORDER.indexOf(step)
}

function entryPlayDate(entry: KingdomsForlornEntry): string {
  return entry.play.attributes.date || ''
}

function entryTimeSortKey(entry: KingdomsForlornEntry): string {
  return `${entryPlayDate(entry)}:${String(entry.play.id).padStart(12, '0')}`
}

function playerSummary(play: BggPlay): string {
  return play.players
    .map((player) => player.attributes.username || player.attributes.name || 'Unknown')
    .filter(Boolean)
    .join(', ')
}

function playLengthLabel(play: BggPlay): string {
  return formatPlayLength(play.attributes.length) || 'No length'
}

function isUnknownValue(value: string | undefined): boolean {
  if (!value) return true
  const normalized = value.trim().toLowerCase()
  return normalized === 'unknown' || normalized.startsWith('unknown ')
}

function hasKnownParty(entry: KingdomsForlornEntry): boolean {
  return entry.knights.some((knight) => !isUnknownValue(knight))
}

function requiresMonster(entry: KingdomsForlornEntry): boolean {
  return entry.expeditionStep === 'EC' || entry.expeditionStep === 'FC'
}

function forbidsMonster(entry: KingdomsForlornEntry): boolean {
  return entry.expeditionStep === 'D1' || entry.expeditionStep === 'D2'
}

function buildExpeditionLabel(index: number, entries: KingdomsForlornEntry[]): string {
  const first = entries[0]
  const last = entries[entries.length - 1]
  const knight = first?.myKnight || first?.campaign
  const dateRange =
    first && last && entryPlayDate(first) !== entryPlayDate(last)
      ? `${entryPlayDate(first)} to ${entryPlayDate(last)}`
      : entryPlayDate(first || last!)
  return [`Expedition ${index}`, knight, dateRange].filter(Boolean).join(' • ')
}

function sectionTimeSortKey(section: KingdomsForlornExpeditionSection): string {
  return section.entries.reduce((best, entry) => {
    const key = entryTimeSortKey(entry)
    return key > best ? key : best
  }, '')
}

function buildExpeditionSummary(entries: KingdomsForlornEntry[]): string {
  const stepNames = entries
    .map((entry) => entry.expeditionStep)
    .filter(Boolean)
    .map((step) => step!)
  const uniqueSteps = [...new Set(stepNames)]
  const playCount = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  const steps = uniqueSteps.length > 0 ? uniqueSteps.join(', ') : 'No expedition steps'
  const monsters = [
    ...new Set(
      entries
        .filter((entry) => entry.expeditionStep === 'EC' || entry.expeditionStep === 'FC')
        .map((entry) => entry.monster)
        .filter(Boolean) as string[],
    ),
  ]
  return [
    `${playCount.toLocaleString()} plays`,
    steps,
    monsters.length > 0 ? `Monsters: ${monsters.join(', ')}` : undefined,
  ]
    .filter(Boolean)
    .join(' • ')
}

function buildExpeditionMetadata(entries: KingdomsForlornEntry[]): {
  kingdom: string
  quest?: string
  freeRoam: boolean
  myKnight?: string
  knights: string[]
} {
  const anchor = entries.find((entry) => entry.expeditionStep === 'D1') || entries[0]
  const knownKnights = [
    ...new Set(
      (anchor?.knights || entries.flatMap((entry) => entry.knights))
        .map((knight) => knight.trim())
        .filter((knight) => !isUnknownValue(knight)),
    ),
  ]
  return {
    kingdom: anchor?.kingdom || 'Unknown kingdom',
    quest: anchor?.quest,
    freeRoam: !anchor?.quest && entries.some((entry) => entry.freeRoam),
    myKnight: anchor?.myKnight,
    knights: knownKnights,
  }
}

function groupKingdomsForlornExpeditions(entries: KingdomsForlornEntry[]): {
  sections: KingdomsForlornExpeditionSection[]
  unknownEntries: KingdomsForlornEntry[]
  displayItems: KingdomsForlornExpeditionDisplayItem[]
} {
  const sections: KingdomsForlornExpeditionSection[] = []
  const unknownEntries: KingdomsForlornEntry[] = []
  let current: KingdomsForlornEntry[] = []
  let previousStepSort = -1

  function closeCurrent() {
    if (current.length === 0) return
    const index = sections.length + 1
    const metadata = buildExpeditionMetadata(current)
    sections.push({
      key: `expedition-${index}-${current[0]!.play.id}`,
      label: buildExpeditionLabel(index, current),
      summary: buildExpeditionSummary(current),
      kingdom: metadata.kingdom,
      quest: metadata.quest,
      freeRoam: metadata.freeRoam,
      myKnight: metadata.myKnight,
      knights: metadata.knights,
      entries: current,
    })
    current = []
    previousStepSort = -1
  }

  for (const entry of entries) {
    const step = entry.expeditionStep
    if (!step) {
      unknownEntries.push(entry)
      continue
    }

    const stepSort = expeditionStepSortValue(step)
    const startsNewExpedition =
      current.length > 0 &&
      ((step === 'D1' && previousStepSort !== expeditionStepSortValue('D1')) ||
        (step !== 'D1' && stepSort <= previousStepSort))
    if (startsNewExpedition) closeCurrent()
    current.push(entry)
    previousStepSort = stepSort
  }

  closeCurrent()

  const displayItems: KingdomsForlornExpeditionDisplayItem[] = [
    ...sections.map((section) => ({ kind: 'expedition' as const, key: section.key, section })),
    ...unknownEntries.map((entry) => ({
      kind: 'unknown' as const,
      key: `unknown-${entry.play.id}`,
      entry,
    })),
  ].sort((a, b) => {
    const aKey = a.kind === 'expedition' ? sectionTimeSortKey(a.section) : entryTimeSortKey(a.entry)
    const bKey = b.kind === 'expedition' ? sectionTimeSortKey(b.section) : entryTimeSortKey(b.entry)
    return bKey.localeCompare(aKey)
  })

  return { sections, unknownEntries, displayItems }
}

function KingdomsForlornExtractedBadge(props: {
  label: string
  value: string
  tone?: 'normal' | 'missing' | 'unknown'
}) {
  return (
    <span
      class="kfExtractedBadge"
      classList={{
        kfExtractedBadgeMissing: props.tone === 'missing',
        kfExtractedBadgeUnknown: props.tone === 'unknown',
      }}
    >
      <span class="kfExtractedBadgeLabel">{props.label}</span>
      <span>{props.value}</span>
    </span>
  )
}

function KingdomsForlornPlayBadges(props: {
  entry: KingdomsForlornEntry
  showExpeditionDetails?: boolean
}) {
  const entry = () => props.entry
  const showExpeditionDetails = () => props.showExpeditionDetails !== false
  return (
    <div class="kfExtractedBadges">
      <Show
        when={entry().expeditionStep}
        fallback={<KingdomsForlornExtractedBadge label="Step" value="Missing" tone="missing" />}
      >
        {(step) => (
          <KingdomsForlornExtractedBadge
            label="Step"
            value={`${step()} ${kingdomForlornExpeditionStepLabel(step())}`}
          />
        )}
      </Show>

      <Show when={showExpeditionDetails()}>
        <Show
          when={!isUnknownValue(entry().kingdom)}
          fallback={<KingdomsForlornExtractedBadge label="Kingdom" value={entry().kingdom} tone="unknown" />}
        >
          <KingdomsForlornExtractedBadge label="Kingdom" value={entry().kingdom} />
        </Show>

        <Show when={entry().freeRoam} fallback={
          <Show
            when={entry().quest}
            fallback={<KingdomsForlornExtractedBadge label="Quest" value="Missing" tone="missing" />}
          >
            {(quest) => <KingdomsForlornExtractedBadge label="Quest" value={quest()} />}
          </Show>
        }>
          <KingdomsForlornExtractedBadge label="Quest" value="Free roam" />
        </Show>

        <Show
          when={hasKnownParty(entry())}
          fallback={<KingdomsForlornExtractedBadge label="Party" value="Unknown" tone="unknown" />}
        >
          <KingdomsForlornExtractedBadge
            label="Party"
            value={entry()
              .knights.filter((knight) => !isUnknownValue(knight))
              .join(', ')}
          />
        </Show>
      </Show>

      <Show
        when={entry().monster}
        fallback={
          <Show when={requiresMonster(entry())}>
            <KingdomsForlornExtractedBadge label="Monster" value="Missing" tone="missing" />
          </Show>
        }
      >
        {(monster) => (
          <KingdomsForlornExtractedBadge
            label="Monster"
            value={monster()}
            tone={forbidsMonster(entry()) ? 'unknown' : 'normal'}
          />
        )}
      </Show>

      <Show
        when={entry().monsterTier}
        fallback={
          <Show when={requiresMonster(entry())}>
            <KingdomsForlornExtractedBadge label="Monster tier" value="Missing" tone="missing" />
          </Show>
        }
      >
        {(monsterTier) => (
          <KingdomsForlornExtractedBadge
            label="Monster tier"
            value={`Tier ${monsterTier()}`}
            tone={forbidsMonster(entry()) ? 'unknown' : 'normal'}
          />
        )}
      </Show>

      {/* <KingdomsForlornExtractedBadge label="Result" value={entry().isWin ? 'Win' : 'Loss'} /> */}

      <Show when={entry().continuedFromPrevious || entry().continuedToNext}>
        <KingdomsForlornExtractedBadge
          label="Continues"
          value={[
            entry().continuedFromPrevious ? 'from previous' : undefined,
            entry().continuedToNext ? 'to next' : undefined,
          ]
            .filter(Boolean)
            .join(', ')}
        />
      </Show>

      <For each={entry().unknownTags}>
        {(tag) => <KingdomsForlornExtractedBadge label="Raw tag" value={tag} tone="unknown" />}
      </For>
    </div>
  )
}

function KingdomsForlornExpeditionBadges(props: { section: KingdomsForlornExpeditionSection }) {
  const section = () => props.section
  return (
    <div class="kfExtractedBadges">
      <Show
        when={!isUnknownValue(section().kingdom)}
        fallback={<KingdomsForlornExtractedBadge label="Kingdom" value={section().kingdom} tone="unknown" />}
      >
        <KingdomsForlornExtractedBadge label="Kingdom" value={section().kingdom} />
      </Show>

      <Show when={section().freeRoam} fallback={
        <Show
          when={section().quest}
          fallback={<KingdomsForlornExtractedBadge label="Quest" value="Missing" tone="missing" />}
        >
          {(quest) => <KingdomsForlornExtractedBadge label="Quest" value={quest()} />}
        </Show>
      }>
        <KingdomsForlornExtractedBadge label="Quest" value="Free roam" />
      </Show>

      <Show
        when={section().knights.length > 0}
        fallback={<KingdomsForlornExtractedBadge label="Party" value="Unknown" tone="unknown" />}
      >
        <KingdomsForlornExtractedBadge label="Party" value={section().knights.join(', ')} />
      </Show>
    </div>
  )
}

function KingdomsForlornAllPlaysList(props: {
  entries: KingdomsForlornEntry[]
  showExpeditionDetails?: boolean
}) {
  return (
    <div class="kfAllPlaysList">
      <For each={props.entries}>
        {(entry) => (
          <div class="kfAllPlayRow">
            <div class="kfAllPlayMeta">
              <a
                class="mono"
                href={bggPlayUrl(entry.play.id)}
                target="_blank"
                rel="noreferrer"
                title={BGG_LINK_TOOLTIP}
              >
                #{entry.play.id}
              </a>
              <span class="mono">{entry.play.attributes.date || 'No date'}</span>
              <span class="mono">{playLengthLabel(entry.play)}</span>
              <span>{playerSummary(entry.play)}</span>
            </div>
            <KingdomsForlornPlayBadges
              entry={entry}
              showExpeditionDetails={props.showExpeditionDetails}
            />
          </div>
        )}
      </For>
    </div>
  )
}

function KingdomsForlornExpeditionsView(props: {
  groups: ReturnType<typeof groupKingdomsForlornExpeditions>
  onBack: () => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  return (
    <div class="finalGirl">
      <div class="statsBlock kfAllPlaysView">
        <div class="statsTitleRow">
          <h3 class="statsTitle">Kingdoms Forlorn Expeditions</h3>
          <button class="linkButton" type="button" onClick={props.onBack}>
            Back to overview
          </button>
        </div>
        <div class="muted">
          Expeditions are sorted newest first. Unknown plays are interspersed by date so nearby tagged plays
          are easier to compare. Red badges show unknown, missing, or unparsed raw tags.
        </div>

        <For each={props.groups.displayItems}>
          {(item) =>
            item.kind === 'expedition' ? (
              <div class="kfExpeditionGroup">
                <div class="statsTitleRow">
                  <h4 class="statsTitle">{item.section.label}</h4>
                  <button
                    class="linkButton"
                    type="button"
                    onClick={() =>
                      props.onOpenPlays({
                        title: `Kingdoms Forlorn • ${item.section.label}`,
                        playIds: uniquePlayIds(item.section.entries.map((entry) => entry.play.id)),
                      })
                    }
                  >
                    Open plays
                  </button>
                </div>
                <div class="muted">{item.section.summary}</div>
                <KingdomsForlornExpeditionBadges section={item.section} />
                <KingdomsForlornAllPlaysList
                  entries={item.section.entries.slice().reverse()}
                  showExpeditionDetails={false}
                />
              </div>
            ) : (
              <div class="kfExpeditionGroup kfExpeditionGroupUnknown">
                <div class="statsTitleRow">
                  <h4 class="statsTitle">Unknown Expedition</h4>
                  <button
                    class="linkButton"
                    type="button"
                    onClick={() =>
                      props.onOpenPlays({
                        title: 'Kingdoms Forlorn • Unknown expedition play',
                        playIds: [item.entry.play.id],
                      })
                    }
                  >
                    Open play
                  </button>
                </div>
                <div class="muted">
                  This play has no parsed <span class="mono">D1</span>, <span class="mono">EC</span>,{' '}
                  <span class="mono">D2</span>, or <span class="mono">FC</span> tag.
                </div>
                <KingdomsForlornAllPlaysList entries={[item.entry]} />
              </div>
            )
          }
        </For>
      </div>
    </div>
  )
}

export default function KingdomsForlornView(props: {
  plays: BggPlay[]
  username: string
  authToken?: string
  pinnedAchievementIds: ReadonlySet<string>
  suppressAvailableAchievementTrackIds?: ReadonlySet<string>
  onTogglePin: (achievementId: string) => void
  onOpenPlays: (request: PlaysDrilldownRequest) => void
}) {
  const [thing] = createResource(
    () => ({ id: KINGDOMS_FORLORN_OBJECT_ID, authToken: props.authToken?.trim() || '' }),
    ({ id, authToken }) => fetchThingSummary(id, authToken ? { authToken } : undefined),
  )
  const [matrixDisplayMode, setMatrixDisplayMode] = createSignal<'played' | 'count'>('played')
  const [showExpeditionsView, setShowExpeditionsView] = createSignal(false)

  const entries = createMemo(() => getKingdomsForlornEntries(props.plays, props.username))
  const expeditionGroups = createMemo(() => groupKingdomsForlornExpeditions(entries()))
  const expeditionCount = createMemo(() => expeditionGroups().sections.length)
  const allPlayIds = createMemo(() => [...new Set(entries().map((entry) => entry.play.id))])
  const achievements = createMemo(() =>
    computeGameAchievements('kingdomsForlorn', props.plays, props.username),
  )
  const assumedMinutesPerPlay = createMemo(() => thingAssumedPlayTimeMinutes(thing()?.raw) ?? undefined)

  const totalPlays = createMemo(() => entries().reduce((sum, entry) => sum + entry.quantity, 0))
  const totalHours = createMemo(() =>
    entries().reduce((sum, entry) => {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      return sum + resolved.minutes / 60
    }, 0),
  )
  const totalHoursHasAssumed = createMemo(() => {
    for (const entry of entries()) {
      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      if (resolved.assumed) return true
    }
    return false
  })
  const averageHoursPerPlay = createMemo(() => {
    const plays = totalPlays()
    if (plays <= 0) return undefined
    const hours = totalHours()
    if (hours <= 0) return undefined
    return hours / plays
  })

  const kingdomCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) incrementCount(counts, entry.kingdom, entry.quantity)
    return counts
  })
  const kingdomWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      incrementCount(counts, entry.kingdom, entry.quantity)
    }
    return counts
  })
  const playIdsByKingdom = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const key = normalizeLabel(entry.kingdom)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const myKnightCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myKnight) continue
      incrementCount(counts, entry.myKnight, entry.quantity)
    }
    return counts
  })
  const myKnightWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.myKnight || !entry.isWin) continue
      incrementCount(counts, entry.myKnight, entry.quantity)
    }
    return counts
  })
  const playIdsByKnight = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      if (!entry.myKnight) continue
      const key = normalizeLabel(entry.myKnight)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const stepCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const campaign = entry.campaign
      const step = kingdomsForlornContent.quests.length > 0 ? entry.quest || '' : entry.kingdom
      if (!campaign || !step) continue
      incrementCount(counts, pairKey(campaign, step), entry.quantity)
    }
    return counts
  })
  const stepWins = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.isWin) continue
      const campaign = entry.campaign
      const step = kingdomsForlornContent.quests.length > 0 ? entry.quest || '' : entry.kingdom
      if (!campaign || !step) continue
      incrementCount(counts, pairKey(campaign, step), entry.quantity)
    }
    return counts
  })
  const playIdsByCampaignStep = createMemo(() => {
    const ids = new Map<string, number[]>()
    for (const entry of entries()) {
      const campaign = entry.campaign
      const step = kingdomsForlornContent.quests.length > 0 ? entry.quest || '' : entry.kingdom
      if (!campaign || !step) continue
      const key = pairKey(campaign, step)
      const existing = ids.get(key)
      if (existing) existing.push(entry.play.id)
      else ids.set(key, [entry.play.id])
    }
    return ids
  })

  const continuationCount = createMemo(() =>
    entries().reduce(
      (sum, entry) => sum + (entry.continuedFromPrevious || entry.continuedToNext ? entry.quantity : 0),
      0,
    ),
  )
  const missingMonsterTierCount = createMemo(() =>
    entries().reduce(
      (sum, entry) => sum + (requiresMonster(entry) && entry.monsterTier === undefined ? entry.quantity : 0),
      0,
    ),
  )
  const taggedPlays = createMemo(() =>
    entries().reduce(
      (sum, entry) =>
        sum + (entry.campaign === 'Unknown campaign' && !entry.quest && !entry.freeRoam ? 0 : entry.quantity),
      0,
    ),
  )
  const untaggedPlays = createMemo(() => totalPlays() - taggedPlays())

  const boxPlayCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const kingdomBox = kingdomsForlornContent.kingdomBoxByName.get(entry.kingdom)
      if (kingdomBox) boxes.add(kingdomBox)
      for (const knight of entry.knights) {
        const knightBox = kingdomsForlornContent.knightBoxByName.get(knight)
        if (knightBox) boxes.add(knightBox)
      }
      if (entry.monster) {
        const monsterBox = kingdomsForlornContent.monsterBoxByName.get(entry.monster)
        if (monsterBox) boxes.add(monsterBox)
      }
      for (const box of boxes) incrementCount(counts, box, entry.quantity)
    }
    return counts
  })
  const boxPlayHours = createMemo(() => {
    const hoursByBox: Record<string, number> = {}
    const hasAssumedHoursByBox: Record<string, boolean> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const kingdomBox = kingdomsForlornContent.kingdomBoxByName.get(entry.kingdom)
      if (kingdomBox) boxes.add(kingdomBox)
      for (const knight of entry.knights) {
        const knightBox = kingdomsForlornContent.knightBoxByName.get(knight)
        if (knightBox) boxes.add(knightBox)
      }
      if (entry.monster) {
        const monsterBox = kingdomsForlornContent.monsterBoxByName.get(entry.monster)
        if (monsterBox) boxes.add(monsterBox)
      }

      const resolved = totalPlayMinutesWithAssumption({
        attributes: entry.play.attributes,
        quantity: entry.quantity,
        assumedMinutesPerPlay: assumedMinutesPerPlay(),
      })
      const hours = resolved.minutes / 60
      if (hours <= 0) continue
      for (const box of boxes) incrementCount(hoursByBox, box, hours)
      if (resolved.assumed) {
        for (const box of boxes) hasAssumedHoursByBox[box] = true
      }
    }
    return { hoursByBox, hasAssumedHoursByBox }
  })
  const playIdsByBox = createMemo(() => {
    const ids: Record<string, number[]> = {}
    for (const entry of entries()) {
      const boxes = new Set<string>()
      const kingdomBox = kingdomsForlornContent.kingdomBoxByName.get(entry.kingdom)
      if (kingdomBox) boxes.add(kingdomBox)
      for (const knight of entry.knights) {
        const knightBox = kingdomsForlornContent.knightBoxByName.get(knight)
        if (knightBox) boxes.add(knightBox)
      }
      if (entry.monster) {
        const monsterBox = kingdomsForlornContent.monsterBoxByName.get(entry.monster)
        if (monsterBox) boxes.add(monsterBox)
      }
      for (const box of boxes) (ids[box] ||= []).push(entry.play.id)
    }
    return ids
  })

  const costRows = createMemo(() =>
    [...kingdomsForlornContent.boxCostsByName.entries()]
      .map(([box, cost]) => ({
        box,
        cost,
        plays: boxPlayCounts()[box] ?? 0,
        hoursPlayed: boxPlayHours().hoursByBox[box] ?? 0,
        hasAssumedHours: boxPlayHours().hasAssumedHoursByBox[box] === true,
      }))
      .sort((a, b) => {
        const byPlays = b.plays - a.plays
        if (byPlays !== 0) return byPlays
        return a.box.localeCompare(b.box)
      }),
  )

  const hasCostTable = createMemo(
    () => Boolean(kingdomsForlornContent.costCurrencySymbol) && kingdomsForlornContent.boxCostsByName.size > 0,
  )
  const kingdomKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(kingdomCounts()), kingdomsForlornContent.kingdoms),
  )
  const knightKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(myKnightCounts()), kingdomsForlornContent.knights),
  )
  const questKeys = createMemo(() =>
    kingdomsForlornContent.quests.length > 0 ? kingdomsForlornContent.quests : sortKeysByCountDesc(stepCounts()),
  )
  const monsterCounts = createMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries()) {
      if (!entry.monster) continue
      incrementCount(counts, entry.monster, entry.quantity)
    }
    return counts
  })
  const monsterKeys = createMemo(() =>
    mergeCanonicalKeys(sortKeysByCountDesc(monsterCounts()), kingdomsForlornContent.monsters),
  )
  const campaignQuestMatrixMax = createMemo(() => {
    let max = 0
    for (const campaign of knightKeys()) {
      for (const quest of questKeys()) {
        max = Math.max(max, stepCounts()[pairKey(campaign, quest)] ?? 0)
      }
    }
    return max
  })
  const monsterTierMatrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    const wins: Record<string, Record<string, number>> = {}
    const playIds = new Map<string, number[]>()

    for (const entry of entries()) {
      if (!entry.monster) continue
      const tier = entry.monsterTier === undefined ? UNKNOWN_MONSTER_TIER_KEY : String(entry.monsterTier)
      if (!MONSTER_TIER_KEYS.includes(tier)) continue
      ;(counts[entry.monster] ||= {})
      incrementCount(counts[entry.monster]!, tier, entry.quantity)
      if (entry.isWin) {
        ;(wins[entry.monster] ||= {})
        incrementCount(wins[entry.monster]!, tier, entry.quantity)
      }
      const key = pairKey(entry.monster, tier)
      const existing = playIds.get(key)
      if (existing) existing.push(entry.play.id)
      else playIds.set(key, [entry.play.id])
    }

    return { counts, wins, playIds }
  })
  const monsterTierMatrixMax = createMemo(() => {
    let max = 0
    for (const row of Object.values(monsterTierMatrix().counts)) {
      for (const count of Object.values(row)) max = Math.max(max, count)
    }
    return max
  })
  const pairMatrix = createMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    const wins: Record<string, Record<string, number>> = {}
    const playIds = new Map<string, number[]>()

    for (const entry of entries()) {
      if (!entry.kingdom || !entry.myKnight) continue
      ;(counts[entry.kingdom] ||= {})
      incrementCount(counts[entry.kingdom]!, entry.myKnight, entry.quantity)
      if (entry.isWin) {
        ;(wins[entry.kingdom] ||= {})
        incrementCount(wins[entry.kingdom]!, entry.myKnight, entry.quantity)
      }
      const key = pairKey(entry.kingdom, entry.myKnight)
      const existing = playIds.get(key)
      if (existing) existing.push(entry.play.id)
      else playIds.set(key, [entry.play.id])
    }

    return { counts, wins, playIds }
  })
  const pairMatrixMax = createMemo(() => {
    let max = 0
    for (const row of Object.values(pairMatrix().counts)) {
      for (const count of Object.values(row)) {
        if (count > max) max = count
      }
    }
    return max
  })
  function getNextAchievement(trackIdPrefix: string, label: string) {
    const id = slugifyAchievementItemId(label)
    return pickBestAvailableAchievementForTrackIds(achievements(), [`${trackIdPrefix}:${id}`])
  }

  return (
    <Show
      when={showExpeditionsView()}
      fallback={
        <div class="finalGirl">
      <div class="finalGirlMetaRow">
        <GameThingThumb
          objectId={KINGDOMS_FORLORN_OBJECT_ID}
          image={thing()?.image}
          thumbnail={thing()?.thumbnail}
          alt="Kingdoms Forlorn thumbnail"
        />

        <div class="finalGirlMeta">
          <div class="metaTitleRow">
            <div class="metaTitle">Kingdoms Forlorn</div>
            <div class="metaPlays">
              Plays: <span class="mono">{totalPlays().toLocaleString()}</span>
            </div>
            <button
              class="linkButton"
              type="button"
              disabled={entries().length === 0}
              onClick={() => setShowExpeditionsView(true)}
            >
              View expeditions
            </button>
            <button
              class="linkButton"
              type="button"
              disabled={allPlayIds().length === 0}
              onClick={() =>
                props.onOpenPlays({
                  title: 'Kingdoms Forlorn • All plays',
                  playIds: allPlayIds(),
                })
              }
            >
              View all plays
            </button>
          </div>
          <div class="muted">
            Treat each knight as its own campaign. Use BG Stats tags like <span class="mono">K: Kara／Q: 1</span> or{' '}
            <span class="mono">Knight: Sonch／Quest: 3／Kingdom: Sunken</span>.{' '}
            <span class="mono">ContPrev</span> and <span class="mono">ContNext</span> still inherit missing tags.
          </div>
        </div>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <div class="muted">
            No Kingdoms Forlorn plays found. In BG Stats, use player <span class="mono">color</span> like{' '}
            <span class="mono">Kara／Q1</span> or <span class="mono">Knight: Sonch／Kingdom: Sunken</span>.
          </div>
        }
      >
        <div class="finalGirlMetaRow">
          <div class="meta">
            <div class="metaLabel">Total hours</div>
            <div class="metaValue mono">
              {totalHours().toLocaleString(undefined, { maximumFractionDigits: 1 })}
              {totalHoursHasAssumed() ? '*' : ''}
            </div>
          </div>
          <div class="meta">
            <div class="metaLabel">Avg hours / play</div>
            <div class="metaValue mono">
              <Show when={averageHoursPerPlay() !== undefined} fallback="—">
                {averageHoursPerPlay()!.toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                {totalHoursHasAssumed() ? '*' : ''}
              </Show>
            </div>
          </div>
          <div class="meta">
            <div class="metaLabel">Expeditions</div>
            <div class="metaValue mono">{expeditionCount().toLocaleString()}</div>
          </div>
          <div class="meta">
            <div class="metaLabel">Tagged plays</div>
            <div class="metaValue mono">{taggedPlays().toLocaleString()}</div>
          </div>
          <div class="meta">
            <div class="metaLabel">Untagged plays</div>
            <div class="metaValue mono">{untaggedPlays().toLocaleString()}</div>
          </div>
          <div class="meta">
            <div class="metaLabel">Continuations</div>
            <div class="metaValue mono">{continuationCount().toLocaleString()}</div>
          </div>
          <div class="meta">
            <div class="metaLabel">Missing monster tiers</div>
            <div class="metaValue mono">{missingMonsterTierCount().toLocaleString()}</div>
          </div>
        </div>

        <Show when={totalHoursHasAssumed()}>
          <div class="muted">
            <span class="mono">*</span> Estimated time from BGG game data (playing time) when a play has no recorded length.
          </div>
        </Show>

        <Show when={kingdomsForlornContent.quests.length > 0}>
          <div class="statsBlock">
            <h3 class="statsTitle">Knight Campaign Progress</h3>
            <HeatmapMatrix
              rows={knightKeys()}
              cols={questKeys()}
              rowHeader="Character"
              colHeader="Quest"
              maxCount={campaignQuestMatrixMax()}
              hideCounts
              getCount={(knight, quest) => stepCounts()[pairKey(knight, quest)] ?? 0}
              getWinCount={(knight, quest) => stepWins()[pairKey(knight, quest)] ?? 0}
              getColLabel={(quest) => quest.replace(/^Quest\s+/i, '')}
              getCellDisplayText={(knight, quest, count) => {
                if (count === 0) return '—'
                const wins = stepWins()[pairKey(knight, quest)] ?? 0
                return wins > 0 ? '✓' : '✗'
              }}
              getCellLabel={(knight, quest, count) => {
                const wins = stepWins()[pairKey(knight, quest)] ?? 0
                if (count === 0) return `${knight} × ${quest}: unplayed`
                return `${knight} × ${quest}: ${count} plays, ${wins} wins`
              }}
              rowGroupBy={(knight) => kingdomsForlornContent.knightGroupByName.get(knight)}
              onCellClick={(knight, quest) => {
                const key = pairKey(knight, quest)
                const playIds = uniquePlayIds(playIdsByCampaignStep().get(key) ?? [])
                if (playIds.length === 0) return
                props.onOpenPlays({
                  title: `Kingdoms Forlorn • ${knight} • ${quest}`,
                  playIds,
                })
              }}
            />
          </div>
        </Show>

        <Show when={hasCostTable()}>
          <CostPerPlayTable
            rows={costRows()}
            currencySymbol={kingdomsForlornContent.costCurrencySymbol}
            overallPlays={totalPlays()}
            overallHours={totalHours()}
            overallHoursHasAssumed={totalHoursHasAssumed()}
            averageHoursPerPlay={averageHoursPerPlay()}
            title="Cost Per Play"
            onPlaysClick={(box) => {
              const playIds = uniquePlayIds(playIdsByBox()[box] ?? [])
              if (playIds.length === 0) return
              props.onOpenPlays({ title: `Kingdoms Forlorn • ${box}`, playIds })
            }}
          />
        </Show>

        <Show when={monsterKeys().length > 0}>
          <div class="statsBlock">
            <h3 class="statsTitle">Monster Fights</h3>
            <HeatmapMatrix
              rows={monsterKeys()}
              cols={MONSTER_TIER_KEYS}
              rowHeader="Monster"
              colHeader="Tier"
              maxCount={monsterTierMatrixMax()}
              hideCounts
              getCount={(monster, tier) => monsterTierMatrix().counts[monster]?.[tier] ?? 0}
              getWinCount={(monster, tier) => monsterTierMatrix().wins[monster]?.[tier] ?? 0}
              getColLabel={(tier) => (tier === UNKNOWN_MONSTER_TIER_KEY ? '?' : tier)}
              getCellDisplayText={(monster, tier, count) => {
                if (count === 0) return '—'
                const wins = monsterTierMatrix().wins[monster]?.[tier] ?? 0
                return wins > 0 ? '✓' : '✗'
              }}
              getCellLabel={(monster, tier, count) => {
                const wins = monsterTierMatrix().wins[monster]?.[tier] ?? 0
                const tierLabel = tier === UNKNOWN_MONSTER_TIER_KEY ? 'unknown tier' : `tier ${tier}`
                if (count === 0) return `${monster} ${tierLabel}: unplayed`
                return `${monster} ${tierLabel}: ${count} fights, ${wins} wins`
              }}
              rowGroupBy={(monster) => kingdomsForlornContent.monsterGroupByName.get(monster)}
              onCellClick={(monster, tier) => {
                const playIds = uniquePlayIds(monsterTierMatrix().playIds.get(pairKey(monster, tier)) ?? [])
                if (playIds.length === 0) return
                props.onOpenPlays({
                  title: `Kingdoms Forlorn • ${monster} • ${
                    tier === UNKNOWN_MONSTER_TIER_KEY ? 'Unknown tier' : `Tier ${tier}`
                  }`,
                  playIds,
                })
              }}
            />
          </div>
        </Show>

        <CountTable
          title="Kingdoms"
          plays={kingdomCounts()}
          wins={kingdomWins()}
          keys={kingdomKeys()}
          groupBy={(kingdom) => kingdomsForlornContent.kingdomGroupByName.get(kingdom)}
          getNextAchievement={(kingdom) => getNextAchievement('kingdomPlays', kingdom)}
          onPlaysClick={(kingdom) => {
            const playIds = playIdsByKingdom().get(normalizeLabel(kingdom)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({ title: `Kingdoms Forlorn • ${kingdom}`, playIds })
          }}
        />

        <CountTable
          title="My Knights"
          plays={myKnightCounts()}
          wins={myKnightWins()}
          keys={knightKeys()}
          groupBy={(knight) => kingdomsForlornContent.knightGroupByName.get(knight)}
          getNextAchievement={(knight) => getNextAchievement('knightPlays', knight)}
          onPlaysClick={(knight) => {
            const playIds = playIdsByKnight().get(normalizeLabel(knight)) ?? []
            if (playIds.length === 0) return
            props.onOpenPlays({ title: `Kingdoms Forlorn • ${knight}`, playIds })
          }}
        />

        <div class="statsBlock">
          <div class="statsTitleRow">
            <h3 class="statsTitle">Kingdom × Knight</h3>
            <div class="tabs">
              <button
                type="button"
                class="tabButton"
                classList={{ tabButtonActive: matrixDisplayMode() === 'played' }}
                onClick={() => setMatrixDisplayMode('played')}
              >
                Played/Unplayed
              </button>
              <button
                type="button"
                class="tabButton"
                classList={{ tabButtonActive: matrixDisplayMode() === 'count' }}
                onClick={() => setMatrixDisplayMode('count')}
              >
                Play counts
              </button>
            </div>
          </div>
          <div class="muted">Which knight you brought into each kingdom, with drilldown to the matching plays.</div>
          <HeatmapMatrix
            rows={kingdomsForlornContent.kingdoms}
            cols={kingdomsForlornContent.knights}
            rowHeader="Kingdom"
            colHeader="Knight"
            maxCount={pairMatrixMax()}
            hideCounts={matrixDisplayMode() === 'played'}
            getCount={(kingdom, knight) => pairMatrix().counts[kingdom]?.[knight] ?? 0}
            getWinCount={(kingdom, knight) => pairMatrix().wins[kingdom]?.[knight] ?? 0}
            getCellDisplayText={(kingdom, knight, count) => {
              if (matrixDisplayMode() === 'count') return count === 0 ? '—' : String(count)
              const wins = pairMatrix().wins[kingdom]?.[knight] ?? 0
              if (count === 0) return '—'
              if (wins <= 0) return '✗'
              return '✓'
            }}
            getCellLabel={(kingdom, knight, count) => {
              const wins = pairMatrix().wins[kingdom]?.[knight] ?? 0
              if (count === 0) return `${kingdom} × ${knight}: unplayed`
              return `${kingdom} × ${knight}: ${count} plays, ${wins} wins`
            }}
            rowGroupBy={(kingdom) => kingdomsForlornContent.kingdomGroupByName.get(kingdom)}
            colGroupBy={(knight) => kingdomsForlornContent.knightGroupByName.get(knight)}
            onCellClick={(kingdom, knight) => {
              const playIds = pairMatrix().playIds.get(pairKey(kingdom, knight)) ?? []
              if (playIds.length === 0) return
              props.onOpenPlays({
                title: `Kingdoms Forlorn • ${kingdom} × ${knight}`,
                playIds,
              })
            }}
          />
        </div>
      </Show>

      <AchievementsPanel
        title="Next achievements"
        achievements={achievements()}
        nextLimit={10}
        pinnedAchievementIds={props.pinnedAchievementIds}
        onTogglePin={props.onTogglePin}
        suppressAvailableTrackIds={props.suppressAvailableAchievementTrackIds}
      />
    </div>
      }
    >
      <KingdomsForlornExpeditionsView
        groups={expeditionGroups()}
        onBack={() => setShowExpeditionsView(false)}
        onOpenPlays={props.onOpenPlays}
      />
    </Show>
  )
}
