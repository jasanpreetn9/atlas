// "Needs action" rows: monitored titles that are missing / below cutoff (the Wanted
// screen), plus the Dashboard's condensed "needs attention" list and recent failures.
// Pure display mapping. Pages add the per-row action clusters.

import type { WantedKind, HistoryItem } from '$lib/api/client';
import type { EpisodeResource, SeriesResource } from '$lib/api/sonarr';
import type { MovieResource } from '$lib/api/radarr';
import { airLabel, episodeCode, relativeAge } from './format';

function isEpisode(r: EpisodeResource | MovieResource): r is EpisodeResource {
	return 'seriesId' in r && 'episodeNumber' in r;
}

function ms(iso: string | null | undefined): number {
	if (!iso) return 0;
	const t = Date.parse(iso);
	return Number.isNaN(t) ? 0 : t;
}

function past(iso: string | null | undefined, now: Date): boolean {
	if (!iso) return false;
	const t = Date.parse(iso);
	return !Number.isNaN(t) && t <= now.getTime();
}

function since(iso: string | null | undefined, verb: string, now: Date): string {
	if (!iso) return '';
	const age = relativeAge(iso, now);
	if (!age) return '';
	return age === 'now' ? `${verb} just now` : `${verb} ${age} ago`;
}

/** A movie is only worth flagging once a home release has actually landed. */
function movieIsGrabbable(m: MovieResource, now: Date): boolean {
	if (m.isAvailable === false) return false;
	return past(m.digitalRelease, now) || past(m.physicalRelease, now);
}

// ---------------------------------------------------------------------------
// Wanted screen
// ---------------------------------------------------------------------------

export type WantedMode = 'missing' | 'cutoff';

export interface WantedRow {
	key: string;
	kind: 'series' | 'movie';
	tag: 'TV' | 'M';
	title: string;
	code: string;
	/** "Today" / "Tomorrow" / "Mon" / "Sep 4 2026" / "TBA". */
	air: string;
	/** Epoch ms of the air / release date, for sorting; 0 when unknown. */
	airMs: number;
	detail: string;
	status: 'missing' | 'upgrading';
	href: string;
	/** Set for series rows. */
	seriesId?: number;
	episodeId?: number;
	/** Set for movie rows. */
	movieId?: number;
	monitored: boolean;
	/** Human label for the interactive-search subject and toasts. */
	searchLabel: string;
}

export function buildWantedRows(
	records: (EpisodeResource | MovieResource)[],
	kind: WantedKind,
	mode: WantedMode,
	seriesById: Map<number, SeriesResource>,
	moviesById: Map<number, MovieResource>,
	now = new Date()
): WantedRow[] {
	return records.flatMap((rec): WantedRow[] => {
		if (kind === 'series' && isEpisode(rec)) {
			const series = rec.series ?? seriesById.get(rec.seriesId);
			const title = series?.title ?? 'Unknown series';
			const code = episodeCode(rec.seasonNumber, rec.episodeNumber);
			const detail =
				mode === 'missing'
					? `Monitored · ${series?.network ?? 'Sonarr'}`
					: `${rec.episodeFile?.quality?.quality?.name ?? 'Has file'} · below cutoff`;
			return [
				{
					key: `${mode}-s${rec.id}`,
					kind: 'series',
					tag: 'TV',
					title,
					code,
					air: airLabel(rec.airDateUtc, now),
					airMs: ms(rec.airDateUtc),
					detail,
					status: mode === 'missing' ? 'missing' : 'upgrading',
					href: `/library/s:${rec.seriesId}`,
					seriesId: rec.seriesId,
					episodeId: rec.id,
					monitored: rec.monitored,
					searchLabel: `${title} ${code}`
				}
			];
		}

		const full = moviesById.get((rec as MovieResource).id) ?? (rec as MovieResource);
		const title = full.title ?? 'Unknown movie';
		const date = full.digitalRelease ?? full.physicalRelease ?? full.inCinemas;
		const detail =
			mode === 'missing'
				? `Monitored · ${full.studio ?? 'Radarr'}`
				: `${full.movieFile?.quality?.quality?.name ?? 'Has file'} · below cutoff`;
		return [
			{
				key: `${mode}-m${full.id}`,
				kind: 'movie',
				tag: 'M',
				title,
				code: String(full.year),
				air: airLabel(date, now),
				airMs: ms(date),
				detail,
				status: mode === 'missing' ? 'missing' : 'upgrading',
				href: `/library/m:${full.id}`,
				movieId: full.id,
				monitored: full.monitored,
				searchLabel: `${title} (${full.year})`
			}
		];
	});
}

// ---------------------------------------------------------------------------
// Dashboard "Needs attention"
// ---------------------------------------------------------------------------

export interface SearchCommand {
	app: WantedKind;
	body: { name: string } & Record<string, unknown>;
}

export interface AttentionRow {
	key: string;
	kind: 'series' | 'movie';
	tag: 'TV' | 'M';
	title: string;
	code: string;
	sub: string;
	/** e.g. "aired 3d ago", "released just now", "2h ago". */
	whenLabel: string;
	href: string;
	search: SearchCommand;
}

export function missingRows(
	records: (EpisodeResource | MovieResource)[],
	kind: WantedKind,
	seriesById: Map<number, SeriesResource>,
	now = new Date()
): AttentionRow[] {
	return records.flatMap((rec): AttentionRow[] => {
		if (kind === 'series' && isEpisode(rec)) {
			const title = rec.series?.title ?? seriesById.get(rec.seriesId)?.title ?? 'Unknown series';
			return [
				{
					key: `me${rec.id}`,
					kind: 'series',
					tag: 'TV',
					title,
					code: episodeCode(rec.seasonNumber, rec.episodeNumber),
					sub: rec.title ?? '',
					whenLabel: since(rec.airDateUtc, 'aired', now),
					href: `/library/s:${rec.seriesId}`,
					search: { app: 'series', body: { name: 'EpisodeSearch', episodeIds: [rec.id] } }
				}
			];
		}
		const m = rec as MovieResource;
		if (!movieIsGrabbable(m, now)) return [];
		return [
			{
				key: `mm${m.id}`,
				kind: 'movie',
				tag: 'M',
				title: m.title ?? 'Unknown movie',
				code: String(m.year),
				sub: '',
				whenLabel: since(m.digitalRelease ?? m.physicalRelease, 'released', now),
				href: `/library/m:${m.id}`,
				search: { app: 'movie', body: { name: 'MoviesSearch', movieIds: [m.id] } }
			}
		];
	});
}

export function failureRows(
	history: HistoryItem[],
	seriesById: Map<number, SeriesResource>,
	moviesById: Map<number, MovieResource>,
	now = new Date(),
	sinceMs = 24 * 60 * 60 * 1000
): AttentionRow[] {
	const cutoff = now.getTime() - sinceMs;
	const out: AttentionRow[] = [];
	const seen = new Set<string>();

	for (const h of history) {
		if (h.eventType !== 'downloadFailed') continue;
		if (Date.parse(h.date) < cutoff) continue;

		if ('seriesId' in h) {
			const s = h.series ?? seriesById.get(h.seriesId);
			const ep = h.episode;
			const code = ep ? episodeCode(ep.seasonNumber, ep.episodeNumber) : '';
			const key = `fs${h.seriesId}:${h.episodeId}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({
				key,
				kind: 'series',
				tag: 'TV',
				title: s?.title ?? h.sourceTitle ?? 'Unknown series',
				code,
				sub: 'grab failed',
				whenLabel: `${relativeAge(h.date, now)} ago`,
				href: s ? `/library/s:${s.id}` : '',
				search: { app: 'series', body: { name: 'EpisodeSearch', episodeIds: [h.episodeId] } }
			});
		} else {
			const m = h.movie ?? moviesById.get(h.movieId);
			const key = `fm${h.movieId}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({
				key,
				kind: 'movie',
				tag: 'M',
				title: m?.title ?? h.sourceTitle ?? 'Unknown movie',
				code: m ? String(m.year) : '',
				sub: 'grab failed',
				whenLabel: `${relativeAge(h.date, now)} ago`,
				href: m ? `/library/m:${m.id}` : '',
				search: { app: 'movie', body: { name: 'MoviesSearch', movieIds: [h.movieId] } }
			});
		}
	}
	return out;
}
