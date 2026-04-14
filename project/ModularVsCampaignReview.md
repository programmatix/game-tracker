# Modular vs Campaign Review

This is a review of the current dedicated game tabs under `src/games/*`, using the distinction in `project/AddingGame.md`:

- `modular`: the game benefits from a matrix because you are recombining main axes between plays.
- `campaign`: the game benefits more from scenario/chapter progression tables than from a matrix.
- `neither`: the game is mostly scenario-based, run-based, or mixed in a way that does not map cleanly to either bucket.

No UI changes have been made. This is only a review document.

## Summary

### Clear modular

- `final-girl`
- `spirit-island`
- `death-may-die`
- `bullet`
- `too-many-bones`
- `skytear-horde`
- `deckers`
- `burncycle`
- `star-trek-captains-chair`
- `mistfall`

### Clear campaign

- `tainted-grail`
- `earthborne-rangers`
- `arkham-horror-lcg`
- `isofarian-guard`
- `oathsworn`
- `robin-hood`
- `kingdoms-forlorn`
- `cloudspire`
- `unsettled`

### Clear scenario-based
(Similar to campaign, but with more focus on scenario progression, less on long-form story)

- `robinson-crusoe`
- `mage-knight`
- `undaunted-normandy`
- `paleo`

### Neither / mixed

- `mandalorian-adventures`
- `elder-scrolls`

## Per Game

| Game | Current main tab shape | Category | Should UI change later? | Notes |
| --- | --- | --- | --- | --- |
| `arkham-horror-lcg` | Investigator × scenario matrix, plus campaign/scenario tables | Campaign | Yes | This is fundamentally campaign-first. The campaign and scenario tables are the right direction; the matrix feels secondary. I would eventually make scenario progression the primary element and demote the matrix. |
| `bullet` | Boss × heroine matrix | Modular | No | This matches the modular brief well. Bosses and heroines are recombined cleanly, and the matrix is high-signal. |
| `burncycle` | Corporation × bot matrix, with captain tables | Modular | No | Not campaign-shaped. The corporation/bot pairing is a reasonable modular view, with captain coverage as a side table. |
| `cloudspire` | Solo faction × solo scenario matrix, plus PvP/co-op counts | Neither / mixed | Maybe | This is mixed: solo is scenario progression, PvP is matchup-driven. I would not force it into either bucket. If anything changes later, I would split solo progression more clearly from PvP faction coverage rather than treating the whole game as modular or campaign. |
| `death-may-die` | Elder One × scenario matrix | Modular | No | This is the exact kind of modular matrix the doc describes. |
| `deckers` | SMC × decker matrix | Modular | No | Clean modular pairing view. No obvious structural change needed. |
| `earthborne-rangers` | Day coverage table | Campaign | No | Already aligned with campaign tracking. If anything, this could become even more table/progression-heavy, but the current direction is right. |
| `elder-scrolls` | Province × class matrix, plus race table | Neither / mixed | Maybe | This feels more like campaign-run metadata than either classic modular or chapter-based campaign progression. The current matrix is acceptable, but I would not use it as a pattern for other campaign games. |
| `final-girl` | Villain × location matrix, plus Final Girl table | Modular | No | This is the reference case from the doc and already fits it well. |
| `isofarian-guard` | Campaign × guard matrix, plus chapter table | Campaign | Yes | This should be campaign-first. The chapter table is useful; the campaign × guard matrix is lower-value because guards are tied to campaigns rather than freely recombined. I would eventually make chapter progression the dominant view. |
| `kingdoms-forlorn` | Kingdom × knight matrix | Campaign | Yes | The use of `ContPrev`/`ContNext` and the game structure both suggest campaign play. The current matrix is understandable as run metadata, but it is not the most natural primary view for a campaign game. This likely wants chapter/scenario/progression tracking once that data exists. |
| `mage-knight` | Hero × scenario matrix | Neither / mixed | No | This is scenario-based and highly replayable, but not campaign. The matrix is still useful because hero/scenario pairing matters. I would keep it as-is rather than forcing campaign styling. |
| `mandalorian-adventures` | Mission × character matrix, plus encounter table | Neither / mixed | No | Missions are scenario-like, but the game is replayable and not really campaign-shaped in this tab. The current matrix is reasonable. |
| `mistfall` | Hero × quest matrix | Neither / mixed | Maybe | Quests are scenario progression within a box, but the game is also hero/quest combinatorial. I would not call this campaign in the same sense as Tainted Grail or Oathsworn. Current structure is defensible. |
| `oathsworn` | Encounter × character matrix, plus story/encounter tables | Campaign | Yes | This is campaign-first. The chapter/story progression matters more than recombining characters against encounters. I would later promote chapter progression tables above the matrix, or remove the matrix if it feels noisy. |
| `paleo` | Module-pair matrix, plus scenario table | Neither / mixed | No | This is modular content composition, but not in the hero-vs-villain sense from the doc. The existing mix of module matrix plus scenario tracking feels right. |
| `robin-hood` | Adventure × character matrix | Campaign | Yes | Adventures are sequential campaign content. Character/adventure pairings are less important than whether each adventure was played, won, and how long it took. I would move this toward a campaign table and demote the matrix. |
| `robinson-crusoe` | Scenario table | Neither / mixed | No | Scenario-based, but not campaign. The current non-matrix view is already appropriate. |
| `skytear-horde` | Hero × enemy matrix | Modular | No | Strong modular fit. |
| `spirit-island` | Spirit × adversary matrix | Modular | No | Strong modular fit and one of the best examples of the matrix brief. |
| `star-trek-captains-chair` | Scenario/difficulty × captain matrix | Modular | No | Even though the rows are scenario/difficulty variants, the captain pairing matrix is still the main signal and fits the modular bucket well enough. |
| `tainted-grail` | Chapter table with hours and continuation flags | Campaign | No | Already aligned very closely with the campaign guidance. |
| `too-many-bones` | Tyrant × gearloc matrix | Modular | No | Strong modular fit. |
| `undaunted-normandy` | Scenario × side matrix | Neither / mixed | No | This is scenario-based rather than campaign-based, and not really modular in the same way as hero-villain combinatorics. The current view is fine. |
| `unsettled` | Planet × task matrix | Neither / mixed | No | This is modular content combination, but not hero-vs-villain or campaign. The matrix still works well enough, so I would leave it alone. |

## Recommended Later UI Changes

If you want to act on this distinction later, these are the tabs I would actually change:

- `arkham-horror-lcg`
  Make campaign/scenario progression the primary view; keep investigator matrices as secondary analysis.
- `isofarian-guard`
  Promote chapter progress and time spent per chapter; demote or remove the campaign × guard matrix.
- `kingdoms-forlorn`
  Shift toward campaign progression once chapter/scenario-level data exists; current matrix is only a placeholder-level fit.
- `oathsworn`
  Promote story/encounter progression tables over the encounter × character matrix.
- `robin-hood`
  Promote adventure progression tables over the adventure × character matrix.

## Keep As-Is

These tabs already match their shape well enough and do not look like they need a modular/campaign-driven redesign:

- `final-girl`
- `spirit-island`
- `death-may-die`
- `bullet`
- `too-many-bones`
- `skytear-horde`
- `deckers`
- `burncycle`
- `star-trek-captains-chair`
- `tainted-grail`
- `earthborne-rangers`
- `mage-knight`
- `mandalorian-adventures`
- `paleo`
- `robinson-crusoe`
- `undaunted-normandy`
- `unsettled`

## Open Judgement Calls

These are the ones where the classification is a bit subjective:

- `cloudspire`
  Mixed game modes make a single classification awkward.
- `elder-scrolls`
  Current tagging is more about campaign-run metadata than chapter progression.
- `mistfall`
  Quest progression matters, but not in the same way as a long-form campaign tracker.
