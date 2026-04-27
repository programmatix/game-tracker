# Multiple Campaigns

Some games are one game family with several distinct campaigns inside them.

## Model

Use three levels:

- `game family`
  Example: `Tainted Grail`, `Arkham Horror LCG`, `Kingdoms Forlorn`
- `campaign definition`
  Example: `The Fall of Avalon`, `Age of Legends`, `The Last Knight`
- `campaign run metadata`
  Example: investigators, knight, difficulty, continuation flags

The important distinction is that a knight or investigator is usually not the campaign itself unless the game structure makes it so.

## Per game

- `Arkham Horror LCG`
  Campaigns are the campaign boxes. Scenarios belong to campaigns. Investigators and difficulty are run metadata.
- `Tainted Grail`
  The game contains multiple campaigns. Chapter numbers repeat, so chapters need a campaign context.
- `Kingdoms Forlorn`
  Treat each knight as a separate campaign. Quest or kingdom progress sits underneath that campaign.

## BG Stats tagging

When step numbers repeat across campaigns, include the campaign tag as well.

Examples:

- `FoA／C1`
- `AoL／C1`
- `TLK／C1`
- `Campaign: AoL／Chapter: 1`

Without the campaign tag, `Chapter 1` is ambiguous once a game has multiple campaigns.
