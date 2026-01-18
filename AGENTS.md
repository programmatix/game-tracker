This project is going to get boardgame play data from Boardgame Geek (BGG) and display it.

# Data

The data is hardcoded in data.xml for now.  In future we will fetch it dynamically.

The data we get from BGG for a specific play looks like this:

```xml
<play id="108701372" date="2026-01-09" quantity="1" length="0" incomplete="0" nowinstats="0" location="">
<item name="Final Girl" objecttype="thing" objectid="277659">
<subtypes>
<subtype value="boardgame"/>
<subtype value="boardgameimplementation"/>
</subtypes>
</item>
<comments>#bgstats</comments>
<players>
<player username="" userid="0" name="C." startposition="" color="" score="" new="1" rating="0" win="1"/>
<player username="stony82" userid="295824" name="Graham" startposition="" color="V: The Organism／L: Station／FG: Uki" score="" new="0" rating="0" win="1"/>
</players>
</play>
```

The app we use to upload game plays is called BG Stats.
In the same above I gave myself roles of "V: The Organism" (meaning villain was the Organism), "L: Station" (meaning the location was the Station), and "FG: Uki" (meaning the final girl I played was Uki).


# Per-game

Each game should have a separate folder e.g. `src/games/final-girl`.

But any code - data parsing or UI - that is generic and can be re-used across games, gets put in the main `src` folder not the separate folder.

The UI should have a separate tab for each game.

The UI for each game may be different.  But often there will be two primary axes - in the case of Final Girl, that's location and villain.  Maybe secondary axes (the Final Girl played here).
And core requirements are usually going to be:

- Track how many times I've played each of the axes, in isolation.
- A 2d-matrix of the two primary axes.
- Show all content, whether I've played it yet or not.  E.g. Spirit Island should show all spirits and adversaries, not just the ones I've played.

# Rules

- Do not make any changes to git.
- Don't delete or touch any files that have changed unexpectedly, or aren't compiling, or similar.  I have other agents working concurrently.