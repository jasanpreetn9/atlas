# View & UI layer

## `src/lib/view/`: pure display mappers

These take raw `*Resource` objects and return plain view-model objects or
strings. No side effects, no fetching, no Svelte, so they test in isolation.
Pages call them inside `$derived`.

| File           | Key exports                                                                                                                                                                                                         | Consumed by                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `format.ts`    | `formatBytes`, `splitBytes`, `episodeCode`, `qualityLabel`, `runtimeLabel`, `ratingLabel`, `daysUntil`, `airLabel`, `timeLabel`, `relativeAge`, `agoLabel`, `timeleftLabel`, `pct`, `pad`                           | everywhere                           |
| `status.ts`    | `DerivedStatus` union; `STATUS_COLOR` / `STATUS_LABEL` / `STATUS_BADGE_BG` records; `deriveSeriesStatus` / `deriveMovieStatus` / `deriveEpisodeStatus`; `eventLabel` / `eventColor`                                 | dashboard, library, detail, activity |
| `media.ts`     | `MediaItem`; `seriesToMediaItem` / `movieToMediaItem`; `posterUrl(images)`; `queueIndex(queue)` returning `{ series:Set, movie:Set }`; `parseMediaId('s:42')`; `countLabel`; `seasonEpisodeSummary`                 | dashboard, library, detail, layout   |
| `episodes.ts`  | `EpisodeRow`, `SeasonGroup`, `buildSeasons(episodes, files, queuedEpisodeIds, now)`                                                                                                                                 | detail page                          |
| `disk.ts`      | `DiskRow`, `rootFolderDisks(roots, mounts)`, `diskSummary(rows)` returning `{ summary, pct }`                                                                                                                       | dashboard, layout                    |
| `activity.ts`  | queue: `queueRow`, `QueueRow`. grouped grabs: `groupGrabs`, `summarizeEpisodes`, `GrabGroup`. history: `historyRows`, `HistoryRow`, `matchesHistFilter`, `HIST_FILTERS`. blocklist: `blocklistRows`, `BlocklistRow` | dashboard, library, activity         |
| `wanted.ts`    | wanted: `buildWantedRows`, `WantedRow`, `WantedMode`. dashboard attention: `missingRows`, `failureRows`, `AttentionRow`, `SearchCommand`                                                                            | dashboard, wanted                    |
| `system.ts`    | `SysRow`; `statusRows`, `healthRows`, `taskRows`, `updateRows`, `backupRows`, `logRows`                                                                                                                             | system                               |
| `mediainfo.ts` | `MediaInfoTarget`, `buildMediaInfoTarget(title, subtitle, file)` normalizing an `EpisodeFileResource` or `MovieFileResource`                                                                                        | detail page, episode modal           |
| `rename.ts`    | `RenameRow`, `renameRows(items)` flattening a `GET /rename` preview                                                                                                                                                 | detail page                          |

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

Everything under `components/modals/` is rendered once in `+layout.svelte` and
opens or closes via `store` state, so any page can trigger it.

`InteractiveSearch.svelte` reads `store.srch` (a `SearchSubject`) and fetches
`api.getReleases(subject)` when the subject changes. It shows a sortable table
(score, size, age, indexer, title), a Grab button (`store.grab`) with per-row
spinner state from `store.grabs`, and an Override button on movies. Rejection
rows are tinted and show the reason.

`EpisodeModal.svelte` reads `store.epModal` and has Details and History tabs.
History lazy-fetches `api.getEpisodeHistory(episodeId)`. The footer opens
Interactive Search for that episode; the file section has a Media Info button
when `target.file` (the raw `EpisodeFileResource`) is set.

`TableOptions.svelte` toggles `store.epShow[key]` against `EP_COLUMNS`. `num`,
`title` and `status` are locked on.

`Dialog.svelte` reads `store.dlg` / `store.dlgTarget` and is the real Edit and
Delete flow for a series or movie (`PUT`/`DELETE` on `series` or `movie`).

`ConfirmModal.svelte` is the generic confirm-before-you-act prompt. Any code
calls `store.openConfirm({ title, body, danger?, confirmLabel?, onConfirm })`;
the modal stays open with a "Working…" button until `onConfirm` resolves, then
closes itself, or toasts an error and stays open on rejection. Used by the
Detail page's per-episode and movie file deletes.

`MediaInfoModal.svelte` reads `store.mediaInfo` (a `MediaInfoTarget`, built by
`view/mediainfo.ts`) and lists the full `MediaInfoResource` breakdown: general
(size, quality, languages, release group, added), video, audio, subtitles.

`RenamePreviewModal.svelte` reads `store.renameTarget` and fetches
`api.getRenamePreview(kind, id)` (`GET /rename`), listing existing → new paths
for whatever doesn't match the current naming format. Confirming calls
`api.renameFiles(kind, id, episodeFileIds)`, which is `RenameFiles` for a
series (specific episode file ids) or `RenameMovie` for a movie (all of its
files).

`EditFileModal.svelte` reads `store.editFileTarget` (a discriminated
`{ kind: 'series' | 'movie'; file }`, so `file` narrows to an
`EpisodeFileResource` or `MovieFileResource` without a cast) and fetches
`api.getQualityDefinitions(kind)` / `api.getLanguages(kind)` for the pickers.
Saving sends the whole file resource back through `editEpisodeFile` /
`editMovieFile` (`PUT /episodefile` or `/moviefile`) with only `quality` and
`languages` changed, correcting the record without touching the file on disk.

`ManualImportModal.svelte` reads `store.manualImport` (`seriesId`,
`seriesTitle`, `folder`, the series' own path) and fetches
`api.getManualImportCandidates(seriesId, folder)` (`GET /manualimport`).
Candidates Sonarr matched to an episode are pre-selected; ones it couldn't
match are shown with a warning and can't be selected, since there is nowhere
in this UI to assign one by hand. Confirming calls `api.importSeriesFiles`
(`POST /command ManualImport`), passing each selected candidate's own
auto-detected quality and language straight through.

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
