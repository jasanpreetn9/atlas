// Groups a series' episodes into seasons for the Detail page, joining in the
// separately-fetched episode files (Sonarr's /episode response has no file details).

import type { EpisodeFileResource, EpisodeResource } from '$lib/api/sonarr';
import { deriveEpisodeStatus, type DerivedStatus } from './status';
import { airLabel, episodeCode, formatBytes, pad, timeLabel } from './format';

export interface EpisodeRow {
	key: string;
	id: number;
	n: number;
	code: string;
	title: string;
	badge: string | null;
	air: string;
	airTime: string;
	codec: string;
	audio: string;
	subs: string;
	group: string;
	score: string;
	quality: string;
	path: string;
	sizeBytes: number;
	size: string;
	overview: string;
	status: DerivedStatus;
	hasFile: boolean;
	monitored: boolean;
}

export interface SeasonGroup {
	key: string;
	n: number;
	label: string;
	count: number;
	have: number;
	sizeBytes: number;
	episodes: EpisodeRow[];
}

const FINALE_LABEL: Record<string, string> = {
	series: 'Series Finale',
	season: 'Season Finale',
	midseason: 'Midseason Finale'
};

export function buildSeasons(
	episodes: EpisodeResource[],
	files: EpisodeFileResource[],
	inQueueEpisodeIds: Set<number>,
	now = new Date()
): SeasonGroup[] {
	const fileById = new Map(files.map((f) => [f.id, f]));
	const bySeason = new Map<number, EpisodeResource[]>();
	for (const e of episodes) {
		const arr = bySeason.get(e.seasonNumber);
		if (arr) arr.push(e);
		else bySeason.set(e.seasonNumber, [e]);
	}

	const seasons: SeasonGroup[] = [];
	for (const n of [...bySeason.keys()].sort((a, b) => a - b)) {
		const eps = bySeason
			.get(n)!
			.slice()
			.sort((a, b) => a.episodeNumber - b.episodeNumber);

		const rows: EpisodeRow[] = eps.map((e) => {
			const file = e.episodeFileId ? fileById.get(e.episodeFileId) : undefined;
			return {
				key: episodeCode(e.seasonNumber, e.episodeNumber),
				id: e.id,
				n: e.episodeNumber,
				code: episodeCode(e.seasonNumber, e.episodeNumber),
				title: e.title ?? 'TBA',
				badge: e.finaleType ? (FINALE_LABEL[e.finaleType] ?? null) : null,
				air: airLabel(e.airDateUtc, now),
				airTime: timeLabel(e.airDateUtc),
				codec: file?.mediaInfo?.videoCodec ?? '',
				audio: file?.languages?.length ? file.languages.map((l) => l.name).join(', ') : '',
				subs: file?.mediaInfo?.subtitles ?? '',
				group: file?.releaseGroup ?? '',
				score:
					file?.customFormatScore != null
						? `${file.customFormatScore > 0 ? '+' : ''}${file.customFormatScore}`
						: '',
				quality: file?.quality?.quality?.name ?? '',
				path: file?.relativePath ?? '',
				sizeBytes: file?.size ?? 0,
				size: file ? formatBytes(file.size) : '—',
				overview: e.overview ?? '',
				status: deriveEpisodeStatus(e, inQueueEpisodeIds.has(e.id)),
				hasFile: e.hasFile,
				monitored: e.monitored
			};
		});

		seasons.push({
			key: `s${n}`,
			n,
			label: n === 0 ? 'Specials' : `Season ${pad(n)}`,
			count: rows.length,
			have: rows.filter((r) => r.hasFile).length,
			sizeBytes: rows.reduce((sum, r) => sum + r.sizeBytes, 0),
			episodes: rows
		});
	}
	return seasons;
}
