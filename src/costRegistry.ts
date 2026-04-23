import type { BoxCostConfig } from './contentCosts'
import { bulletContent } from './games/bullet/content'
import { burncycleContent } from './games/burncycle/content'
import { cloudspireContent } from './games/cloudspire/content'
import { deckersContent } from './games/deckers/content'
import { deathMayDieContent } from './games/death-may-die/content'
import { elderScrollsContent } from './games/elder-scrolls/content'
import { earthborneRangersContent } from './games/earthborne-rangers/content'
import { arkhamHorrorLcgContent } from './games/arkham-horror-lcg/content'
import rawFinalGirlContentText from './games/final-girl/content.yaml?raw'
import { parseOwnedFinalGirlContent } from './games/final-girl/ownedContent'
import { isofarianGuardContent } from './games/isofarian-guard/content'
import { kingdomsForlornContent } from './games/kingdoms-forlorn/content'
import { leviathanWildsContent } from './games/leviathan-wilds/content'
import { mageKnightContent } from './games/mage-knight/content'
import { mandalorianAdventuresContent } from './games/mandalorian-adventures/content'
import { oathswornContent } from './games/oathsworn/content'
import rawMistfallContentText from './games/mistfall/content.yaml?raw'
import { parseMistfallMappings } from './games/mistfall/mappings'
import { paleoContent } from './games/paleo/content'
import { robinHoodContent } from './games/robin-hood/content'
import { robinsonCrusoeContent } from './games/robinson-crusoe/content'
import { skytearHordeContent } from './games/skytear-horde/content'
import rawSpiritIslandContentText from './games/spirit-island/content.yaml?raw'
import { parseSpiritIslandMappings } from './games/spirit-island/mappings'
import { starTrekCaptainsChairContent } from './games/star-trek-captains-chair/content'
import { taintedGrailContent } from './games/tainted-grail/content'
import { tooManyBonesContent } from './games/too-many-bones/content'
import { undauntedNormandyContent } from './games/undaunted-normandy/content'
import { unsettledContent } from './games/unsettled/content'
import { PURCHASE_GAME_FAMILIES, purchaseGameFamilyById } from './purchaseGameFamilies'

export type CostRegistryEntry = {
  id: string
  label: string
  aliases: string[]
  costs: BoxCostConfig
}

const finalGirlContent = parseOwnedFinalGirlContent(rawFinalGirlContentText)
const mistfallMappings = parseMistfallMappings(rawMistfallContentText)
const spiritIslandMappings = parseSpiritIslandMappings(rawSpiritIslandContentText)

function uniqueAliases(values: Iterable<string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const normalized = trimmed.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(trimmed)
  }
  return result
}

const arkhamHorrorLcgAliases = uniqueAliases([
  'Arkham Horror LCG',
  'Arkham Horror: The Card Game',
  ...arkhamHorrorLcgContent.campaigns,
  ...arkhamHorrorLcgContent.campaignBoxByName.values(),
  ...arkhamHorrorLcgContent.scenarioBoxByName.values(),
  ...arkhamHorrorLcgContent.investigatorBoxByName.values(),
])

function toBoxCostConfig(input: {
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}): BoxCostConfig {
  return {
    currencySymbol: input.costCurrencySymbol,
    boxCostsByName: input.boxCostsByName,
  }
}

function familyCostConfig(gameId: string, fallback: BoxCostConfig): BoxCostConfig {
  const family = purchaseGameFamilyById.get(gameId)
  if (!family) return fallback
  return {
    currencySymbol: '£',
    boxCostsByName: new Map([[family.label, family.price]]),
  }
}

const legacyCostRegistry: ReadonlyArray<CostRegistryEntry> = [
  {
    id: 'arkhamHorrorLcg',
    label: 'Arkham Horror LCG',
    aliases: arkhamHorrorLcgAliases,
    costs: familyCostConfig('arkhamHorrorLcg', toBoxCostConfig(arkhamHorrorLcgContent)),
  },
  {
    id: 'finalGirl',
    label: 'Final Girl',
    aliases: ['Final Girl'],
    costs: familyCostConfig('finalGirl', toBoxCostConfig(finalGirlContent)),
  },
  {
    id: 'skytearHorde',
    label: 'Skytear Horde',
    aliases: ['Skytear Horde'],
    costs: familyCostConfig('skytearHorde', toBoxCostConfig(skytearHordeContent)),
  },
  {
    id: 'cloudspire',
    label: 'Cloudspire',
    aliases: ['Cloudspire'],
    costs: familyCostConfig('cloudspire', toBoxCostConfig(cloudspireContent)),
  },
  {
    id: 'burncycle',
    label: 'burncycle',
    aliases: ['burncycle'],
    costs: familyCostConfig('burncycle', toBoxCostConfig(burncycleContent)),
  },
  {
    id: 'paleo',
    label: 'Paleo',
    aliases: ['Paleo'],
    costs: familyCostConfig('paleo', toBoxCostConfig(paleoContent)),
  },
  {
    id: 'robinsonCrusoe',
    label: 'Robinson Crusoe',
    aliases: ['Robinson Crusoe', 'Robinson Crusoe: Adventures on the Cursed Island'],
    costs: familyCostConfig('robinsonCrusoe', toBoxCostConfig(robinsonCrusoeContent)),
  },
  {
    id: 'robinHood',
    label: 'Robin Hood',
    aliases: ['Robin Hood', 'The Adventures of Robin Hood'],
    costs: toBoxCostConfig(robinHoodContent),
  },
  {
    id: 'earthborneRangers',
    label: 'Earthborne Rangers',
    aliases: ['Earthborne Rangers'],
    costs: familyCostConfig('earthborneRangers', toBoxCostConfig(earthborneRangersContent)),
  },
  {
    id: 'deckers',
    label: 'Deckers',
    aliases: ['Deckers'],
    costs: familyCostConfig('deckers', toBoxCostConfig(deckersContent)),
  },
  {
    id: 'elderScrolls',
    label: 'Elder Scrolls',
    aliases: ['Elder Scrolls', 'The Elder Scrolls: Betrayal of the Second Era'],
    costs: familyCostConfig('elderScrolls', toBoxCostConfig(elderScrollsContent)),
  },
  {
    id: 'starTrekCaptainsChair',
    label: "Star Trek: Captain's Chair",
    aliases: ["Star Trek: Captain's Chair"],
    costs: familyCostConfig(
      'starTrekCaptainsChair',
      toBoxCostConfig(starTrekCaptainsChairContent),
    ),
  },
  {
    id: 'isofarianGuard',
    label: 'Isofarian Guard',
    aliases: ['Isofarian Guard', 'The Isofarian Guard'],
    costs: familyCostConfig('isofarianGuard', toBoxCostConfig(isofarianGuardContent)),
  },
  {
    id: 'kingdomsForlorn',
    label: 'Kingdoms Forlorn',
    aliases: ['Kingdoms Forlorn', 'Kingdoms Forlorn: Dragons, Devils and Kings'],
    costs: familyCostConfig('kingdomsForlorn', toBoxCostConfig(kingdomsForlornContent)),
  },
  {
    id: 'leviathanWilds',
    label: 'Leviathan Wilds',
    aliases: ['Leviathan Wilds'],
    costs: familyCostConfig('leviathanWilds', toBoxCostConfig(leviathanWildsContent)),
  },
  {
    id: 'taintedGrail',
    label: 'Tainted Grail',
    aliases: ['Tainted Grail', 'Tainted Grail: The Fall of Avalon'],
    costs: familyCostConfig('taintedGrail', toBoxCostConfig(taintedGrailContent)),
  },
  {
    id: 'spiritIsland',
    label: 'Spirit Island',
    aliases: ['Spirit Island'],
    costs: toBoxCostConfig(spiritIslandMappings),
  },
  {
    id: 'unsettled',
    label: 'Unsettled',
    aliases: ['Unsettled'],
    costs: familyCostConfig('unsettled', toBoxCostConfig(unsettledContent)),
  },
  {
    id: 'mistfall',
    label: 'Mistfall',
    aliases: ['Mistfall', 'Mistfall Heart of the Mists'],
    costs: familyCostConfig('mistfall', toBoxCostConfig(mistfallMappings)),
  },
  {
    id: 'oathsworn',
    label: 'Oathsworn',
    aliases: ['Oathsworn', 'Oathsworn Into the Deepwood'],
    costs: familyCostConfig('oathsworn', toBoxCostConfig(oathswornContent)),
  },
  {
    id: 'deathMayDie',
    label: 'Death May Die',
    aliases: ['Death May Die', 'Cthulhu Death May Die'],
    costs: familyCostConfig('deathMayDie', toBoxCostConfig(deathMayDieContent)),
  },
  {
    id: 'bullet',
    label: 'Bullet',
    aliases: ['Bullet', 'Bullet Heart', 'Bullet Star', 'Bullet♥︎'],
    costs: familyCostConfig('bullet', toBoxCostConfig(bulletContent)),
  },
  {
    id: 'tooManyBones',
    label: 'Too Many Bones',
    aliases: ['Too Many Bones'],
    costs: familyCostConfig('tooManyBones', toBoxCostConfig(tooManyBonesContent)),
  },
  {
    id: 'mageKnight',
    label: 'Mage Knight',
    aliases: ['Mage Knight', 'Mage Knight Board Game', 'Mage Knight: Ultimate Edition'],
    costs: familyCostConfig('mageKnight', toBoxCostConfig(mageKnightContent)),
  },
  {
    id: 'mandalorianAdventures',
    label: 'Mandalorian Adventures',
    aliases: ['Mandalorian Adventures', 'The Mandalorian Adventures'],
    costs: familyCostConfig(
      'mandalorianAdventures',
      toBoxCostConfig(mandalorianAdventuresContent),
    ),
  },
  {
    id: 'undauntedNormandy',
    label: 'Undaunted: Normandy',
    aliases: ['Undaunted Normandy'],
    costs: familyCostConfig('undauntedNormandy', toBoxCostConfig(undauntedNormandyContent)),
  },
]

const legacyIds = new Set(legacyCostRegistry.map((entry) => entry.id))

const purchaseOnlyCostRegistry: ReadonlyArray<CostRegistryEntry> = PURCHASE_GAME_FAMILIES.filter(
  (family) => !legacyIds.has(family.id),
).map((family) => ({
  id: family.id,
  label: family.label,
  aliases: uniqueAliases([family.label, family.spreadsheetFamily, ...(family.aliases || [])]),
  costs: {
    currencySymbol: '£',
    boxCostsByName: new Map([[family.label, family.price]]),
  },
}))

export const costRegistry: ReadonlyArray<CostRegistryEntry> = [
  ...legacyCostRegistry,
  ...purchaseOnlyCostRegistry,
]
