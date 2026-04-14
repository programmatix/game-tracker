# Aligning With Spreadsheet

## Goal

Compare the purchase spreadsheet against the current codebase and identify:

- games whose aggregate family price needs updating
- games that appear in the spreadsheet but do not yet exist in the app in any meaningful way
- any obvious naming/alignment problems that would block that comparison

## Relevant Sources

- Spreadsheet loader: `src/purchaseSpreadsheet.ts`
  - This fetches the Google Sheet as CSV.
- Aggregate family price registry: `src/purchaseGameFamilies.ts`
  - This is the main code representation of spreadsheet-derived family prices.
  - Comment says prices are aggregated from spreadsheet Net column `F`.
- Per-game content definitions: `src/games/*/content.yaml`
  - Some of these use `spreadsheetCell` references for box-level costs.
- Cost parsing: `src/contentCosts.ts`
  - Supports raw numeric values and spreadsheet-cell-backed values.
- Existing game folders: `src/games/*`

## What To Check

### 1. Aggregate family prices

Check whether any family in `src/purchaseGameFamilies.ts` looks out of sync with the spreadsheet.

Focus on:

- changed price totals
- renamed spreadsheet family labels
- missing aliases that would cause matching problems

### 2. Missing games

Check whether the spreadsheet contains a game family that should now have app support but does not.

For this review, treat these as different levels:

- Already supported: has a dedicated folder under `src/games/*`
- Partially represented: appears in `src/purchaseGameFamilies.ts` but has no dedicated game folder
- Missing entirely: present in spreadsheet but not represented in either place

### 3. Per-box cost references

For games that already exist, note any obvious cases where `content.yaml` cost entries should probably use spreadsheet-backed values or where existing `spreadsheetCell` references appear stale or inconsistent.

## Notes

- The comparison should be against the spreadsheet data itself, not memory or assumptions.
- Prefer matching by `spreadsheetFamily` first, then aliases, then obvious exact-name equivalents.
- A game being present in `src/purchaseGameFamilies.ts` is not the same as having full game support in the UI.
- If a spreadsheet row groups multiple products into one family, preserve that grouping unless there is a clear existing split in code.
- If the spreadsheet and app naming differ but clearly refer to the same family, report it as an alignment issue rather than inventing a rename on the spot.
