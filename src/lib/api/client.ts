// The single seam the Atlas UI goes through for data.
//
// `createHttpApi()` talks to the same-origin proxy routes (/api/sonarr/*, /api/radarr/*),
// which forward to the configured upstream instances with the server-held API key.
// Unified reads (queue, history, calendar, …) fan out to Sonarr + Radarr and concat;
// if one app is not configured its slice is simply empty. If neither is configured the
// call throws. There is no bundled fallback data.

import { browser } from '$app/environment';
import type {
	BackupResource,
	BlocklistResource,
	CommandResource,
	DiskSpaceResource,
	HealthResource,
	Language,
	LogFileResource,
	PagingResource,
	QualityDefinitionResource,
	QualityModel,
	QualityProfileResource,
	RootFolderResource,
	SystemResource,
	TaskResource,
	UpdateResource
} from './common';
import type {
	EpisodeFileResource,
	EpisodeResource,
	ManualImportResource,
	RenamingResource,
	SeriesResource,
	SonarrHistoryResource,
	SonarrQueueResource,
	SonarrReleaseResource
} from './sonarr';
import type {
	MovieFileResource,
	MovieRenamingResource,
	MovieResource,
	RadarrHistoryResource,
	RadarrQueueResource,
	RadarrReleaseResource
} from './radarr';

export type WantedKind = 'series' | 'movie';

export interface DeleteOptions {
	deleteFiles: boolean;
	addImportExclusion: boolean;
}

/** Fields the Sonarr `PUT /series/editor` bulk endpoint accepts. All optional; only what is set changes. */
export interface SeriesEditorChanges {
	monitored?: boolean;
	qualityProfileId?: number;
	rootFolderPath?: string;
	seasonFolder?: boolean;
	tags?: number[];
	applyTags?: 'add' | 'remove' | 'replace';
	/** Physically move existing files when rootFolderPath changes. */
	moveFiles?: boolean;
}

/** Fields the Radarr `PUT /movie/editor` bulk endpoint accepts. */
export interface MovieEditorChanges {
	monitored?: boolean;
	qualityProfileId?: number;
	minimumAvailability?: string;
	rootFolderPath?: string;
	tags?: number[];
	applyTags?: 'add' | 'remove' | 'replace';
	moveFiles?: boolean;
}

/** One file `GET /rename` found not matching the current naming format. */
export type RenameItem =
	({ kind: 'series' } & RenamingResource) | ({ kind: 'movie' } & MovieRenamingResource);

/** A manual-import candidate, edited down to what `POST /command ManualImport` needs back. */
export interface ManualImportSubmission {
	path: string;
	folderName?: string | null;
	seriesId: number;
	episodeIds: number[];
	quality: QualityModel;
	languages: Language[];
	releaseGroup?: string | null;
	downloadId?: string | null;
}

export type QueueItem = SonarrQueueResource | RadarrQueueResource;
export type HistoryItem = SonarrHistoryResource | RadarrHistoryResource;
export type ReleaseItem = SonarrReleaseResource | RadarrReleaseResource;
export type CalendarItem =
	({ kind: 'series' } & EpisodeResource) | ({ kind: 'movie' } & MovieResource);

/** Identifies what an interactive search is for. */
export type SearchSubject =
	| { kind: 'series'; seriesId: number; label: string }
	| { kind: 'episode'; seriesId: number; episodeId: number; label: string }
	| { kind: 'movie'; movieId: number; label: string };

export interface AtlasStatusSummary {
	sonarr: { configured: boolean; reachable: boolean };
	radarr: { configured: boolean; reachable: boolean };
	live: boolean;
}

export interface AtlasApi {
	status(): Promise<AtlasStatusSummary>;

	getSeries(): Promise<SeriesResource[]>;
	getMovies(): Promise<MovieResource[]>;
	getEpisodes(seriesId: number): Promise<EpisodeResource[]>;
	getEpisodeFiles(seriesId: number): Promise<EpisodeFileResource[]>;
	getEpisodeHistory(episodeId: number): Promise<SonarrHistoryResource[]>;
	getSeriesHistory(seriesId: number): Promise<SonarrHistoryResource[]>;
	getMovieHistory(movieId: number): Promise<RadarrHistoryResource[]>;

	getQueue(): Promise<QueueItem[]>;
	getHistory(opts?: {
		eventType?: string;
		page?: number;
		pageSize?: number;
	}): Promise<HistoryItem[]>;
	getBlocklist(): Promise<BlocklistResource[]>;

	getWantedMissing(
		kind: WantedKind,
		opts?: { page?: number; pageSize?: number }
	): Promise<PagingResource<EpisodeResource | MovieResource>>;
	getWantedCutoff(
		kind: WantedKind,
		opts?: { page?: number; pageSize?: number }
	): Promise<PagingResource<EpisodeResource | MovieResource>>;

	getCalendar(start: string, end: string): Promise<CalendarItem[]>;
	getReleases(subject: SearchSubject): Promise<ReleaseItem[]>;
	/** Grab a specific release found by interactive search. */
	pushRelease(kind: WantedKind, guid: string, indexerId: number): Promise<void>;

	/** *arr PUT endpoints require the whole resource back, not a partial patch. */
	updateSeries(series: SeriesResource): Promise<SeriesResource>;
	updateMovie(movie: MovieResource): Promise<MovieResource>;
	setEpisodeMonitored(episodeIds: number[], monitored: boolean): Promise<void>;

	/** POST the lookup resource plus the add-specific fields. */
	addSeries(series: SeriesResource): Promise<SeriesResource>;
	addMovie(movie: MovieResource): Promise<MovieResource>;

	/** Remove a title from the library, optionally its files and a re-add exclusion. */
	deleteSeries(id: number, opts: DeleteOptions): Promise<void>;
	deleteMovie(id: number, opts: DeleteOptions): Promise<void>;

	/** Bulk-edit many titles at once (Mass Editor). Returns the updated resources. */
	editSeries(seriesIds: number[], changes: SeriesEditorChanges): Promise<SeriesResource[]>;
	editMovies(movieIds: number[], changes: MovieEditorChanges): Promise<MovieResource[]>;
	/** Bulk-remove many titles at once. */
	bulkDeleteSeries(seriesIds: number[], opts: DeleteOptions): Promise<void>;
	bulkDeleteMovies(movieIds: number[], opts: DeleteOptions): Promise<void>;

	/** Remove one downloaded file, keeping the series/movie in the library. */
	deleteEpisodeFile(id: number): Promise<void>;
	deleteMovieFile(id: number): Promise<void>;

	/** Files that would be renamed under the current naming format; empty if none. */
	getRenamePreview(kind: WantedKind, id: number): Promise<RenameItem[]>;
	/** Rename the given episode files (series) or every file for the movie. */
	renameFiles(kind: WantedKind, id: number, episodeFileIds?: number[]): Promise<CommandResource>;

	/** Correct a file's recorded quality/language without touching the file on disk. */
	editEpisodeFile(file: EpisodeFileResource): Promise<EpisodeFileResource>;
	editMovieFile(file: MovieFileResource): Promise<MovieFileResource>;
	/** Every quality the app knows about, in ascending order. */
	getQualityDefinitions(kind: WantedKind): Promise<QualityDefinitionResource[]>;
	/** Every language the app knows about. */
	getLanguages(kind: WantedKind): Promise<Language[]>;

	/** Scan a series' folder for files not yet imported, matched to episodes where possible. */
	getManualImportCandidates(seriesId: number, folder: string): Promise<ManualImportResource[]>;
	/** Import the given candidates as-is (their auto-detected episode/quality/language). */
	importSeriesFiles(files: ManualImportSubmission[]): Promise<CommandResource>;

	/** Pass a `kind` to scope to one app; omit for both merged. */
	getRootFolders(kind?: WantedKind): Promise<RootFolderResource[]>;
	getDiskSpace(): Promise<DiskSpaceResource[]>;
	getHealth(kind?: WantedKind): Promise<HealthResource[]>;
	getSystemStatus(): Promise<{ sonarr: SystemResource | null; radarr: SystemResource | null }>;
	getTasks(kind?: WantedKind): Promise<TaskResource[]>;
	getUpdates(kind?: WantedKind): Promise<UpdateResource[]>;
	getLogFiles(kind?: WantedKind): Promise<LogFileResource[]>;
	getBackups(kind?: WantedKind): Promise<BackupResource[]>;
	getQualityProfiles(kind?: WantedKind): Promise<QualityProfileResource[]>;

	lookupSeries(term: string): Promise<SeriesResource[]>;
	lookupMovie(term: string): Promise<MovieResource[]>;

	sendCommand(
		app: WantedKind,
		body: { name: string } & Record<string, unknown>
	): Promise<CommandResource>;

	/** Remove one queue item; blocklist keeps it from being grabbed again. */
	removeFromQueue(app: WantedKind, id: number, opts: { blocklist: boolean }): Promise<void>;
	/** Remove many queue items at once. */
	bulkRemoveFromQueue(app: WantedKind, ids: number[], opts: { blocklist: boolean }): Promise<void>;

	/** Mark a history entry as a failed download; blocklists it and re-searches. */
	markHistoryFailed(app: WantedKind, historyId: number): Promise<void>;

	/** Remove one blocklist entry, or every one of the given ids at once. */
	removeFromBlocklist(app: WantedKind, id: number): Promise<void>;
	bulkRemoveFromBlocklist(app: WantedKind, ids: number[]): Promise<void>;

	/** Restart the app; it comes back up on its own. */
	restartApp(kind: WantedKind): Promise<void>;
	/** Stop the app; nothing brings it back up unless something else (a service manager, Docker) does. */
	shutdownApp(kind: WantedKind): Promise<void>;
}

type FetchFn = typeof fetch;

/** Thrown when a proxy replies 503, meaning that app has no URL or key configured. */
export class AppNotConfigured extends Error {
	constructor(readonly app: 'sonarr' | 'radarr') {
		super(`${app} is not configured`);
		this.name = 'AppNotConfigured';
	}
}

// Browser-only response cache for GETs. Keyed by full URL, so it is shared across
// every `createHttpApi()` instance. Client-side navigations reuse recent data
// instead of re-hitting the proxy; the server (SSR) path never touches this.
const CLIENT_TTL = 45_000;
const clientCache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

/** Drop every cached response. Call after a write so the next read is fresh. */
export function clearApiCache(): void {
	clientCache.clear();
	inflight.clear();
}

function makeProxy(app: 'sonarr' | 'radarr', fetchFn: FetchFn) {
	return function proxy<T>(
		path: string,
		opts: {
			method?: string;
			body?: unknown;
			query?: Record<string, string | number | boolean | undefined>;
			/** Client cache lifetime in ms; 0 disables. GET only. Default 45s. */
			cacheMs?: number;
		} = {}
	): Promise<T> {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(opts.query ?? {})) {
			if (v !== undefined) qs.set(k, String(v));
		}
		const url = `/api/${app}/${path}${qs.size ? `?${qs}` : ''}`;
		const method = opts.method ?? 'GET';
		const ttl = opts.cacheMs ?? CLIENT_TTL;
		const cacheable = browser && method === 'GET' && ttl > 0;

		if (cacheable) {
			const hit = clientCache.get(url);
			if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value as T);
			const pending = inflight.get(url);
			if (pending) return pending as Promise<T>;
		}

		const run = (async () => {
			const res = await fetchFn(url, {
				method,
				headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
				body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
			});
			if (res.status === 503) throw new AppNotConfigured(app);
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				throw new Error(`${app} ${path} failed: ${res.status} ${JSON.stringify(data)}`);
			}
			return data;
		})();

		if (cacheable) {
			inflight.set(url, run);
			run
				.then((value) => clientCache.set(url, { at: Date.now(), value }))
				.catch(() => {})
				.finally(() => inflight.delete(url));
		}

		return run as Promise<T>;
	};
}

interface Paged<T> {
	records?: T[];
}

function records<T>(v: Paged<T> | T[] | null | undefined): T[] {
	if (!v) return [];
	return Array.isArray(v) ? v : (v.records ?? []);
}

/** Run a call, treating "app not configured" as an empty result. */
async function optional<T>(call: () => Promise<T[]>): Promise<T[]> {
	try {
		return await call();
	} catch (err) {
		if (err instanceof AppNotConfigured) return [];
		throw err;
	}
}

export function createHttpApi(fetchFn: FetchFn = fetch): AtlasApi {
	const s = makeProxy('sonarr', fetchFn);
	const r = makeProxy('radarr', fetchFn);

	/** Fan out to both apps; tolerate either being unconfigured, fail only if both are. */
	const both = async <T>(
		sonarrCall: () => Promise<T[]>,
		radarrCall: () => Promise<T[]>
	): Promise<T[]> => {
		const settled = await Promise.allSettled([optional(sonarrCall), optional(radarrCall)]);
		const values: T[] = [];
		let failure: unknown;
		for (const res of settled) {
			if (res.status === 'fulfilled') values.push(...res.value);
			else failure = res.reason;
		}
		if (failure && values.length === 0) throw failure;
		return values;
	};

	/** Pick the app for a kind-scoped call. */
	const forKind = (kind: WantedKind) => (kind === 'series' ? s : r);

	const wanted = (
		path: 'wanted/missing' | 'wanted/cutoff',
		kind: WantedKind,
		opts: { page?: number; pageSize?: number }
	): Promise<PagingResource<EpisodeResource | MovieResource>> => {
		const query: Record<string, string | number | boolean | undefined> = {
			page: opts.page ?? 1,
			pageSize: opts.pageSize ?? 50,
			sortKey: kind === 'series' ? 'episodes.airDateUtc' : 'movieMetadata.sortTitle',
			sortDirection: kind === 'series' ? 'descending' : 'ascending'
		};
		if (kind === 'series') {
			query.includeSeries = true;
			if (path === 'wanted/cutoff') query.includeEpisodeFile = true;
		}
		return forKind(kind)<PagingResource<EpisodeResource | MovieResource>>(path, { query }).then(
			(p) =>
				p ?? {
					page: 1,
					pageSize: 0,
					sortKey: '',
					sortDirection: 'default',
					totalRecords: 0,
					records: []
				}
		);
	};

	return {
		status: async () => {
			try {
				return await fetchFn('/api/status').then((res) => res.json());
			} catch {
				return {
					sonarr: { configured: false, reachable: false },
					radarr: { configured: false, reachable: false },
					live: false
				};
			}
		},

		getSeries: () => s<SeriesResource[]>('series'),
		getMovies: () => r<MovieResource[]>('movie'),
		getEpisodes: (seriesId) => s<EpisodeResource[]>('episode', { query: { seriesId } }),
		getEpisodeFiles: (seriesId) => s<EpisodeFileResource[]>('episodefile', { query: { seriesId } }),
		getEpisodeHistory: (episodeId) =>
			s<Paged<SonarrHistoryResource>>('history', {
				query: { episodeId, pageSize: 20, sortKey: 'date', sortDirection: 'descending' }
			}).then(records),
		getSeriesHistory: (seriesId) =>
			s<SonarrHistoryResource[]>('history/series', { query: { seriesId } }),
		getMovieHistory: (movieId) =>
			r<RadarrHistoryResource[]>('history/movie', { query: { movieId } }),

		getQueue: () =>
			both<QueueItem>(
				() =>
					s<Paged<SonarrQueueResource>>('queue', {
						query: { pageSize: 200, includeSeries: true, includeEpisode: true },
						cacheMs: 10_000
					}).then(records),
				() =>
					r<Paged<RadarrQueueResource>>('queue', {
						query: { pageSize: 200, includeMovie: true },
						cacheMs: 10_000
					}).then(records)
			),

		getHistory: (opts) =>
			both<HistoryItem>(
				() =>
					s<Paged<SonarrHistoryResource>>('history', {
						query: {
							pageSize: opts?.pageSize ?? 100,
							page: opts?.page,
							sortKey: 'date',
							sortDirection: 'descending',
							eventType: opts?.eventType,
							includeSeries: true,
							includeEpisode: true
						}
					}).then(records),
				() =>
					r<Paged<RadarrHistoryResource>>('history', {
						query: {
							pageSize: opts?.pageSize ?? 100,
							page: opts?.page,
							sortKey: 'date',
							sortDirection: 'descending',
							eventType: opts?.eventType,
							includeMovie: true
						}
					}).then(records)
			),

		getBlocklist: () =>
			both<BlocklistResource>(
				() => s<Paged<BlocklistResource>>('blocklist', { query: { pageSize: 50 } }).then(records),
				() => r<Paged<BlocklistResource>>('blocklist', { query: { pageSize: 50 } }).then(records)
			),

		getWantedMissing: (kind, opts = {}) => wanted('wanted/missing', kind, opts),
		getWantedCutoff: (kind, opts = {}) => wanted('wanted/cutoff', kind, opts),

		getCalendar: (start, end) =>
			both<CalendarItem>(
				() =>
					s<EpisodeResource[]>('calendar', { query: { start, end, includeSeries: true } }).then(
						(xs) => xs.map((e) => ({ kind: 'series' as const, ...e }))
					),
				() =>
					r<MovieResource[]>('calendar', { query: { start, end } }).then((xs) =>
						xs.map((m) => ({ kind: 'movie' as const, ...m }))
					)
			),

		getReleases: (subject) => {
			if (subject.kind === 'movie') {
				return r<RadarrReleaseResource[]>('release', {
					query: { movieId: subject.movieId },
					cacheMs: 0
				});
			}
			const query =
				subject.kind === 'episode'
					? { seriesId: subject.seriesId, episodeId: subject.episodeId }
					: { seriesId: subject.seriesId };
			return s<SonarrReleaseResource[]>('release', { query, cacheMs: 0 });
		},

		pushRelease: (kind, guid, indexerId) =>
			forKind(kind)('release', { method: 'POST', body: { guid, indexerId } }).then(() => {
				clearApiCache();
			}),

		updateSeries: (series) =>
			s<SeriesResource>(`series/${series.id}`, { method: 'PUT', body: series }).then((v) => {
				clearApiCache();
				return v;
			}),
		updateMovie: (movie) =>
			r<MovieResource>(`movie/${movie.id}`, { method: 'PUT', body: movie }).then((v) => {
				clearApiCache();
				return v;
			}),
		setEpisodeMonitored: (episodeIds, monitored) =>
			s('episode/monitor', { method: 'PUT', body: { episodeIds, monitored } }).then(() => {
				clearApiCache();
			}),

		addSeries: (series) =>
			s<SeriesResource>('series', { method: 'POST', body: series }).then((v) => {
				clearApiCache();
				return v;
			}),
		addMovie: (movie) =>
			r<MovieResource>('movie', { method: 'POST', body: movie }).then((v) => {
				clearApiCache();
				return v;
			}),

		deleteSeries: (id, o) =>
			s(`series/${id}`, {
				method: 'DELETE',
				query: { deleteFiles: o.deleteFiles, addImportExclusion: o.addImportExclusion }
			}).then(() => {
				clearApiCache();
			}),
		deleteMovie: (id, o) =>
			r(`movie/${id}`, {
				method: 'DELETE',
				query: { deleteFiles: o.deleteFiles, addImportExclusion: o.addImportExclusion }
			}).then(() => {
				clearApiCache();
			}),

		editSeries: (seriesIds, changes) =>
			s<SeriesResource[]>('series/editor', { method: 'PUT', body: { seriesIds, ...changes } }).then(
				(v) => {
					clearApiCache();
					return v ?? [];
				}
			),
		editMovies: (movieIds, changes) =>
			r<MovieResource[]>('movie/editor', { method: 'PUT', body: { movieIds, ...changes } }).then(
				(v) => {
					clearApiCache();
					return v ?? [];
				}
			),
		bulkDeleteSeries: (seriesIds, o) =>
			s('series/editor', {
				method: 'DELETE',
				body: {
					seriesIds,
					deleteFiles: o.deleteFiles,
					addImportExclusion: o.addImportExclusion
				}
			}).then(() => {
				clearApiCache();
			}),
		bulkDeleteMovies: (movieIds, o) =>
			r('movie/editor', {
				method: 'DELETE',
				body: {
					movieIds,
					deleteFiles: o.deleteFiles,
					addImportExclusion: o.addImportExclusion
				}
			}).then(() => {
				clearApiCache();
			}),

		deleteEpisodeFile: (id) =>
			s(`episodefile/${id}`, { method: 'DELETE' }).then(() => {
				clearApiCache();
			}),
		deleteMovieFile: (id) =>
			r(`moviefile/${id}`, { method: 'DELETE' }).then(() => {
				clearApiCache();
			}),

		getRenamePreview: (kind, id) =>
			kind === 'series'
				? s<RenamingResource[]>('rename', { query: { seriesId: id }, cacheMs: 0 }).then((xs) =>
						xs.map((x) => ({ kind: 'series' as const, ...x }))
					)
				: r<MovieRenamingResource[]>('rename', { query: { movieId: id }, cacheMs: 0 }).then((xs) =>
						xs.map((x) => ({ kind: 'movie' as const, ...x }))
					),
		renameFiles: (kind, id, episodeFileIds) =>
			kind === 'series'
				? s<CommandResource>('command', {
						method: 'POST',
						body: { name: 'RenameFiles', seriesId: id, files: episodeFileIds ?? [] }
					}).then((v) => {
						clearApiCache();
						return v;
					})
				: r<CommandResource>('command', {
						method: 'POST',
						body: { name: 'RenameMovie', movieIds: [id] }
					}).then((v) => {
						clearApiCache();
						return v;
					}),

		editEpisodeFile: (file) =>
			s<EpisodeFileResource>(`episodefile/${file.id}`, { method: 'PUT', body: file }).then((v) => {
				clearApiCache();
				return v;
			}),
		editMovieFile: (file) =>
			r<MovieFileResource>(`moviefile/${file.id}`, { method: 'PUT', body: file }).then((v) => {
				clearApiCache();
				return v;
			}),
		getQualityDefinitions: (kind) =>
			forKind(kind)<QualityDefinitionResource[]>('qualitydefinition').then((xs) =>
				[...xs].sort((a, b) => a.weight - b.weight)
			),
		getLanguages: (kind) => forKind(kind)<Language[]>('language'),

		getManualImportCandidates: (seriesId, folder) =>
			s<ManualImportResource[]>('manualimport', {
				query: { seriesId, folder, filterExistingFiles: true },
				cacheMs: 0
			}),
		importSeriesFiles: (files) =>
			s<CommandResource>('command', {
				method: 'POST',
				body: { name: 'ManualImport', files, importMode: 'auto' }
			}).then((v) => {
				clearApiCache();
				return v;
			}),

		getRootFolders: (kind) =>
			kind
				? forKind(kind)<RootFolderResource[]>('rootfolder')
				: both<RootFolderResource>(
						() => s('rootfolder'),
						() => r('rootfolder')
					),
		getDiskSpace: () =>
			both<DiskSpaceResource>(
				() => s('diskspace'),
				() => r('diskspace')
			),
		getHealth: (kind) =>
			kind
				? forKind(kind)<HealthResource[]>('health')
				: both<HealthResource>(
						() => s('health'),
						() => r('health')
					),

		getSystemStatus: async () => {
			const [sonarr, radarr] = await Promise.all([
				optional(() => s<SystemResource>('system/status').then((x) => [x])),
				optional(() => r<SystemResource>('system/status').then((x) => [x]))
			]);
			return { sonarr: sonarr[0] ?? null, radarr: radarr[0] ?? null };
		},

		getTasks: (kind) =>
			kind
				? forKind(kind)<TaskResource[]>('system/task')
				: both<TaskResource>(
						() => s('system/task'),
						() => r('system/task')
					),
		getUpdates: (kind) =>
			kind
				? forKind(kind)<UpdateResource[]>('update')
				: both<UpdateResource>(
						() => s('update'),
						() => r('update')
					),
		getLogFiles: (kind) =>
			kind
				? forKind(kind)<LogFileResource[]>('log/file')
				: both<LogFileResource>(
						() => s('log/file'),
						() => r('log/file')
					),
		getBackups: (kind) =>
			kind
				? forKind(kind)<BackupResource[]>('system/backup')
				: both<BackupResource>(
						() => s('system/backup'),
						() => r('system/backup')
					),
		getQualityProfiles: (kind) =>
			kind
				? forKind(kind)<QualityProfileResource[]>('qualityprofile')
				: both<QualityProfileResource>(
						() => s('qualityprofile'),
						() => r('qualityprofile')
					),

		lookupSeries: (term) => s<SeriesResource[]>('series/lookup', { query: { term } }),
		lookupMovie: (term) => r<MovieResource[]>('movie/lookup', { query: { term } }),

		sendCommand: (app, body) =>
			forKind(app)<CommandResource>('command', { method: 'POST', body }).then((v) => {
				clearApiCache();
				return v;
			}),

		removeFromQueue: (app, id, opts) =>
			forKind(app)(`queue/${id}`, {
				method: 'DELETE',
				query: { removeFromClient: true, blocklist: opts.blocklist }
			}).then(() => {
				clearApiCache();
			}),
		bulkRemoveFromQueue: (app, ids, opts) =>
			forKind(app)('queue/bulk', {
				method: 'DELETE',
				body: { ids },
				query: { removeFromClient: true, blocklist: opts.blocklist }
			}).then(() => {
				clearApiCache();
			}),

		markHistoryFailed: (app, historyId) =>
			forKind(app)(`history/failed/${historyId}`, { method: 'POST' }).then(() => {
				clearApiCache();
			}),

		removeFromBlocklist: (app, id) =>
			forKind(app)(`blocklist/${id}`, { method: 'DELETE' }).then(() => {
				clearApiCache();
			}),
		bulkRemoveFromBlocklist: (app, ids) =>
			forKind(app)('blocklist/bulk', { method: 'DELETE', body: { ids } }).then(() => {
				clearApiCache();
			}),

		restartApp: (kind) =>
			forKind(kind)('system/restart', { method: 'POST' }).then(() => {
				clearApiCache();
			}),
		shutdownApp: (kind) =>
			forKind(kind)('system/shutdown', { method: 'POST' }).then(() => {
				clearApiCache();
			})
	};
}

/** Default instance used by the UI. */
export const api: AtlasApi = createHttpApi();
