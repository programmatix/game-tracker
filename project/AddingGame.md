
Each game should have a separate folder e.g. `src/games/final-girl`.

But any code - data parsing or UI - that is generic and can be re-used across games, gets put in the main `src` folder not the separate folder.

The UI should have a separate tab for each game.

The UI for each game may be different.  But often there will be two primary axes - in the case of Final Girl, that's location and villain.  Maybe secondary axes (the Final Girl played here).
And core requirements are usually going to be:

- Track how many times I've played each of the axes, in isolation.
- A 2d-matrix of the two primary axes.
- Show all content, whether I've played it yet or not.  E.g. Spirit Island should show all spirits and adversaries, not just the ones I've played.

Basically, follow the convention of other games e.g. src/games/death-may-die.

Other rules to follow:
- Where we have groups, use them in all tables and matrix grids.
- Add achievements.

Use the CLI tool (`node scripts/bgg-plays.js --username stony82 --all --stdout`) to pull the BGG data and to see how that game's data is structured.  The color= field particularly.
But note that it may not be suitable. If there are two axes we only have 15 characters for each axis. If 3, only 10. So you may need to define your compact tokens/ids directly in `content.yaml`, and ask me to change the BGG data manually to follow it.
You will need a content.yaml anyway, that will contain all content for the game.


