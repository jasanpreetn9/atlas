// Flattens the merged Sonarr/Radarr calendar feed into dated events for the
// month grid and the agenda list.

import type { CalendarItem } from '$lib/api/client';
import { deriveEpisodeStatus, deriveMovieStatus, type DerivedStatus } from './status';
import { episodeCode, pad, timeLabel } from './format';

export interface CalEvent {
	key: string;
	kind: 'series' | 'movie';
	tag: 'TV' | 'M';
	/** Epoch ms of the air / release moment; used for ordering. */
	at: number;
	/** Local `YYYY-MM-DD`, the key a grid cell matches on. */
	dayKey: string;
	/** `HH:MM` for episodes; empty for movie releases. */
	time: string;
	title: string;
	code: string;
	/** Episode title for series rows; empty for movies. */
	ep: string;
	status: DerivedStatus;
	href: string;
}

export function dayKey(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function calendarEvents(
	items: CalendarItem[],
	q: { series: Set<number>; movie: Set<number> }
): CalEvent[] {
	const out: CalEvent[] = [];
	for (const item of items) {
		if (item.kind === 'series') {
			if (!item.airDateUtc) continue;
			const d = new Date(item.airDateUtc);
			out.push({
				key: `s${item.id}`,
				kind: 'series',
				tag: 'TV',
				at: d.getTime(),
				dayKey: dayKey(d),
				time: timeLabel(item.airDateUtc),
				title: item.series?.title ?? 'Unknown series',
				code: episodeCode(item.seasonNumber, item.episodeNumber),
				ep: item.title ?? '',
				status: deriveEpisodeStatus(item, q.series.has(item.seriesId)),
				href: `/library/s:${item.seriesId}?ep=${item.id}`
			});
		} else {
			const iso = item.digitalRelease ?? item.physicalRelease ?? item.inCinemas;
			if (!iso) continue;
			const d = new Date(iso);
			out.push({
				key: `m${item.id}`,
				kind: 'movie',
				tag: 'M',
				at: d.getTime(),
				dayKey: dayKey(d),
				time: '',
				title: item.title ?? 'Unknown movie',
				code: String(item.year),
				ep: '',
				status: deriveMovieStatus(item, q.movie.has(item.id)),
				href: `/library/m:${item.id}`
			});
		}
	}
	return out.sort((a, b) => a.at - b.at);
}
