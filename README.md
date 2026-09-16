# Atlas

A SvelteKit frontend for real Sonarr (TV) and Radarr (movies) instances. It
provides one unified library, dashboard, calendar, activity feed and "wanted"
view over both apps, wired to live data.

## Status

| Screen                                       | Route           | State                     |
| -------------------------------------------- | --------------- | ------------------------- |
| Dashboard                                    | `/`             | built                     |
| Library (poster / overview / table)          | `/library`      | built                     |
| Detail (series seasons/episodes, movie file) | `/library/[id]` | built                     |
| Wanted (missing, cutoff unmet)               | `/wanted`       | built                     |
| Activity (queue, history, blocklist)         | `/activity`     | built                     |
| Add New (search, add dialog)                 | `/add`          | built                     |
| Calendar (month grid, agenda)                | `/calendar`     | built                     |
| System (status, health, tasks, ...)          | `/system`       | built                     |
| Discover                                     | n/a             | nav entry only, not built |

Action buttons are wired to the live instances where that is safe (monitor
toggles, searches, refresh, interactive-search grab, add, edit and delete a
title, delete an episode or movie file, preview and run a rename, media info,
edit a file's quality/language, manual import for a series, the Library mass
editor for monitor, quality profile, root folder and delete, Activity's queue
and blocklist removals and mark-as-failed, and System's restart and
shutdown). The remaining multi-step flows (mass tags, pause) show a "not
wired up yet" toast for now.

## To do

Screens not built:

- [ ] `/discover`: deferred, no direct *arr endpoint (would need Radarr import lists or recommendations)

Actions that currently only show a toast:

- [ ] Library mass editor: Tags (Monitor, Unmonitor, Quality Profile, Root Folder and Delete are real via the `/series/editor` and `/movie/editor` endpoints)
- [ ] Activity: Pause / Pause all (no generic Sonarr/Radarr endpoint; pausing is a download-client capability, not exposed by the *arr REST API), Manual Import from a queue item (Remove from queue, Remove & blocklist, Remove Selected, Mark as Failed, Remove from blocklist and Clear all are all real now)

Polish:

- [ ] List virtualization for very large libraries (the Library page paginates for now, 24 / 48 / 96 / all per page, persisted)
- [ ] Sort-direction toggle (asc / desc)
- [ ] Command palette (Cmd+K)
- [ ] Real custom-filter builder (currently adds a placeholder chip)
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
npm run build     # production build (adapter-node)
npm run preview   # preview the production build
```

## Docker

Prebuilt images are published to GHCR at each tagged release:
`ghcr.io/jasanpreetn9/atlas:v0.1` / `ghcr.io/jasanpreetn9/atlas:latest`
(private package — `docker login ghcr.io` / `podman login ghcr.io` with a
token that has `read:packages` first).

```sh
cp .env.example .env      # fill in the four vars below
docker compose up --build -d
```

This builds a multi-stage image (`Dockerfile`): the build stage runs
`npm ci && npm run build`, and the runtime stage copies only the resulting
`build/` output onto a plain `node:24-alpine` base — `adapter-node`'s output
is fully self-contained (no `node_modules`, no npm, no shell needed to run
it). The container runs as the image's built-in non-root `node` user.

`docker-compose.yml` also locks the container down since it needs no
filesystem writes or elevated privileges: `read_only: true`, `cap_drop: ALL`,
`security_opt: no-new-privileges:true`, and a `tmpfs` mount for `/tmp`. It
healthchecks against `/api/status`.

Without compose:

```sh
docker build -t atlas .
docker run -d --name atlas -p 3000:3000 --env-file .env \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  atlas
```

Runtime config (adapter-node): `PORT` (default `3000`), `HOST` (default
`0.0.0.0`), and `ORIGIN` if the app sits behind a reverse proxy on a
different external URL.

### Podman

Works the same way, rootless by default. Podman's default build format
(OCI) silently drops `HEALTHCHECK`, so pass `--format docker` to keep it:

```sh
brew install podman podman-compose   # macOS; first time only
podman machine init && podman machine start   # macOS; first time only

cp .env.example .env
podman-compose up -d --build
```

Without compose:

```sh
podman build --format docker -t atlas .
podman run -d --name atlas -p 3000:3000 --env-file .env \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  atlas
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

Styling is inline `style=""` on each element, plus CSS custom properties and a
few hover utility classes in `src/lib/styles/atlas.css`. There is no component
framework.

## Layout

```
src/lib/
  api/         Sonarr/Radarr type definitions + the browser data client
  server/      server-only: config (reads env), http (adds the key), proxy
  stores/      rune singletons: store (UI/overlays), library (shared data), nav
  view/        pure resource-to-display mappers
  components/  Svelte components + modals/ (rendered once in the layout)
  styles/      atlas.css: CSS custom properties, resets, hover utilities
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

SvelteKit 2, Svelte 5 (runes), TypeScript, Vite 8, `adapter-node`. SvelteKit
config is inline in `vite.config.ts`; there is no `svelte.config.js`. SSR is on
with defaults.
