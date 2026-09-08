// Typed Sonarr v3 endpoint wrappers. Server-only.

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
	EpisodeResource,
	SeriesResource,
	SonarrHistoryResource,
	SonarrQueueResource,
	SonarrReleaseResource
} from '$lib/api/sonarr';
import { getSonarrConfig, type ArrConfig } from './config';
import { arrPing, arrRequest, type ArrRequestOptions } from './http';

export function requireSonarr(): ArrConfig {
	const cfg = getSonarrConfig();
	if (!cfg) throw new Error('Sonarr is not configured (set SONARR_URL and SONARR_API_KEY)');
	return cfg;
}

function req<T>(path: string, opts?: ArrRequestOptions): Promise<T> {
	return arrRequest<T>(requireSonarr(), path, opts);
}

export const sonarr = {
	ping: () => arrPing(requireSonarr()),

	// GET /api/v3/series
	series: () => req<SeriesResource[]>('series'),
	// GET /api/v3/series/{id}
	seriesById: (id: number) => req<SeriesResource>(`series/${id}`),
	// GET /api/v3/episode?seriesId={id}
	episodes: (seriesId: number) => req<EpisodeResource[]>('episode', { query: { seriesId } }),
	// GET /api/v3/episode/{id}
	episodeById: (id: number) => req<EpisodeResource>(`episode/${id}`),

	// GET /api/v3/queue
	queue: () =>
		req<PagingResource<SonarrQueueResource>>('queue', {
			query: { pageSize: 200, includeSeries: true, includeEpisode: true }
		}),

	// GET /api/v3/history
	history: (query: Record<string, string | number> = {}) =>
		req<PagingResource<SonarrHistoryResource>>('history', {
			query: { pageSize: 50, sortKey: 'date', sortDirection: 'descending', ...query }
		}),

	// GET /api/v3/blocklist
	blocklist: () =>
		req<PagingResource<BlocklistResource>>('blocklist', {
			query: { pageSize: 50, sortKey: 'date', sortDirection: 'descending' }
		}),

	// GET /api/v3/wanted/missing
	wantedMissing: (page = 1) =>
		req<PagingResource<EpisodeResource>>('wanted/missing', {
			query: {
				page,
				pageSize: 50,
				sortKey: 'airDateUtc',
				sortDirection: 'descending',
				includeSeries: true
			}
		}),
	// GET /api/v3/wanted/cutoff
	wantedCutoff: (page = 1) =>
		req<PagingResource<EpisodeResource>>('wanted/cutoff', {
			query: {
				page,
				pageSize: 50,
				sortKey: 'airDateUtc',
				sortDirection: 'descending',
				includeSeries: true
			}
		}),

	// GET /api/v3/calendar?start=&end=
	calendar: (start: string, end: string) =>
		req<EpisodeResource[]>('calendar', {
			query: { start, end, includeSeries: true, unmonitored: true }
		}),

	// GET /api/v3/release?seriesId=&episodeId=  (interactive search)
	release: (query: { seriesId?: number; episodeId?: number; seasonNumber?: number }) =>
		req<SonarrReleaseResource[]>('release', { query }),

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

	// GET /api/v3/series/lookup?term=
	lookup: (term: string) => req<SeriesResource[]>('series/lookup', { query: { term } }),

	// POST /api/v3/command
	command: (body: { name: string } & Record<string, unknown>) =>
		req<CommandResource>('command', { method: 'POST', body })
};
