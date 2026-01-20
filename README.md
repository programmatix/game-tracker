## Game Tracker (Solid + Vite)

Pulls a BoardGameGeek user profile (hardcoded to `stony82` for now) and shows a paginated table of plays, including the full raw play data per row.


## BGG data

https://boardgamegeek.com/xmlapi2/plays?username=stony82
https://boardgamegeek.com/applications


## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.


## Firebase Hosting

```bash
pnpm firebase:deploy:hosting
```

## Notes

- The username is currently hardcoded in `src/App.tsx`.
- The app fetches plays from the BGG XML API and caches them in `localStorage` (set `BGG_TOKEN` in `.env` if needed).

## Scripts

See `scripts/bgg-plays.md` for how to fetch plays from BGG.