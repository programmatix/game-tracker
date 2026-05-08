import type { BggPlay } from '../../bgg'
import {
  parseKingdomsForlornPlayerColor,
  type KingdomsForlornExpeditionStep,
} from './kingdomsForlorn'

export const KINGDOMS_FORLORN_OBJECT_ID = '297510'

export type KingdomsForlornEntry = {
  play: BggPlay
  campaign: string
  kingdom: string
  knights: string[]
  myKnight?: string
  quest?: string
  freeRoam: boolean
  expeditionStep?: KingdomsForlornExpeditionStep
  monster?: string
  monsters: string[]
  monsterTier?: number
  unknownTags: string[]
  quantity: number
  isWin: boolean
  continuedFromPrevious: boolean
  continuedToNext: boolean
}

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function comparePlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
}

function isKingdomsForlornPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === KINGDOMS_FORLORN_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'kingdoms forlorn: dragons, devils and kings' || name.startsWith('kingdoms forlorn')
}

function chooseMostCommonOrFirst(candidates: string[]): string | undefined {
  const normalized = candidates.map((value) => value.trim()).filter(Boolean)
  if (normalized.length === 0) return undefined

  const counts = new Map<string, number>()
  for (const value of normalized) counts.set(value, (counts.get(value) ?? 0) + 1)

  let best: { value: string; count: number } | undefined
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count }
  }

  return best?.value ?? normalized[0]
}

const EXPEDITION_STEP_ORDER: KingdomsForlornExpeditionStep[] = ['D1', 'EC', 'D2', 'FC']

function expeditionStepSortValue(step: KingdomsForlornExpeditionStep): number {
  return EXPEDITION_STEP_ORDER.indexOf(step)
}

function applyExpeditionMetadata(entries: KingdomsForlornEntry[]): void {
  let current: KingdomsForlornEntry[] = []
  let previousStepSort = -1

  function closeCurrent() {
    if (current.length === 0) return
    const anchor = current.find((entry) => entry.expeditionStep === 'D1') || current[0]
    if (!anchor) {
      current = []
      previousStepSort = -1
      return
    }

    const kingdom = anchor.kingdom || chooseMostCommonOrFirst(current.map((entry) => entry.kingdom))
    const myKnight = anchor.myKnight || chooseMostCommonOrFirst(current.map((entry) => entry.myKnight || ''))
    const isFreeRoam = current.some((entry) => entry.freeRoam) && !current.some((entry) => entry.quest)
    const quest = isFreeRoam
      ? undefined
      : anchor.quest || chooseMostCommonOrFirst(current.map((entry) => entry.quest || ''))
    const knights = anchor.knights.some(Boolean)
      ? anchor.knights.slice()
      : [
          ...new Set(
            current
              .flatMap((entry) => entry.knights)
              .map((knight) => knight.trim())
              .filter(Boolean),
          ),
        ]

    for (const entry of current) {
      if (!entry.kingdom && kingdom) entry.kingdom = kingdom
      if (!entry.myKnight && myKnight) entry.myKnight = myKnight
      if (!entry.freeRoam && !entry.quest && quest) entry.quest = quest
      if (entry.knights.length === 0 && knights.length > 0) entry.knights = knights.slice()
      for (const knight of knights) {
        if (knight && !entry.knights.includes(knight)) entry.knights.push(knight)
      }
      entry.campaign = entry.myKnight || ''
    }

    current = []
    previousStepSort = -1
  }

  for (const entry of entries) {
    const step = entry.expeditionStep
    if (!step) {
      closeCurrent()
      continue
    }

    const stepSort = expeditionStepSortValue(step)
    const startsNewExpedition =
      current.length > 0 &&
      step === 'D1' &&
      previousStepSort !== expeditionStepSortValue('D1')
    if (startsNewExpedition) closeCurrent()
    current.push(entry)
    previousStepSort = stepSort
  }

  closeCurrent()
}

export function getKingdomsForlornEntries(
  plays: BggPlay[],
  username: string,
): KingdomsForlornEntry[] {
  const user = username.toLowerCase()
  const result = plays
    .filter(isKingdomsForlornPlay)
    .slice()
    .sort(comparePlaysAsc)
    .map((play) => {
      const parsedPlayers = play.players.map((player) => {
        const parsed = parseKingdomsForlornPlayerColor(player.attributes.color || '')
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          kingdom: parsed.kingdom,
          knight: parsed.knight,
          knights: parsed.knights,
          quest: parsed.quest,
          freeRoam: parsed.freeRoam,
          expeditionStep: parsed.expeditionStep,
          monster: parsed.monster,
          monsters: parsed.monsters,
          monsterTier: parsed.monsterTier,
          extraTags: parsed.extraTags,
          continuePrevious: parsed.continuePrevious,
          continueNext: parsed.continueNext,
        }
      })

      const myPlayer = parsedPlayers.find((player) => player.username === user)
      const questingPlayer =
        parsedPlayers.find((player) => player.quest && player.knight) ||
        parsedPlayers.find((player) => player.quest)
      const primaryPlayer = questingPlayer || myPlayer
      const kingdomCandidates = parsedPlayers.map((player) => player.kingdom).filter(Boolean) as string[]
      const knightCandidates = parsedPlayers.flatMap((player) => player.knights)
      const myKnight = questingPlayer?.knight?.trim() || myPlayer?.knight?.trim() || undefined
      const freeRoam = parsedPlayers.some((player) => player.freeRoam)
      const quest = freeRoam ? undefined : questingPlayer?.quest?.trim() || myPlayer?.quest?.trim() || undefined
      const expeditionStep =
        myPlayer?.expeditionStep ||
        chooseMostCommonOrFirst(
          parsedPlayers.map((player) => player.expeditionStep).filter(Boolean) as string[],
        )
      const monster =
        myPlayer?.monster?.trim() ||
        chooseMostCommonOrFirst(parsedPlayers.map((player) => player.monster).filter(Boolean) as string[])
      const monsters = [
        ...new Set(
          parsedPlayers
            .flatMap((player) => player.monsters)
            .map((monster) => monster.trim())
            .filter(Boolean),
        ),
      ]
      const monsterTier =
        myPlayer?.monsterTier ??
        Number(chooseMostCommonOrFirst(
          parsedPlayers
            .map((player) => player.monsterTier)
            .filter((tier): tier is number => tier !== undefined)
            .map(String),
        ))
      const knights = [...new Set(knightCandidates)]
      const unknownTags = [
        ...new Set(
          parsedPlayers
            .flatMap((player) => player.extraTags)
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ]

      return {
        play,
        campaign: myKnight || '',
        kingdom: primaryPlayer?.kingdom?.trim() || chooseMostCommonOrFirst(kingdomCandidates) || '',
        knights,
        myKnight,
        quest,
        freeRoam,
        expeditionStep: expeditionStep as KingdomsForlornExpeditionStep | undefined,
        monster,
        monsters,
        monsterTier: Number.isFinite(monsterTier) ? monsterTier : undefined,
        unknownTags,
        quantity: playQuantity(play),
        isWin: primaryPlayer?.win === true,
        continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
        continuedToNext: parsedPlayers.some((player) => player.continueNext),
      }
    })

  let previousResolved: { kingdom?: string; myKnight?: string; quest?: string } | null = null
  for (const entry of result) {
    if (entry.continuedFromPrevious && previousResolved) {
      if (!entry.kingdom && previousResolved.kingdom) entry.kingdom = previousResolved.kingdom
      if (!entry.myKnight && previousResolved.myKnight) entry.myKnight = previousResolved.myKnight
      if (!entry.freeRoam && !entry.quest && previousResolved.quest) entry.quest = previousResolved.quest
    }
    entry.campaign = entry.myKnight || ''
    if (entry.myKnight && !entry.knights.includes(entry.myKnight)) entry.knights.push(entry.myKnight)
    if (entry.kingdom || entry.myKnight || entry.quest) {
      const priorKingdom: string | undefined = previousResolved ? previousResolved.kingdom : undefined
      const priorMyKnight: string | undefined = previousResolved ? previousResolved.myKnight : undefined
      const priorQuest: string | undefined = previousResolved ? previousResolved.quest : undefined
      previousResolved = {
        kingdom: entry.kingdom || priorKingdom,
        myKnight: entry.myKnight || priorMyKnight,
        quest: entry.quest || priorQuest,
      }
    }
  }

  let nextResolved: { kingdom?: string; myKnight?: string; quest?: string } | null = null
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (entry.continuedToNext && nextResolved) {
      if (!entry.kingdom && nextResolved.kingdom) entry.kingdom = nextResolved.kingdom
      if (!entry.myKnight && nextResolved.myKnight) entry.myKnight = nextResolved.myKnight
      if (!entry.freeRoam && !entry.quest && nextResolved.quest) entry.quest = nextResolved.quest
    }
    entry.campaign = entry.myKnight || ''
    if (entry.myKnight && !entry.knights.includes(entry.myKnight)) entry.knights.push(entry.myKnight)
    if (entry.kingdom || entry.myKnight || entry.quest) {
      const priorKingdom: string | undefined = nextResolved ? nextResolved.kingdom : undefined
      const priorMyKnight: string | undefined = nextResolved ? nextResolved.myKnight : undefined
      const priorQuest: string | undefined = nextResolved ? nextResolved.quest : undefined
      nextResolved = {
        kingdom: entry.kingdom || priorKingdom,
        myKnight: entry.myKnight || priorMyKnight,
        quest: entry.quest || priorQuest,
      }
    }
  }

  applyExpeditionMetadata(result)

  for (const entry of result) {
    entry.campaign = entry.myKnight || 'Unknown campaign'
    if (!entry.kingdom) entry.kingdom = 'Unknown kingdom'
    if (entry.knights.length === 0) entry.knights = entry.myKnight ? [entry.myKnight] : ['Unknown knight']
  }

  return result
}
