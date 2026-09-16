# Routes

Each `+page.ts` `load()` fetches page-specific data through `createHttpApi(fetch)`
with `Promise.allSettled`, so partial failures degrade to empty results plus a
`loadErrors` list. Shared data (series, movies, queue, folders, profiles) comes
from the `library` store, not from `load()`. `+page.svelte` derives view-models
via `src/lib/view` and renders the markup for each screen directly.

---

## `/` : Dashboard (`+page.svelte` + `+page.ts`)

Loads: `getCalendar(today, +21d)`, `getHistory({ pageSize: 100 })`,
`getHealth()`, `getWantedMissing('series')`, `getWantedMissing('movie')`.

Renders: stat cards (Movies, Series, Library size, Wanted; the last comes from
`deriveSeriesStatus` / `deriveMovieStatus === 'missing'` over the library); a
conditional, warn-accented "Needs attention" block (`missingRows` plus
`failureRows` from `view/wanted`); Recently added (poster strip); Upcoming (next 7
airing from calendar); Health; Downloading (`queueRow`, 30s poll); Disk usage; and
Recent grabs (`groupGrabs`, condensed by show and event).

Actions: "Refresh all" runs `RefreshSeries` and `RefreshMovie`; per-row "Search"
and "Retry" run `EpisodeSearch` or `MoviesSearch`. All real.

---

## `/library` (`+page.svelte`, no `+page.ts`, reads the `library` store)

Local state: `view` (`poster` / `overview` / `table`), `sort`, `filter` (`all`,
`monitored`, `unmonitored`, `downloaded`, `missing`, `downloading`, `cutoff`),
`typeFilter`, `filtersOpen`, `mass` and `sel` (mass editor), `saved`,
`confirmOpen`.

Data flow: `library.series` / `.movies` go through `seriesToMediaItem` /
`movieToMediaItem`, then `pool` (type plus header search), then `counts`, then
`filtered` (status plus sort), then `rows`. `downloading` maps to status
`downloading`; `cutoff` maps to status `upgrading`.

Actions: Refresh (`library.refresh()`); Update Library, RSS Sync and Search All
Monitored run real commands. Mass-editor Monitor, Unmonitor and Delete are toasts
only, since the bulk dialog is not built. There are loading-skeleton, "Couldn't
reach Sonarr / Radarr, Retry" and empty states.

---

## `/library/[id]` : Detail (`+page.svelte` + `+page.ts`)

`params.id` is `s:<n>` or `m:<n>` (`parseMediaId`). `series` / `movie` resolve
from `library` by id; a `found` guard shows "Loading..." or "Couldn't find that
title".

Loads: for a series, `getEpisodes`, `getEpisodeFiles`, `getSeriesHistory` (all
`allSettled`, falling back to `[]`). For a movie, `getMovieHistory`
(`.catch(() => [])`).

Renders: a hero band (large faded title, `tvdb:` / `tmdb:` id, attribution);
poster with title, year, runtime, rating, genres; meta chips (path, size,
profile, monitored, network or studio); overview; action buttons; and external
links (TVDb/IMDb or TMDb/IMDb). Tabs are Seasons/Files and History.

- series: collapsible season `<section>`s (progress bar plus `ActionCluster`),
  each wrapping a configurable episode `<table>` (`epCols` from `store.epShow`;
  the gear opens `TableOptions`; the title cell opens `EpisodeModal`).
  `buildSeasons` joins `/episodefile` data by `episodeFileId`.
- movie: a "Movie file" card with a real media-info grid and "Alternative titles".

Real actions: monitor toggle for series, movie, season and episode (real PUT via
`updateSeries` / `updateMovie` / `setEpisodeMonitored`); Automatic Search
(`SeriesSearch` / `MoviesSearch` / `SeasonSearch` / `EpisodeSearch`); Interactive
Search (opens the modal); Refresh & Scan (`RefreshSeries` / `RefreshMovie`);
Manual Import (scans the series folder via `ManualImportModal`); Preview Rename
(`RenamePreviewModal`); Delete (title or file); Edit quality/language on a file
(no rename). Nothing on this page is stubbed.

---

## `/add` (`+page.svelte` + `+page.ts`)

Loads: quality profiles and root folders for both apps -
`getQualityProfiles('series'|'movie')`, `getRootFolders('series'|'movie')` -
via `allSettled`, each falling back to `[]`. The add dialog reads these
straight from `data`; there's no client-side refetch.

Local state: `query`, debounced 350ms into `runSearch`, which calls
`api.lookupSeries` and `api.lookupMovie` in parallel and merges the results,
ranking exact and prefix title matches first and sorting the rest by year
descending, capped at 24. A `seq` counter drops stale responses when a
newer keystroke has already fired. Each lookup failure is swallowed to `[]`
in the `.catch`, so the `error` state it feeds is effectively never set;
a failed lookup just reads as "no results" rather than surfacing the
"Lookup failed" message. `inLibrary` is checked against `library.series` /
`library.movies` by `tvdbId` / `tmdbId`, so already-added titles show
"In library" instead of "Add".

Add dialog: clicking "Add" opens `dlg` with defaults seeded from the first
root folder and quality profile for that kind, `monitor` defaulting to
"All Episodes" for series or "Movie Only" for movies. Series fields add
Series Type and Season Folder; movie fields add Minimum Availability. Both
share a "Start search after adding" toggle.

Real actions: confirming the dialog calls `api.addSeries` or `api.addMovie`
with the resource from the lookup plus the form fields, then toasts, closes
the dialog and calls `library.refresh()`. Both are real, live-affecting API
calls (no stub here) - unlike delete/edit actions elsewhere, adding is
additive and idempotent per the [convention](./06-conventions.md#real-vs-stubbed).

---

## `/calendar` (`+page.svelte` + `+page.ts`)

`?m=` is a month offset from the current month (`go(offset)` navigates via
`goto('?m=...')`, `keepFocus`/`noScroll`). `+page.ts` turns that into an
anchor month and a six-week grid window (`gridStart` at the first
Sunday on/before the 1st, 42 days out), so Month view never needs a
client-side refetch when scrolling within the loaded month.

Loads: `getCalendar(gridStart, gridEnd)` for that window; `loadError` is set
on failure and renders a "Couldn't load the calendar" block in place of
the grid.

Renders: a Month/Agenda toggle and Previous/Today/Next controls (`go`).
`calendarEvents` (`src/lib/view/calendar.ts`) flattens the loaded items into
dated events, tagged TV or M, with status derived via `deriveEpisodeStatus`
/ `deriveMovieStatus` against the live queue (`queueIndex` over
`store.extraQueue` plus `library.queue`). Month view buckets events by
`dayKey` into the grid, showing up to 3 per cell plus a "+N more" that
switches to Agenda. Agenda view lists only the days that fall in the
current month, each event linking to its Detail page
(`/library/s:<id>?ep=<id>` or `/library/m:<id>`).

No actions beyond navigation; every event is a link into Detail; nothing
here calls a search or grab command directly.

---

## `/wanted` (`+page.svelte` + `+page.ts`)

Loads: `getWantedMissing('series'|'movie')` and
`getWantedCutoff('series'|'movie')` at `pageSize: 200`. Cutoff for series adds
`includeEpisodeFile` so the row can show the current quality.

Renders: Missing and Cutoff Unmet tabs (counts are `totalRecords`); Search
Selected and Search All buttons with a confirm bar; a row list (checkbox, tag,
title link, code, air, detail, status badge, `ActionCluster`) sorted by air date
descending. `buildWantedRows` builds the rows.

Real actions: per-row monitor toggle; Automatic Search (`EpisodeSearch` /
`MoviesSearch`); Interactive Search (modal); Search Selected (the same commands on
ticked rows); Search All, which after the confirm bar runs
`Missing{Episode,Movies}Search` or `CutoffUnmet{Episode,Movies}Search`. The
History action calls `goto('/activity')`.

---

## `/activity` (`+page.svelte` + `+page.ts`)

The initial tab comes from `?tab=queue|history|blocklist`.

Loads: `getHistory({ pageSize: 100 })`, `getBlocklist()`. The queue is the
`library` snapshot plus a 30s live poll.

Renders three tabs:

- Queue: `queueRow`; toolbar with Remove Selected and an auto-refresh label.
- History: `historyRows` (ungrouped, one row per event); filter chips `All`,
  `Grabbed`, `Imported`, `Failed`, `Deleted` (`matchesHistFilter`). A fifth
  filter, "Upgraded", has no reliable signal in real payloads, so it was
  swapped for "Deleted".
- Blocklist: `blocklistRows`; a "Clear all" button.

Queue rows carry a checkbox (`qSel`); Remove Selected, per-row Remove from
queue and Remove & blocklist (`DELETE /queue/{id}` or `/queue/bulk`, with
`removeFromClient` and `blocklist` query flags) are real. History's Mark as
Failed calls `POST /history/failed/{id}`. Blocklist's per-row remove and
Clear all call `DELETE /blocklist/{id}` or `/blocklist/bulk`. Blocklist and
bulk-queue removals, Mark as Failed and Clear all confirm first through the
shared `ConfirmModal`; single removes don't, matching upstream Sonarr/Radarr.
There's no Pause / Pause all: pausing a download is a download-client
capability, not something the *arr REST API exposes, so the buttons were
removed rather than left as permanent toasts. TV queue rows get a Manual
Import action that opens the same `ManualImportModal` as the Detail page
(scoped to that series' `outputPath`); movie rows have no Manual Import
action at all, since Radarr has no manual-import endpoint equivalent wired up
client-side. The History "Details" action is a toast showing the real
quality, score and indexer. Data
on all three tabs is live.

---

## `/system` (`+page.svelte` + `+page.ts`)

Loads everything per app so Sonarr and Radarr sections sit side by side:
`getSystemStatus`, `status` (ping), `getHealth`, `getTasks`, `getUpdates`,
`getBackups`, `getLogFiles`. Every call is a GET, so the proxy's 15s cache
smooths repeat visits; `apps` is whichever of Sonarr/Radarr `data.ping` says
is configured.

Six tabs (`statusRows`, `healthRows`, `taskRows`, `updateRows`, `backupRows`,
`logRows` from `view/system.ts`), each a flat `SysRow` list rendered as
label / value / meta rows. Health carries a count badge on its tab.

Toolbar: Refresh (`invalidateAll()`), Copy info (writes a plain-text summary
to the clipboard), Restart and Shutdown. Restart and Shutdown act on every
configured app at once (`POST /system/restart` / `/system/shutdown`),
confirm first through `ConfirmModal`, and don't fail loudly if the request
itself errors - a restarting or shutting-down app can drop the connection
before answering, which isn't a failure to second-guess. Both toolbar
buttons are disabled when nothing is configured.

---

## `+layout.svelte` / `+error.svelte`

The layout renders `Sidebar`, `Header`, `<main style="padding:24px 28px 72px">`,
`Toasts` and the three modals. `onMount` calls `library.load()` and a one-shot
health count. An `$effect` writes `--rowpad`, `--poster`, `--sidebar` and
`data-theme`, and persists the chrome prefs. `disks` and `wantedCount` are
derived here and passed to `Sidebar`.
