// The single seam the Atlas UI goes through for data.
//
// `createHttpApi()` talks to the same-origin proxy routes (/api/sonarr/*, /api/radarr/*),
// which forward to the configured upstream instances with the server-held API key.
// Unified reads (queue, history, calendar, …) fan out to Sonarr + Radarr and concat;
// if one app is not configured its slice is simply empty. If neither is configured the
// call throws. There is no bundled fallback data.

import type {
	BackupResource,
	BlocklistResource,
	CommandResource,
	DiskSpaceResource,
	HealthResource,
	LogFileResource,
	PagingResource,
	QualityProfileResource,
	RootFolderResource,
	SystemResource,
	TaskResource,
	UpdateResource
} from './common';
import type {
	EpisodeFileResource,
	EpisodeResource,
	SeriesResource,
	SonarrHistoryResource,
	SonarrQueueResource,
	SonarrReleaseResource
} from './sonarr';
import type {
	MovieResource,
	RadarrHistoryResource,
	RadarrQueueResource,
	RadarrReleaseResource
} from './radarr';

export type WantedKind = 'series' | 'movie';

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

	/** Pass a `kind` to scope to one app; omit for both merged. */
	getRootFolders(kind?: WantedKind): Promise<RootFolderResource[]>;
	getDiskSpace(): Promise<DiskSpaceResource[]>;
	getHealth(): Promise<HealthResource[]>;
	getSystemStatus(): Promise<{ sonarr: SystemResource | null; radarr: SystemResource | null }>;
	getTasks(): Promise<TaskResource[]>;
	getUpdates(): Promise<UpdateResource[]>;
	getLogFiles(): Promise<LogFileResource[]>;
	getBackups(): Promise<BackupResource[]>;
	getQualityProfiles(kind?: WantedKind): Promise<QualityProfileResource[]>;

	lookupSeries(term: string): Promise<SeriesResource[]>;
	lookupMovie(term: string): Promise<MovieResource[]>;

	sendCommand(
		app: WantedKind,
		body: { name: string } & Record<string, unknown>
	): Promise<CommandResource>;
}

type FetchFn = typeof fetch;

/** Thrown when a proxy replies 503, meaning that app has no URL or key configured. */
export class AppNotConfigured extends Error {
	constructor(readonly app: 'sonarr' | 'radarr') {
		super(`${app} is not configured`);
		this.name = 'AppNotConfigured';
	}
}

function makeProxy(app: 'sonarr' | 'radarr', fetchFn: FetchFn) {
	return async function proxy<T>(
		path: string,
		opts: {
			method?: string;
			body?: unknown;
			query?: Record<string, string | number | boolean | undefined>;
		} = {}
	): Promise<T> {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(opts.query ?? {})) {
			if (v !== undefined) qs.set(k, String(v));
		}
		const url = `/api/${app}/${path}${qs.size ? `?${qs}` : ''}`;
		const res = await fetchFn(url, {
			method: opts.method ?? 'GET',
			headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
		});
		if (res.status === 503) throw new AppNotConfigured(app);
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			throw new Error(`${app} ${path} failed: ${res.status} ${JSON.stringify(data)}`);
		}
		return data as T;
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
						query: { pageSize: 200, includeSeries: true, includeEpisode: true }
					}).then(records),
				() =>
					r<Paged<RadarrQueueResource>>('queue', {
						query: { pageSize: 200, includeMovie: true }
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
				return r<RadarrReleaseResource[]>('release', { query: { movieId: subject.movieId } });
			}
			const query =
				subject.kind === 'episode'
					? { seriesId: subject.seriesId, episodeId: subject.episodeId }
					: { seriesId: subject.seriesId };
			return s<SonarrReleaseResource[]>('release', { query });
		},

		pushRelease: (kind, guid, indexerId) =>
			forKind(kind)('release', { method: 'POST', body: { guid, indexerId } }).then(() => {}),

		updateSeries: (series) =>
			s<SeriesResource>(`series/${series.id}`, { method: 'PUT', body: series }),
		updateMovie: (movie) => r<MovieResource>(`movie/${movie.id}`, { method: 'PUT', body: movie }),
		setEpisodeMonitored: (episodeIds, monitored) =>
			s('episode/monitor', { method: 'PUT', body: { episodeIds, monitored } }).then(() => {}),

		addSeries: (series) => s<SeriesResource>('series', { method: 'POST', body: series }),
		addMovie: (movie) => r<MovieResource>('movie', { method: 'POST', body: movie }),

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
		getHealth: () =>
			both<HealthResource>(
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

		getTasks: () =>
			both<TaskResource>(
				() => s('system/task'),
				() => r('system/task')
			),
		getUpdates: () =>
			both<UpdateResource>(
				() => s('update'),
				() => r('update')
			),
		getLogFiles: () =>
			both<LogFileResource>(
				() => s('log/file'),
				() => r('log/file')
			),
		getBackups: () =>
			both<BackupResource>(
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

		sendCommand: (app, body) => forKind(app)<CommandResource>('command', { method: 'POST', body })
	};
}

/** Default instance used by the UI. */
export const api: AtlasApi = createHttpApi();
