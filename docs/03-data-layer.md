# Data layer

The data layer has four parts: the type contract (`api/*.ts`), the browser client
(`api/client.ts`), the server implementation (`server/*` plus the proxy routes),
and the stores that cache the results.

---

## `src/lib/api/`: contract + client

### Type files

`common.ts`, `sonarr.ts`, `radarr.ts` hold plain `interface` and union types,
transcribed field-for-field from the Sonarr v3 / Radarr v3 OpenAPI specs. ISO
strings for `date-time`. No runtime code, so they import from anywhere (browser,
server, `view/`). A few spec-required fields were relaxed to optional after
reconciling against real v4 payloads (`nextAiring`, `diskspace.id`,
`secondaryYear`, `sceneName`, and others).

Key types: `SeriesResource`, `SeasonResource`, `EpisodeResource`,
`EpisodeFileResource`, `SonarrQueueResource`, `SonarrHistoryResource`,
`SonarrReleaseResource`; `MovieResource`, `MovieFileResource`, `RadarrRatings`,
`RadarrQueueResource`, `RadarrHistoryResource`, `RadarrReleaseResource`;
`QualityModel`, `MediaCover`, `PagingResource<T>`, `DiskSpaceResource`,
`RootFolderResource`, `HealthResource`, `CommandResource`, `BlocklistResource`.

### `client.ts`: the seam every screen goes through

```ts
export const api: AtlasApi = createHttpApi(); // default instance
export function createHttpApi(fetchFn = fetch): AtlasApi;
```

It talks only to `/api/sonarr/*` and `/api/radarr/*` (same origin, no key). Pass
SvelteKit's `fetch` inside a `load()` (`createHttpApi(fetch)`); use the default
`api` export in components.

Unified reads fan out to both apps and concat: `getQueue`, `getHistory`,
`getBlocklist`, `getCalendar`, `getRootFolders`, `getDiskSpace`, `getHealth`,
`getQualityProfiles`. Each tolerates one app being unconfigured and throws only
when both are (the `both()` helper).

Kind-scoped reads and writes hit one app: `getEpisodes`, `getEpisodeFiles`,
`getSeriesHistory` (Sonarr); `getMovieHistory` (Radarr); `getWantedMissing` /
`getWantedCutoff(kind)`; `getReleases(subject)`.

Writes: `pushRelease(kind, guid, indexerId)` (grab); `updateSeries` /
`updateMovie` (PUT, which needs the whole resource back, not a patch);
`setEpisodeMonitored(ids, monitored)`; `sendCommand(app, { name, ... })`.
`AppNotConfigured` is thrown on a `503` from the proxy.

Notable endpoint facts encoded here:

| Need                                                 | Endpoint                                                       | Note                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| per-episode files (mediaInfo, quality, group, score) | `GET /episodefile?seriesId=`                                   | `/episode` alone has none of this                                        |
| per-title history                                    | `GET /history/series?seriesId=`, `GET /history/movie?movieId=` | the `/history?seriesId=` filter is silently ignored; `?episodeId=` works |
| interactive search                                   | `GET /release?seriesId=&episodeId=` / `?movieId=`              | slow (indexer round-trip); the proxy gives it 55s and no cache           |
| commands                                             | `POST /command  { name, ... }`                                 | for example `EpisodeSearch`, `MissingMoviesSearch`, `RefreshSeries`      |

---

## `src/lib/server/`: server-only implementation

Cannot be imported from client code (SvelteKit enforces the `lib/server/`
boundary, and `config.ts` also imports `$env/dynamic/private`).

### `config.ts`

`getSonarrConfig()` and `getRadarrConfig()` return `{ origin, baseUrl, apiKey }`
or `null`. `baseUrl` is `origin + '/api/v3'`. Trailing slashes are stripped.
`isAnyArrConfigured()` reports whether either is set.

### `http.ts`

`arrRequest(cfg, path, opts)` is the real outbound `fetch`.

- Adds `X-Api-Key: cfg.apiKey` and `accept: application/json`.
- `timeoutMs` defaults to 8000, via `AbortController`.
- `cacheMs` defaults to 8000 (`0` disables it): an in-memory `Map` keyed by full
  URL, GET and 2xx only. It smooths repeated loads and rides over brief upstream
  stalls.
- A non-2xx response throws `ArrError { status, statusText, url, body }`. A
  network failure or abort throws `ArrError(0, 'Network Error', url, reason)`.

`arrPing(cfg)` does `GET {origin}/ping`, no key, 5s timeout; used by
`/api/status`.

### `proxy.ts`

`proxyArr(app, cfg | null, event)`:

- `cfg === null` returns `503 { error: "<app> is not configured" }`.
- Only `GET`, `POST`, `PUT`, `DELETE`; rejects paths containing `..`.
- Parses a JSON body for POST and PUT; forwards `event.url.searchParams` as query.
- For `path === 'release'` (or `release/...`) it uses `timeoutMs: 55_000` and
  `cacheMs: 0`.
- On `ArrError` it relays the upstream status (or `502`) and the JSON body;
  string bodies over 500 chars are truncated so a stray HTML error page is not
  echoed whole.

### `sonarr.ts` / `radarr.ts`

Thin typed wrappers, one function per endpoint. Mostly vestigial now that the
proxy forwards any path generically, kept for the few places a server `load`
might want typed access.

---

## `src/routes/api/`: the endpoints

| Route                             | Handler                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `api/sonarr/[...path]/+server.ts` | `GET=POST=PUT=DELETE = event => proxyArr('sonarr', getSonarrConfig(), event)` |
| `api/radarr/[...path]/+server.ts` | same for Radarr                                                               |
| `api/status/+server.ts`           | pings both, returns `{ sonarr:{configured,reachable}, radarr:{...}, live }`   |

---

## Stores: `src/lib/stores/`

Rune-backed singletons. Each is a class with `$state` fields, exported as one
instance.

### `library.svelte.ts`: the shared snapshot

```ts
library.series  library.movies  library.queue
library.diskSpace  library.rootFolders  library.profileNames  // Map<id, name>
library.loading  library.error  library.loadedAt
library.load({ force?, staleMs = 15_000 })   library.refresh()
```

`load()` runs `Promise.allSettled` over `getSeries`, `getMovies`, `getQueue`,
`getDiskSpace`, `getRootFolders`, `getQualityProfiles`. `error` is
`series.rejected || movies.rejected`. An `#inflight` guard dedupes concurrent
calls, and within `staleMs` the call is a no-op unless `force` is set.

It is called once in `+layout.svelte` `onMount`. Pages read `library.*` directly
and mutate it in place after a write (`library.movies[idx] = saved`); index
assignment on a `$state` array is reactive.

### `store.svelte.ts`: UI and overlay state

| Group                                | Fields                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| chrome (persisted to `localStorage`) | `theme`, `density`, `posterSize`, `sidebarExpanded`                                                               |
| search                               | `query` (from the header box)                                                                                     |
| overlays                             | `srch` (`SearchSubject \| null`), `srchSort`, `epModal`, `epModalTab`, `epColsOpen`, `epShow`, `dlg`, `dlgTarget` |
| session data                         | `toasts`, `grabs` (`guid` to `'grabbing' \| 'grabbed'`), `extraQueue`, `added`, `overrides`                       |

Actions: `toast()`, `grab(release, { override? })` (real `POST /release`),
`openSearch()` / `closeSearch()`, `openEp()` / `closeEp()`, `toggleTheme()`,
`cyclePoster()`, `toggleEpColumn()`. `EP_COLUMNS`, the episode-table column
definitions (with `num`, `title` and `status` locked on), is exported here too.

Persistence and CSS-var application (`--rowpad`, `--poster`, `--sidebar`,
`data-theme`) live in `+layout.svelte`'s `$effect`, not in the store.
