// Derives the 7 display statuses from real Sonarr/Radarr fields, and the
// colour / label / badge maps the Atlas templates key off.

import type { EpisodeResource, SeriesResource } from '$lib/api/sonarr';
import type { MovieResource } from '$lib/api/radarr';
import type { EpisodeHistoryEventType } from '$lib/api/sonarr';
import type { MovieHistoryEventType } from '$lib/api/radarr';

export type DerivedStatus =
	'downloaded' | 'missing' | 'downloading' | 'upgrading' | 'unmonitored' | 'unaired' | 'failed';

export const STATUS_COLOR: Record<DerivedStatus, string> = {
	downloaded: 'var(--ok)',
	missing: 'var(--warn)',
	downloading: 'var(--accent)',
	upgrading: 'var(--accent)',
	unmonitored: 'var(--neutral)',
	failed: 'var(--err)',
	unaired: 'var(--muted)'
};

export const STATUS_LABEL: Record<DerivedStatus, string> = {
	downloaded: 'Downloaded',
	missing: 'Missing',
	downloading: 'Downloading',
	upgrading: 'Upgrading',
	unmonitored: 'Unmonitored',
	failed: 'Failed',
	unaired: 'Unaired'
};

export const STATUS_BADGE_BG: Record<DerivedStatus, string> = {
	downloaded: 'rgba(0,202,81,.10)',
	missing: 'rgba(245,166,35,.10)',
	downloading: 'rgba(0,112,243,.10)',
	upgrading: 'rgba(0,112,243,.10)',
	unmonitored: 'rgba(112,112,112,.12)',
	failed: 'rgba(238,0,0,.10)',
	unaired: 'transparent'
};

function isFuture(iso: string | null | undefined): boolean {
	if (!iso) return false;
	const t = Date.parse(iso);
	return !Number.isNaN(t) && t > Date.now();
}

export function deriveSeriesStatus(s: SeriesResource, inQueue = false): DerivedStatus {
	if (!s.monitored) return 'unmonitored';
	if (inQueue) return 'downloading';
	const st = s.statistics;
	if (!st) return 'missing';
	const aired = st.episodeCount; // episodes that have aired
	if (st.episodeFileCount >= aired && aired > 0) return 'downloaded';
	if (st.episodeFileCount === 0 && st.totalEpisodeCount > 0) return 'missing';
	if (st.episodeFileCount < aired) return 'missing';
	return 'downloaded';
}

export function deriveMovieStatus(m: MovieResource, inQueue = false): DerivedStatus {
	if (!m.monitored) return 'unmonitored';
	if (inQueue) return 'downloading';
	if (m.hasFile) {
		return m.movieFile?.qualityCutoffNotMet ? 'upgrading' : 'downloaded';
	}
	return m.isAvailable ? 'missing' : 'unaired';
}

export function deriveEpisodeStatus(e: EpisodeResource, inQueue = false): DerivedStatus {
	if (isFuture(e.airDateUtc)) return 'unaired';
	if (inQueue) return 'downloading';
	if (e.hasFile) {
		return e.episodeFile?.qualityCutoffNotMet ? 'upgrading' : 'downloaded';
	}
	return 'missing';
}

// ---- history events ----

type AnyHistoryEvent = EpisodeHistoryEventType | MovieHistoryEventType;

const EVENT_LABEL: Record<string, string> = {
	grabbed: 'Grabbed',
	downloadFolderImported: 'Imported',
	seriesFolderImported: 'Imported',
	movieFolderImported: 'Imported',
	downloadFailed: 'Failed',
	episodeFileDeleted: 'Deleted',
	movieFileDeleted: 'Deleted',
	episodeFileRenamed: 'Renamed',
	movieFileRenamed: 'Renamed',
	downloadIgnored: 'Ignored',
	unknown: 'Unknown'
};

const EVENT_COLOR: Record<string, string> = {
	grabbed: 'var(--accent)',
	downloadFolderImported: 'var(--ok)',
	seriesFolderImported: 'var(--ok)',
	movieFolderImported: 'var(--ok)',
	downloadFailed: 'var(--err)',
	episodeFileDeleted: 'var(--neutral)',
	movieFileDeleted: 'var(--neutral)',
	episodeFileRenamed: 'var(--neutral)',
	movieFileRenamed: 'var(--neutral)',
	downloadIgnored: 'var(--neutral)',
	unknown: 'var(--muted)'
};

export function eventLabel(ev: AnyHistoryEvent): string {
	return EVENT_LABEL[ev] ?? ev;
}

export function eventColor(ev: AnyHistoryEvent): string {
	return EVENT_COLOR[ev] ?? 'var(--muted)';
}
