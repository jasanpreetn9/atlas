// Typed Radarr v3 endpoint wrappers. Server-only.

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
} from '$lib/api/common';
import type {
	MovieResource,
	RadarrHistoryResource,
	RadarrQueueResource,
	RadarrReleaseResource
} from '$lib/api/radarr';
import { getRadarrConfig, type ArrConfig } from './config';
import { arrPing, arrRequest, type ArrRequestOptions } from './http';

export function requireRadarr(): ArrConfig {
	const cfg = getRadarrConfig();
	if (!cfg) throw new Error('Radarr is not configured (set RADARR_URL and RADARR_API_KEY)');
	return cfg;
}

function req<T>(path: string, opts?: ArrRequestOptions): Promise<T> {
	return arrRequest<T>(requireRadarr(), path, opts);
}

export const radarr = {
	ping: () => arrPing(requireRadarr()),

	// GET /api/v3/movie
	movies: () => req<MovieResource[]>('movie'),
	// GET /api/v3/movie/{id}
	movieById: (id: number) => req<MovieResource>(`movie/${id}`),

	// GET /api/v3/queue
	queue: () =>
		req<PagingResource<RadarrQueueResource>>('queue', {
			query: { pageSize: 200, includeMovie: true }
		}),

	// GET /api/v3/history
	history: (query: Record<string, string | number> = {}) =>
		req<PagingResource<RadarrHistoryResource>>('history', {
			query: { pageSize: 50, sortKey: 'date', sortDirection: 'descending', ...query }
		}),

	// GET /api/v3/blocklist
	blocklist: () =>
		req<PagingResource<BlocklistResource>>('blocklist', {
			query: { pageSize: 50, sortKey: 'date', sortDirection: 'descending' }
		}),

	// GET /api/v3/wanted/missing
	wantedMissing: (page = 1) =>
		req<PagingResource<MovieResource>>('wanted/missing', {
			query: { page, pageSize: 50, sortKey: 'movies.sortTitle', sortDirection: 'ascending' }
		}),
	// GET /api/v3/wanted/cutoff
	wantedCutoff: (page = 1) =>
		req<PagingResource<MovieResource>>('wanted/cutoff', {
			query: { page, pageSize: 50, sortKey: 'movies.sortTitle', sortDirection: 'ascending' }
		}),

	// GET /api/v3/calendar?start=&end=
	calendar: (start: string, end: string) =>
		req<MovieResource[]>('calendar', { query: { start, end, unmonitored: true } }),

	// GET /api/v3/release?movieId=  (interactive search)
	release: (query: { movieId?: number }) => req<RadarrReleaseResource[]>('release', { query }),

	// GET /api/v3/rootfolder
	rootFolders: () => req<RootFolderResource[]>('rootfolder'),
	// GET /api/v3/diskspace
	diskSpace: () => req<DiskSpaceResource[]>('diskspace'),
	// GET /api/v3/health
	health: () => req<HealthResource[]>('health'),
	// GET /api/v3/system/status
	systemStatus: () => req<SystemResource>('system/status'),
	// GET /api/v3/system/task
	tasks: () => req<TaskResource[]>('system/task'),
	// GET /api/v3/update
	updates: () => req<UpdateResource[]>('update'),
	// GET /api/v3/log/file
	logFiles: () => req<LogFileResource[]>('log/file'),
	// GET /api/v3/system/backup
	backups: () => req<BackupResource[]>('system/backup'),
	// GET /api/v3/qualityprofile
	qualityProfiles: () => req<QualityProfileResource[]>('qualityprofile'),

	// GET /api/v3/movie/lookup?term=
	lookup: (term: string) => req<MovieResource[]>('movie/lookup', { query: { term } }),

	// POST /api/v3/command
	command: (body: { name: string } & Record<string, unknown>) =>
		req<CommandResource>('command', { method: 'POST', body })
};
