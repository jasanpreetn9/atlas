# Routes

Each `+page.ts` `load()` fetches page-specific data through `createHttpApi(fetch)`
with `Promise.allSettled`, so partial failures degrade to empty results plus a
`loadErrors` list. Shared data (series, movies, queue, folders, profiles) comes
from the `library` store, not from `load()`. `+page.svelte` derives view-models
via `src/lib/view` and renders markup ported from the design.

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
Search (opens the modal); Refresh & Scan (`RefreshSeries` / `RefreshMovie`).
Stubbed toasts (`notYet(label)`): Manual Import, Preview Rename, Delete, Delete
file, Edit quality.

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

- Queue: `queueRow`; toolbar with Remove Selected, Pause all, and an auto-refresh
  label.
- History: `historyRows` (ungrouped, one row per event); filter chips `All`,
  `Grabbed`, `Imported`, `Failed`, `Deleted` (`matchesHistFilter`). The design's
  fifth filter was "Upgraded", which has no reliable signal in real payloads, so
  it was swapped for "Deleted".
- Blocklist: `blocklistRows`; a "Clear all" button.

Actions are all stubbed toasts (the design's Activity is toast-only, and Atlas
defers destructive operations). The exception is the History "Details" toast,
which shows the real quality, score and indexer. Data on all three tabs is live.

---

## `+layout.svelte` / `+error.svelte`

The layout renders `Sidebar`, `Header`, `<main style="padding:24px 28px 72px">`,
`Toasts` and the three modals. `onMount` calls `library.load()` and a one-shot
health count. An `$effect` writes `--rowpad`, `--poster`, `--sidebar` and
`data-theme`, and persists the chrome prefs. `disks` and `wantedCount` are
derived here and passed to `Sidebar`.
