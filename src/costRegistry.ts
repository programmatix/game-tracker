import type { BoxCostConfig } from './contentCosts'
import { bulletContent } from './games/bullet/content'
import { burncycleContent } from './games/burncycle/content'
import { cloudspireContent } from './games/cloudspire/content'
import { deckersContent } from './games/deckers/content'
import { deathMayDieContent } from './games/death-may-die/content'
import { elderScrollsContent } from './games/elder-scrolls/content'
import { earthborneRangersContent } from './games/earthborne-rangers/content'
import rawFinalGirlContentText from './games/final-girl/content.yaml?raw'
import { parseOwnedFinalGirlContent } from './games/final-girl/ownedContent'
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
import { tooManyBonesContent } from './games/too-many-bones/content'
import { undauntedNormandyContent } from './games/undaunted-normandy/content'
import { unsettledContent } from './games/unsettled/content'

export type CostRegistryEntry = {
  id: string
  label: string
  aliases: string[]
  costs: BoxCostConfig
}

const finalGirlContent = parseOwnedFinalGirlContent(rawFinalGirlContentText)
const mistfallMappings = parseMistfallMappings(rawMistfallContentText)
const spiritIslandMappings = parseSpiritIslandMappings(rawSpiritIslandContentText)

function toBoxCostConfig(input: {
  costCurrencySymbol: string
  boxCostsByName: Map<string, number>
}): BoxCostConfig {
  return {
    currencySymbol: input.costCurrencySymbol,
    boxCostsByName: input.boxCostsByName,
  }
}

export const costRegistry: ReadonlyArray<CostRegistryEntry> = [
  {
    id: 'finalGirl',
    label: 'Final Girl',
    aliases: ['Final Girl'],
    costs: toBoxCostConfig(finalGirlContent),
  },
  {
    id: 'skytearHorde',
    label: 'Skytear Horde',
    aliases: ['Skytear Horde'],
    costs: toBoxCostConfig(skytearHordeContent),
  },
  {
    id: 'cloudspire',
    label: 'Cloudspire',
    aliases: ['Cloudspire'],
    costs: toBoxCostConfig(cloudspireContent),
  },
  {
    id: 'burncycle',
    label: 'burncycle',
    aliases: ['burncycle'],
    costs: toBoxCostConfig(burncycleContent),
  },
  {
    id: 'paleo',
    label: 'Paleo',
    aliases: ['Paleo'],
    costs: toBoxCostConfig(paleoContent),
  },
  {
    id: 'robinsonCrusoe',
    label: 'Robinson Crusoe',
    aliases: ['Robinson Crusoe', 'Robinson Crusoe: Adventures on the Cursed Island'],
    costs: toBoxCostConfig(robinsonCrusoeContent),
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
    costs: toBoxCostConfig(earthborneRangersContent),
  },
  {
    id: 'deckers',
    label: 'Deckers',
    aliases: ['Deckers'],
    costs: toBoxCostConfig(deckersContent),
  },
  {
    id: 'elderScrolls',
    label: 'Elder Scrolls',
    aliases: ['Elder Scrolls', 'The Elder Scrolls: Betrayal of the Second Era'],
    costs: toBoxCostConfig(elderScrollsContent),
  },
  {
    id: 'starTrekCaptainsChair',
    label: "Star Trek: Captain's Chair",
    aliases: ["Star Trek: Captain's Chair"],
    costs: toBoxCostConfig(starTrekCaptainsChairContent),
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
    costs: toBoxCostConfig(unsettledContent),
  },
  {
    id: 'mistfall',
    label: 'Mistfall',
    aliases: ['Mistfall', 'Mistfall Heart of the Mists'],
    costs: toBoxCostConfig(mistfallMappings),
  },
  {
    id: 'oathsworn',
    label: 'Oathsworn',
    aliases: ['Oathsworn', 'Oathsworn Into the Deepwood'],
    costs: toBoxCostConfig(oathswornContent),
  },
  {
    id: 'deathMayDie',
    label: 'Death May Die',
    aliases: ['Death May Die', 'Cthulhu Death May Die'],
    costs: toBoxCostConfig(deathMayDieContent),
  },
  {
    id: 'bullet',
    label: 'Bullet',
    aliases: ['Bullet', 'Bullet Heart', 'Bullet Star', 'Bullet♥︎'],
    costs: toBoxCostConfig(bulletContent),
  },
  {
    id: 'tooManyBones',
    label: 'Too Many Bones',
    aliases: ['Too Many Bones'],
    costs: toBoxCostConfig(tooManyBonesContent),
  },
  {
    id: 'mageKnight',
    label: 'Mage Knight',
    aliases: ['Mage Knight', 'Mage Knight Board Game', 'Mage Knight: Ultimate Edition'],
    costs: toBoxCostConfig(mageKnightContent),
  },
  {
    id: 'mandalorianAdventures',
    label: 'Mandalorian Adventures',
    aliases: ['Mandalorian Adventures', 'The Mandalorian Adventures'],
    costs: toBoxCostConfig(mandalorianAdventuresContent),
  },
  {
    id: 'undauntedNormandy',
    label: 'Undaunted: Normandy',
    aliases: ['Undaunted Normandy'],
    costs: toBoxCostConfig(undauntedNormandyContent),
  },
]
