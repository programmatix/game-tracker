## Game Tracker (Solid + Vite)

Pulls a BoardGameGeek user profile (hardcoded to `stony82` for now) and shows a paginated table of plays, including the full raw play data per row.

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Notes

- The username is currently hardcoded in `src/App.tsx`.
- The app currently reads plays from the checked-in `data.xml` file via a Vite `?raw` import and paginates client-side.
