// Unified view model. Both SeriesResource and MovieResource collapse into `MediaItem`
// for the shared chrome (Dashboard, Library, Detail header); detail panes still read
// the raw resource for season / file / cast data.

import type { SeriesResource, EpisodeResource } from '$lib/api/sonarr';
import type { MovieResource } from '$lib/api/radarr';
import type { MediaCover } from '$lib/api/common';
import type { QueueItem } from '$lib/api/client';
import { deriveMovieStatus, deriveSeriesStatus, type DerivedStatus } from './status';

export type MediaKind = 'series' | 'movie';

export interface MediaItem {
	/** Route param: `s:<sonarrId>` or `m:<radarrId>`. */
	id: string;
	rawId: number;
	kind: MediaKind;
	title: string;
	year: number;
	source: string; // network (series) or studio (movie)
	genres: string[];
	sizeBytes: number;
	haveCount: number;
	totalCount: number;
	monitored: boolean;
	qualityLabel: string; // quality profile name
	path: string;
	overview: string;
	ratingValue: number | null;
	added: string;
	status: DerivedStatus;
	/** Series only: ISO date of the next episode to air, or null. */
	nextAiring: string | null;
	/** Public poster URL (TMDb / TheTVDB), or null. */
	poster: string | null;
	tvdbId?: number;
	tmdbId?: number;
	imdbId?: string;
}

/** Pick a public poster URL from a MediaCover[]; downsize TMDb originals. */
export function posterUrl(images: MediaCover[] | undefined): string | null {
	const p = images?.find((i) => i.coverType === 'poster');
	const url = p?.remoteUrl || null;
	if (!url || !url.startsWith('http')) return null;
	return url.replace('image.tmdb.org/t/p/original/', 'image.tmdb.org/t/p/w342/');
}

/** Build a `seriesId|movieId` membership set from the merged queue. */
export function queueIndex(queue: QueueItem[]): { series: Set<number>; movie: Set<number> } {
	const series = new Set<number>();
	const movie = new Set<number>();
	for (const q of queue) {
		if ('seriesId' in q && q.seriesId != null) series.add(q.seriesId);
		if ('movieId' in q && q.movieId != null) movie.add(q.movieId);
	}
	return { series, movie };
}

export function seriesToMediaItem(
	s: SeriesResource,
	profiles: Map<number, string>,
	inQueue = false
): MediaItem {
	const st = s.statistics;
	return {
		id: `s:${s.id}`,
		rawId: s.id,
		kind: 'series',
		title: s.title ?? 'Untitled',
		year: s.year,
		source: s.network ?? '—',
		genres: s.genres ?? [],
		sizeBytes: st?.sizeOnDisk ?? 0,
		haveCount: st?.episodeFileCount ?? 0,
		totalCount: st?.totalEpisodeCount ?? 0,
		monitored: s.monitored,
		qualityLabel: profiles.get(s.qualityProfileId) ?? '—',
		path: s.path ?? '',
		overview: s.overview ?? '',
		ratingValue: s.ratings?.value ?? null,
		added: s.added,
		status: deriveSeriesStatus(s, inQueue),
		nextAiring: s.nextAiring ?? null,
		poster: posterUrl(s.images),
		tvdbId: s.tvdbId,
		imdbId: s.imdbId ?? undefined
	};
}

export function movieToMediaItem(
	m: MovieResource,
	profiles: Map<number, string>,
	inQueue = false
): MediaItem {
	const ratings = m.ratings ?? {};
	return {
		id: `m:${m.id}`,
		rawId: m.id,
		kind: 'movie',
		title: m.title ?? 'Untitled',
		year: m.year,
		source: m.studio ?? '—',
		genres: m.genres ?? [],
		sizeBytes: m.statistics?.sizeOnDisk ?? m.sizeOnDisk ?? 0,
		haveCount: m.hasFile ? 1 : 0,
		totalCount: 1,
		monitored: m.monitored,
		qualityLabel: profiles.get(m.qualityProfileId) ?? '—',
		path: m.path ?? '',
		overview: m.overview ?? '',
		ratingValue: ratings.imdb?.value ?? ratings.tmdb?.value ?? null,
		added: m.added,
		status: deriveMovieStatus(m, inQueue),
		nextAiring: null,
		poster: posterUrl(m.images),
		tmdbId: m.tmdbId,
		imdbId: m.imdbId ?? undefined
	};
}

/** Parse a `s:123` / `m:456` route id. */
export function parseMediaId(id: string): { kind: MediaKind; rawId: number } | null {
	const m = /^([sm]):(\d+)$/.exec(id);
	if (!m) return null;
	return { kind: m[1] === 's' ? 'series' : 'movie', rawId: +m[2] };
}

/** "1 file" / "no file" for a movie; "12/24" for a series. */
export function countLabel(it: MediaItem): string {
	if (it.kind === 'movie') return it.haveCount ? '1 file' : 'no file';
	return `${it.haveCount}/${it.totalCount}`;
}

export function seasonEpisodeSummary(episodes: EpisodeResource[]): {
	seasons: number;
	total: number;
	have: number;
} {
	const seasons = new Set<number>();
	let have = 0;
	for (const e of episodes) {
		if (e.seasonNumber > 0) seasons.add(e.seasonNumber);
		if (e.hasFile) have += 1;
	}
	return { seasons: seasons.size, total: episodes.length, have };
}
