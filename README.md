# Atlas

A SvelteKit frontend for real Sonarr (TV) and Radarr (movies) instances. It
provides one unified library, dashboard, calendar, activity feed and "wanted"
view over both apps. It is a 1:1 port of the original design prototype, wired to
live data.

## Status

| Screen                                       | Route           | State                       |
| -------------------------------------------- | --------------- | --------------------------- |
| Dashboard                                    | `/`             | built                       |
| Library (poster / overview / table)          | `/library`      | built                       |
| Detail (series seasons/episodes, movie file) | `/library/[id]` | built                       |
| Wanted (missing, cutoff unmet)               | `/wanted`       | built                       |
| Activity (queue, history, blocklist)         | `/activity`     | built                       |
| Add New (search, add dialog)                 | `/add`          | built                       |
| Calendar (month grid, agenda)                | `/calendar`     | built                       |
| Discover, System                             | n/a             | nav entries only, not built |

Action buttons are wired to the live instances where that is safe (monitor
toggles, searches, refresh, interactive-search grab, add). Destructive or
multi-step flows (manual import, rename, delete, bulk edit) show a "not wired up
yet" toast for now.

## To do

Screens not built:

- [ ] `/system`: status, tasks, backups, updates, logs, health tabs (client methods exist, unused)
- [ ] `/discover`: deferred, no direct *arr endpoint (would need Radarr import lists or recommendations)

Actions that currently only show a toast:

- [ ] Detail: Delete, Delete file, Preview Rename, Manual Import, Edit quality/language, Media info
- [ ] Library mass editor: Quality Profile, Root Folder, Tags (Monitor and Unmonitor also toast)
- [ ] Activity: Remove from queue, Remove & blocklist, Pause, Mark as Failed, Remove from blocklist, Clear all, Remove Selected
- [ ] Global Edit / Delete dialog for Detail (`store.dlg` / `dlgTarget` state exists, no component)

Polish:

- [ ] List virtualization for large libraries
- [ ] Sort-direction toggle (asc / desc)
- [ ] Command palette (Cmd+K)
- [ ] Real custom-filter builder (currently adds a placeholder chip)
- [ ] Confirm dialogs for the destructive actions above
- [ ] `/add` result-card poster thumbnails render faint against the dark box

## Quick start

```sh
cp .env.example .env      # fill in the four vars below
npm install
npm run dev               # http://localhost:5173
```

`.env` (git-ignored) needs at least one of the two apps:

```
SONARR_URL=https://sonarr.example.com
SONARR_API_KEY=...        # Sonarr: Settings > General > Security > API Key
RADARR_URL=https://radarr.example.com
RADARR_API_KEY=...
```

Screens that need the unconfigured app render an empty state.

## Scripts

```sh
npm run dev       # vite dev server
npm run check     # svelte-kit sync && svelte-check; keep at 0 errors / 0 warnings
npm run format    # prettier --write .
npm run build     # production build (adapter-auto)
npm run preview   # preview the production build
```

## How it works

API keys stay on the server. The browser only calls same-origin proxy routes
(`/api/sonarr/*` and `/api/radarr/*`), and the SvelteKit server attaches the key
and forwards upstream. Anything under `src/lib/server/` is server-only.

Every screen reads through one seam, `src/lib/api/client.ts`
(`createHttpApi(fetch)`), which talks only to those proxy routes. Unified reads
fan out to both apps and tolerate one being absent.

`src/lib/stores/library.svelte.ts` is a rune store that loads series, movies,
queue and folders once on mount. Pages read from it and show skeletons while it
fills.

`src/lib/view/*` are pure mappers that turn raw Sonarr and Radarr resources into
display models. No side effects, no fetching.

Styling is inline `style=""` ported verbatim from the design, plus CSS custom
properties and a few hover utility classes in `src/lib/styles/atlas.css`. There
is no component framework.

## Layout

```
src/lib/
  api/         Sonarr/Radarr type definitions + the browser data client
  server/      server-only: config (reads env), http (adds the key), proxy
  stores/      rune singletons: store (UI/overlays), library (shared data), nav
  view/        pure resource-to-display mappers
  components/  Svelte components + modals/ (rendered once in the layout)
  styles/      atlas.css: design tokens, resets, hover utilities
src/routes/
  api/         the /api/{sonarr,radarr}/[...path] proxy + /api/status
  +layout.*    shell (sidebar + header + main + toasts + modals)
  ...          one folder per screen
```

## Documentation

Full wiki in [`docs/`](docs/WIKI.md):

- [Architecture](docs/01-architecture.md), [Project structure](docs/02-project-structure.md),
  [Data layer](docs/03-data-layer.md), [View & UI layer](docs/04-view-and-ui.md),
  [Routes](docs/05-routes.md), [Conventions & recipes](docs/06-conventions.md)

## Stack

SvelteKit 2, Svelte 5 (runes), TypeScript, Vite 8, `adapter-auto`. SvelteKit
config is inline in `vite.config.ts`; there is no `svelte.config.js`. SSR is on
with defaults.
