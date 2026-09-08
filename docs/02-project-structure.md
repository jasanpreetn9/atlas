# Project structure

```
src/
├── app.html                    shell: Geist fonts, pre-paint theme script
├── lib/
│   ├── api/                    type contract + browser data client
│   │   ├── common.ts           shared *arr types (QualityModel, PagingResource, Health, ...)
│   │   ├── sonarr.ts           Sonarr v3 types (SeriesResource, EpisodeResource, ...)
│   │   ├── radarr.ts           Radarr v3 types (MovieResource, MovieFileResource, ...)
│   │   └── client.ts           AtlasApi interface + createHttpApi(fetch); the UI's data seam
│   ├── server/                 SERVER ONLY. holds/uses the API key
│   │   ├── config.ts           reads $env/dynamic/private, returns ArrConfig | null
│   │   ├── http.ts             arrRequest(): real fetch, X-Api-Key, timeout, GET cache; arrPing()
│   │   ├── proxy.ts            proxyArr(): shared body of the /api/* route handlers
│   │   ├── sonarr.ts           typed Sonarr endpoint wrappers (largely unused; proxy is generic)
│   │   └── radarr.ts           typed Radarr endpoint wrappers
│   ├── stores/                 rune-backed singletons (Svelte 5 $state)
│   │   ├── store.svelte.ts     UI/overlay state: theme, density, search modal, toasts, grabs
│   │   ├── library.svelte.ts   shared data snapshot: series, movies, queue, folders, profiles
│   │   └── nav.ts              sidebar nav config + activeNavKey(pathname)
│   ├── view/                   pure resource-to-display mappers (no side effects, no fetching)
│   │   ├── format.ts           primitives: formatBytes, episodeCode, airLabel, relativeAge
│   │   ├── status.ts           DerivedStatus + STATUS_* maps + derive{Series,Movie,Episode}Status
│   │   ├── media.ts            unified MediaItem + seriesToMediaItem/movieToMediaItem + posterUrl
│   │   ├── episodes.ts         buildSeasons(): episodes + files into season groups (detail page)
│   │   ├── disk.ts             rootFolderDisks() / diskSummary(): root folders into disk bars
│   │   ├── activity.ts         queue rows + grouped grabs + history rows + blocklist rows
│   │   └── wanted.ts           wanted rows + dashboard "needs attention" (missing / failures)
│   ├── components/             Svelte components
│   │   ├── Sidebar.svelte      left nav + disk summary + badge counts
│   │   ├── Header.svelte       top bar: search box (feeds store.query), theme toggle
│   │   ├── Poster.svelte       lazy <img> with fallback text + scrim snippets
│   │   ├── ActionCluster.svelte  compact row of icon buttons (from the design's ActionCluster)
│   │   ├── Toasts.svelte       renders store.toasts
│   │   └── modals/             rendered once in +layout.svelte, driven by store
│   │       ├── InteractiveSearch.svelte   live indexer results, Grab / Override
│   │       ├── EpisodeModal.svelte        episode details + per-episode history
│   │       └── TableOptions.svelte        episode-table column picker
│   ├── styles/
│   │   └── atlas.css           design tokens (:root vars), resets, @keyframes, .at-* hover classes
│   └── index.ts                empty (SvelteKit $lib marker)
└── routes/
    ├── +layout.svelte          shell: Sidebar + Header + <main> + Toasts + 3 modals; boots library
    ├── +page.svelte / +page.ts Dashboard
    ├── +error.svelte           error boundary
    ├── api/
    │   ├── sonarr/[...path]/+server.ts   GET/POST/PUT/DELETE, calls proxyArr('sonarr', ...)
    │   ├── radarr/[...path]/+server.ts   GET/POST/PUT/DELETE, calls proxyArr('radarr', ...)
    │   └── status/+server.ts             { sonarr:{configured,reachable}, radarr:{...}, live }
    ├── library/
    │   ├── +page.svelte         Library: poster / overview / table views, filters, mass editor
    │   └── [id]/+page.svelte / +page.ts   Detail: series seasons/episodes or movie file
    ├── wanted/+page.svelte / +page.ts     Wanted: Missing / Cutoff Unmet
    └── activity/+page.svelte / +page.ts   Activity: Queue / History / Blocklist
```

## Not built yet

`nav.ts` lists eight destinations. Five routes exist: `/`, `/library`,
`/library/[id]`, `/wanted`, `/activity`. `/add`, `/discover`, `/calendar` and
`/system` have nav entries but no `+page`, so they 404. Links to them are wired in
anticipation; for example the Activity history action points at `/activity`,
which is real, but the sidebar "Calendar" link is not yet.

## Notes

`.svelte-kit/` is generated (`svelte-kit sync`, which runs before `npm run
check`). `src/lib/api/*` are hand-written from the Sonarr v3 / Radarr v3 OpenAPI
specs; the raw specs are not vendored into the repo.
