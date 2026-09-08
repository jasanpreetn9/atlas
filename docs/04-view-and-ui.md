# View & UI layer

## `src/lib/view/`: pure display mappers

These take raw `*Resource` objects and return plain view-model objects or
strings. No side effects, no fetching, no Svelte, so they test in isolation.
Pages call them inside `$derived`.

| File          | Key exports                                                                                                                                                                                                         | Consumed by                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `format.ts`   | `formatBytes`, `splitBytes`, `episodeCode`, `qualityLabel`, `runtimeLabel`, `ratingLabel`, `daysUntil`, `airLabel`, `timeLabel`, `relativeAge`, `timeleftLabel`, `pct`, `pad`                                       | everywhere                           |
| `status.ts`   | `DerivedStatus` union; `STATUS_COLOR` / `STATUS_LABEL` / `STATUS_BADGE_BG` records; `deriveSeriesStatus` / `deriveMovieStatus` / `deriveEpisodeStatus`; `eventLabel` / `eventColor`                                 | dashboard, library, detail, activity |
| `media.ts`    | `MediaItem`; `seriesToMediaItem` / `movieToMediaItem`; `posterUrl(images)`; `queueIndex(queue)` returning `{ series:Set, movie:Set }`; `parseMediaId('s:42')`; `countLabel`; `seasonEpisodeSummary`                 | dashboard, library, detail, layout   |
| `episodes.ts` | `EpisodeRow`, `SeasonGroup`, `buildSeasons(episodes, files, queuedEpisodeIds, now)`                                                                                                                                 | detail page                          |
| `disk.ts`     | `DiskRow`, `rootFolderDisks(roots, mounts)`, `diskSummary(rows)` returning `{ summary, pct }`                                                                                                                       | dashboard, layout                    |
| `activity.ts` | queue: `queueRow`, `QueueRow`. grouped grabs: `groupGrabs`, `summarizeEpisodes`, `GrabGroup`. history: `historyRows`, `HistoryRow`, `matchesHistFilter`, `HIST_FILTERS`. blocklist: `blocklistRows`, `BlocklistRow` | dashboard, library, activity         |
| `wanted.ts`   | wanted: `buildWantedRows`, `WantedRow`, `WantedMode`. dashboard attention: `missingRows`, `failureRows`, `AttentionRow`, `SearchCommand`                                                                            | dashboard, wanted                    |

### Status derivation (`status.ts`)

The design keyed everything off three lookup maps: `SC` (colour), `SL` (label),
`SB` (badge background). Those are `STATUS_COLOR`, `STATUS_LABEL` and
`STATUS_BADGE_BG` here, keyed by `DerivedStatus`:

```
downloaded | missing | downloading | upgrading | unmonitored | unaired | failed
```

Derivation from real fields:

- series: `!monitored` gives `unmonitored`; in queue gives `downloading`;
  otherwise from `statistics`, files >= aired gives `downloaded`, else `missing`.
- movie: `!monitored` gives `unmonitored`; in queue gives `downloading`;
  `hasFile` gives `movieFile.qualityCutoffNotMet ? 'upgrading' : 'downloaded'`;
  else `isAvailable ? 'missing' : 'unaired'`.
- episode: a future `airDateUtc` gives `unaired`; in queue gives `downloading`;
  `hasFile` gives `qualityCutoffNotMet ? 'upgrading' : 'downloaded'`; else
  `missing`.

"Missing" has a single definition (this function, `=== 'missing'`), used by the
sidebar badge, the Dashboard "Wanted" stat, and the Library "Missing" filter.

### Posters (`media.ts` `posterUrl`)

Picks the `coverType: 'poster'` entry's `remoteUrl` (public `image.tmdb.org` or
`artworks.thetvdb.com`). Local `/MediaCover/...` paths are skipped because they
need the API key. A TMDb `original` path is rewritten to `w342`.

---

## `src/lib/components/`

| Component              | Notes                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar.svelte`       | nav from `stores/nav.ts`; shows badge counts and the disk summary, passed as props from the layout                                                                                                          |
| `Header.svelte`        | search box writes `store.query` (Library reads it); theme toggle                                                                                                                                            |
| `Poster.svelte`        | fills a positioned parent. Props `src`, `alt`, `fallbackText`, and optional `top` / `bottom` snippets that receive `{ onImage }`. Renders `<img loading="lazy">` with `onerror` falling back to text.       |
| `ActionCluster.svelte` | `actions: { icon, label?, on?, tone?, onClick? }[]`. The icon set is inline (`ICONS` map): `monitor`, `search`, `isearch`, `import`, `del`, `refresh`, `history`, `edit`, `block`, `info`, `pause`, `grab`. |
| `Toasts.svelte`        | renders `store.toasts` (auto-dismiss 2.6s)                                                                                                                                                                  |

### Modals

The three under `components/modals/` are rendered once in `+layout.svelte` and
open or close via `store` state, so any page can trigger them.

`InteractiveSearch.svelte` reads `store.srch` (a `SearchSubject`) and fetches
`api.getReleases(subject)` when the subject changes. It shows a sortable table
(score, size, age, indexer, title), a Grab button (`store.grab`) with per-row
spinner state from `store.grabs`, and an Override button on movies. Rejection
rows are tinted and show the reason.

`EpisodeModal.svelte` reads `store.epModal` and has Details and History tabs.
History lazy-fetches `api.getEpisodeHistory(episodeId)`. The footer opens
Interactive Search for that episode.

`TableOptions.svelte` toggles `store.epShow[key]` against `EP_COLUMNS`. `num`,
`title` and `status` are locked on.

---

## `src/lib/styles/atlas.css`

Ported from the original design's global stylesheet.

Tokens sit on `:root` (dark, the default) and `:root[data-theme='light']`: `--bg
--surf --raised --bd --bdh --text --sec --muted --accent --hover --sel --inv
--invfg --ok --warn --err --neutral`, plus the layout knobs `--rowpad --poster
--sidebar`, which the layout `$effect` sets at runtime.

Keyframes: `spin` (grab spinner), `tin` and `fin` (modal and row enter).

The hover utilities collapse the design's per-element hover styles into a few
classes so markup stays declarative:

| class        | effect on `:hover` (or `:focus`)                         |
| ------------ | -------------------------------------------------------- |
| `.at-hov`    | `background: var(--hover); color: var(--text)`           |
| `.at-hov-bg` | `background: var(--hover)`                               |
| `.at-bdh`    | `border-color: var(--bdh)`                               |
| `.at-bdh-t`  | `border-color: var(--bdh); color: var(--text)`           |
| `.at-op`     | `opacity: .85`                                           |
| `.at-ct`     | `color: var(--text)`                                     |
| `.at-warn`   | `background: rgba(245,166,35,.14)`                       |
| `.at-focus`  | `border-color: var(--accent); box-shadow: 0 0 0 2px ...` |

Everything else is inline `style=""` copied from the design (see
[Conventions](./06-conventions.md#porting-the-design)).
