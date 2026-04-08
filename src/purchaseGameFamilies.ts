export type PurchaseGameFamily = {
  id: string
  label: string
  spreadsheetFamily: string
  aliases?: ReadonlyArray<string>
  price: number
}

// Aggregated from the purchase spreadsheet Net column (F).
export const PURCHASE_GAME_FAMILIES: ReadonlyArray<PurchaseGameFamily> = [
  { id: '20Strong', label: "20 Strong", spreadsheetFamily: "20 Strong", price: 55.10 },
  { id: '7thCitadel', label: "7th Citadel", spreadsheetFamily: "7th Citadel", price: 75.49 },
  { id: 'agemonia', label: "Agemonia", spreadsheetFamily: "Agemonia", price: 130.48 },
  { id: 'arkhamHorrorLcg', label: "Arkham Horror LCG", spreadsheetFamily: "Arkham Horror LCG", price: 921.19 },
  { id: 'arydia', label: "Arydia", spreadsheetFamily: "Arydia", price: 179.45 },
  { id: 'assaultOnDoomrockExpansion', label: "Assault on Doomrock + Expansion", spreadsheetFamily: "Assault on Doomrock + Expansion", price: 42.30 },
  { id: 'bombBusters', label: "Bomb Busters", spreadsheetFamily: "Bomb Busters", price: 22.94 },
  { id: 'bossFightersQR', label: "Boss Fighters QR", spreadsheetFamily: "Boss Fighters QR", price: 28.98 },
  { id: 'bullet', label: "Bullet", spreadsheetFamily: "Bullet", price: 80.37 },
  { id: 'burncycle', label: "burncycle", spreadsheetFamily: "Burncycle", price: 144.22 },
  { id: 'cloudspire', label: "Cloudspire", spreadsheetFamily: "Cloudspire", price: 175.00 },
  {
    id: 'corpOfDiscovery',
    label: "Corp of Discovery",
    spreadsheetFamily: "Corp of Discovery",
    aliases: ["Corps of Discovery", "Corps of Discovery: A Game Set in the World of Manifest Destiny"],
    price: 40.50,
  },
  { id: 'cyberpunkLegends', label: "Cyberpunk Legends", spreadsheetFamily: "Cyberpunk Legends", price: 30.06 },
  { id: 'deadCells', label: "Dead Cells", spreadsheetFamily: "Dead Cells", price: 45.20 },
  { id: 'deathMayDie', label: "Death May Die", spreadsheetFamily: "Cthulu: Death May Die", price: 0.00 },
  { id: 'deckers', label: "Deckers", spreadsheetFamily: "Deckers", price: 34.50 },
  { id: 'diceThrone', label: "Dice Throne", spreadsheetFamily: "Dice Throne", price: 47.06 },
  { id: 'distantSkies', label: "Distant Skies", spreadsheetFamily: "Distant Skies", aliases: ["Sleeping Gods: Distant Skies"], price: 73.95 },
  { id: 'dragonEclipse', label: "Dragon Eclipse", spreadsheetFamily: "Dragon Eclipse", price: 71.79 },
  { id: 'dragonholt', label: "Dragonholt", spreadsheetFamily: "Dragonholt", price: 29.49 },
  { id: 'earthborneRangers', label: "Earthborne Rangers", spreadsheetFamily: "Earthborne Rangers", price: 62.00 },
  { id: 'elderScrolls', label: "Elder Scrolls", spreadsheetFamily: "Elder Scrolls Betrayal", price: 379.41 },
  { id: 'etherfield', label: "Etherfield", spreadsheetFamily: "Etherfield", price: 71.65 },
  { id: 'everdellDuo', label: "Everdell Duo", spreadsheetFamily: "Everdell Duo", price: 33.00 },
  {
    id: 'fateforge',
    label: "Fateforge",
    spreadsheetFamily: "Fateforge",
    aliases: ["Fateforge: Chronicles of Kaan"],
    price: 70.00,
  },
  {
    id: 'fellowshipTrickTakingGame',
    label: "Fellowship Trick Taking Game",
    spreadsheetFamily: "Fellowship Trick Taking Game",
    aliases: ["The Fellowship of the Ring: Trick-Taking Game", "The Fellowship of the Ring Trick-Taking Game"],
    price: 20.00,
  },
  { id: 'finalGirl', label: "Final Girl", spreadsheetFamily: "Final Girl", price: 200.13 },
  { id: 'fleshAndBlood', label: "Flesh and Blood", spreadsheetFamily: "Flesh and Blood", price: 15.50 },
  {
    id: 'gloomOfKilforth',
    label: "Gloom of Kilforth",
    spreadsheetFamily: "Gloom of Kilforth",
    aliases: ["Gloom of Kilforth: A Fantasy Quest Game"],
    price: 5.89,
  },
  {
    id: 'imperialAssault',
    label: "Imperial Assault",
    spreadsheetFamily: "72 Imperial Assault",
    aliases: ["Star Wars: Imperial Assault"],
    price: 51.66,
  },
  {
    id: 'imperium',
    label: "Imperium",
    spreadsheetFamily: "Imperium",
    aliases: ["Imperium: Classics", "Imperium: Legends", "Imperium: Horizons"],
    price: 36.82,
  },
  {
    id: 'invincible',
    label: "Invincible",
    spreadsheetFamily: "Invincible",
    aliases: ["Invincible: The Hero-Building Game"],
    price: 5.71,
  },
  { id: 'isofarianGuard', label: "Isofarian Guard", spreadsheetFamily: "Isofarian Guard", price: 153.00 },
  { id: 'keyforge', label: "Keyforge", spreadsheetFamily: "Keyforge", price: 11.69 },
  {
    id: 'kinfireChronicles',
    label: "Kinfire Chronicles",
    spreadsheetFamily: "Kinfire Chronicles",
    aliases: ["Kinfire Chronicles: Night's Fall", "Kinfire Chronicles: Nights Fall"],
    price: 124.99,
  },
  {
    id: 'kinfireDelve',
    label: "Kinfire Delve",
    spreadsheetFamily: "Kinfire Delve",
    aliases: ["Kinfire Delve: Callous' Lab", "Kinfire Delve: Scorn's Stockade", "Kinfire Delve: Vainglory's Grotto"],
    price: 13.59,
  },
  { id: 'kingdomsForlorn', label: "Kingdoms Forlorn", spreadsheetFamily: "Kingdom Forlorn", price: 365.97 },
  { id: 'leviathanWilds', label: "Leviathan Wilds", spreadsheetFamily: "Leviathan Wilds", price: 89.23 },
  { id: 'mageKnight', label: "Mage Knight", spreadsheetFamily: "Mage Knight", price: 149.95 },
  { id: 'mandalorianAdventures', label: "Mandalorian Adventures", spreadsheetFamily: "Mandalorian Adventures", price: 67.00 },
  { id: 'marvelChampions', label: "Marvel Champions", spreadsheetFamily: "Marvel Champions", price: 84.43 },
  { id: 'mind', label: "Mind", spreadsheetFamily: "Mind", price: 0.00 },
  { id: 'mistfall', label: "Mistfall", spreadsheetFamily: "Mistfall", price: 49.63 },
  { id: 'mtg', label: "MTG", spreadsheetFamily: "MTG", price: 7.49 },
  { id: 'nanolith', label: "Nanolith", spreadsheetFamily: "Nanolith", price: 99.99 },
  {
    id: 'nusfjord',
    label: "Nusfjord",
    spreadsheetFamily: "Nusfjord",
    aliases: ["Nusfjord Big Box"],
    price: 6.37,
  },
  { id: 'oathsworn', label: "Oathsworn", spreadsheetFamily: "Oathsworn", price: 119.99 },
  { id: 'onward', label: "Onward", spreadsheetFamily: "Onward", price: 63.91 },
  { id: 'paleo', label: "Paleo", spreadsheetFamily: "Paleo", price: 38.85 },
  { id: 'phantomEpoch', label: "Phantom Epoch", spreadsheetFamily: "Phantom Epoch", price: 135.00 },
  { id: 'puzzleStrike2', label: "Puzzle Strike 2", spreadsheetFamily: "Puzzle Strike 2", price: 44.99 },
  { id: 'radiance', label: "Radiance", spreadsheetFamily: "Radiance", price: 42.38 },
  { id: 'radlands', label: "Radlands", spreadsheetFamily: "Radlands", price: 18.00 },
  { id: 'robinsonCrusoe', label: "Robinson Crusoe", spreadsheetFamily: "Robinson Crusoe", price: 51.78 },
  { id: 'rogueAngels', label: "Rogue Angels", spreadsheetFamily: "Rogue Angels", price: 101.00 },
  { id: 'rove', label: "Rove", spreadsheetFamily: "Rove", price: 45.08 },
  { id: 'scout', label: "Scout", spreadsheetFamily: "Scout", price: 0.00 },
  { id: 'seaSaltAndPaper', label: "Sea Salt and Paper", spreadsheetFamily: "Sea Salt and Paper", price: 0.00 },
  { id: 'skyTeam', label: "Sky Team", spreadsheetFamily: "Sky Team", price: 16.99 },
  { id: 'skytearHorde', label: "Skytear Horde", spreadsheetFamily: "Skytear Horde", price: 200.00 },
  { id: 'sleepingGods', label: "Sleeping Gods", spreadsheetFamily: "Sleeping Gods", price: 82.65 },
  { id: 'songOfSilveranth', label: "Song of Silveranth", spreadsheetFamily: "Song of Silveranth", price: 126.48 },
  { id: 'starTrekCaptainsChair', label: "Star Trek: Captain's Chair", spreadsheetFamily: "Star Trek Captain's Chair", price: 53.98 },
  { id: 'superPixelTactics', label: "Super Pixel Tactics", spreadsheetFamily: "Super Pixel Tactics", price: 110.86 },
  {
    id: 'swordAndSorcery',
    label: "Sword and Sorcery",
    spreadsheetFamily: "Sword and Sorcery",
    aliases: [
      "Sword & Sorcery",
      "Swords & Sorcery",
      "Swords and Sorcery",
      "Sword & Sorcery: Ancient Chronicles",
      "Sword and Sorcery: Ancient Chronicles",
    ],
    price: 239.00,
  },
  { id: 'tagTeam', label: "Tag Team", spreadsheetFamily: "Tag Team", price: 15.44 },
  { id: 'taintedGrail', label: "Tainted Grail", spreadsheetFamily: "Tainted Grail", price: 99.97 },
  { id: 'talesFromTheRedDragonInn', label: "Tales From the Red Dragon Inn", spreadsheetFamily: "Tales From the Red Dragon Inn", price: 83.99 },
  {
    id: 'tamashii',
    label: "Tamashii",
    spreadsheetFamily: "Tamashii",
    aliases: ["Tamashii: Chronicle of Ascend"],
    price: 1.99,
  },
  { id: 'theAnarchy', label: "The Anarchy", spreadsheetFamily: "The Anarchy", price: 12.37 },
  {
    id: 'tidalBlades2',
    label: "Tidal Blades 2",
    spreadsheetFamily: "Tidal Blades 2",
    aliases: ["Tidal Blades 2: Rise of the Unfolders"],
    price: 65.81,
  },
  { id: 'tooManyBones', label: "Too Many Bones", spreadsheetFamily: "Too Many Bones", price: 330.47 },
  { id: 'undauntedNormandy', label: "Undaunted: Normandy", spreadsheetFamily: "Undaunted", price: 55.50 },
  { id: 'underFallingSkies', label: "Under Falling Skies", spreadsheetFamily: "Under Falling Skies", price: 21.40 },
  { id: 'unsettled', label: "Unsettled", spreadsheetFamily: "Unsettled", price: 108.03 },
  { id: 'unstoppable', label: "Unstoppable", spreadsheetFamily: "Unstoppable", price: 4.93 },
  { id: 'vantage', label: "Vantage", spreadsheetFamily: "Vantage", price: 56.18 },
  { id: 'wanderingGalaxy', label: "Wandering Galaxy", spreadsheetFamily: "Wandering Galaxy", price: 40.21 },
  { id: 'warpsEdge', label: "Warps Edge", spreadsheetFamily: "Warps Edge", price: 25.66 },
]

export const purchaseGameFamilyById = new Map(
  PURCHASE_GAME_FAMILIES.map((family) => [family.id, family] as const),
)

function toLegacyPurchaseGameFamilyId(label: string): string {
  const suffix = label
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return `family${suffix}`
}

export const legacyPurchaseGameFamilyIdToId = new Map(
  PURCHASE_GAME_FAMILIES.map((family) => [toLegacyPurchaseGameFamilyId(family.label), family.id] as const)
    .filter(([legacyId, familyId]) => legacyId !== familyId),
)

export function isPurchaseGameFamilyId(value: string): boolean {
  return purchaseGameFamilyById.has(value)
}

export function normalizePurchaseGameFamilyId(value: string): string | null {
  if (purchaseGameFamilyById.has(value)) return value
  return legacyPurchaseGameFamilyIdToId.get(value) || null
}
