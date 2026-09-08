// Display models for anything "activity feed" shaped:
//   - queue rows        (Dashboard "Downloading" widget + Activity → Queue)
//   - grouped grabs      (Dashboard "Recent grabs": one row per show + event)
//   - ungrouped history  (Activity → History: one row per event)
//   - blocklist rows     (Activity → Blocklist)

import type { HistoryItem, QueueItem } from '$lib/api/client';
import type { BlocklistResource } from '$lib/api/common';
import type { SeriesResource, SonarrQueueResource } from '$lib/api/sonarr';
import type { MovieResource, RadarrQueueResource } from '$lib/api/radarr';
import { episodeCode, formatBytes, qualityLabel, relativeAge, timeleftLabel } from './format';
import { eventColor, eventLabel } from './status';

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface QueueRow {
	key: string;
	tag: 'TV' | 'M';
	title: string;
	pct: string;
	pctNum: number;
	fill: string;
	size: string;
	eta: string;
	quality: string;
	client: string;
	indexer: string;
	protocol: string;
	release: string;
	status: string;
	badgeBg: string;
	badgeFg: string;
}

const IMPORT_STATES = new Set(['importing', 'imported', 'importPending', 'importBlocked']);

export function queueRow(q: QueueItem): QueueRow {
	const isSonarr = 'seriesId' in q;
	const size = q.size || 0;
	const done = size > 0 ? Math.min(1, Math.max(0, (size - q.sizeleft) / size)) : 0;
	const pctNum = Math.round(done * 100);
	const importing = IMPORT_STATES.has(q.trackedDownloadState);

	let tag: 'TV' | 'M' = 'M';
	let title = q.title ?? 'Unknown release';
	if (isSonarr) {
		tag = 'TV';
		const s = (q as SonarrQueueResource).series;
		const e = (q as SonarrQueueResource).episode;
		if (s?.title && e) title = `${s.title} · ${episodeCode(e.seasonNumber, e.episodeNumber)}`;
		else if (s?.title) title = s.title;
	} else {
		const m = (q as RadarrQueueResource).movie;
		if (m?.title) title = `${m.title} (${m.year})`;
	}

	return {
		key: String(q.id),
		tag,
		title,
		pct: `${pctNum}%`,
		pctNum,
		fill: importing ? 'var(--ok)' : 'var(--accent)',
		size: formatBytes(size),
		eta: importing ? 'importing' : timeleftLabel(q.timeleft),
		quality: qualityLabel(q.quality),
		client: q.downloadClient ?? '—',
		indexer: q.indexer ?? '—',
		protocol: q.protocol,
		release: q.title ?? '',
		status: importing ? 'Importing' : 'Downloading',
		badgeBg: importing ? 'rgba(0,202,81,.10)' : 'rgba(0,112,243,.10)',
		badgeFg: importing ? 'var(--ok)' : 'var(--accent)'
	};
}

// ---------------------------------------------------------------------------
// Grouped grabs (Dashboard "Recent grabs")
// ---------------------------------------------------------------------------

function resolve(
	h: HistoryItem,
	seriesById: Map<number, SeriesResource>,
	moviesById: Map<number, MovieResource>
): { title: string; href: string; kind: 'series' | 'movie' } {
	if ('seriesId' in h) {
		const s = h.series ?? seriesById.get(h.seriesId);
		return {
			title: s?.title ?? h.sourceTitle ?? '—',
			href: s ? `/library/s:${s.id}` : '',
			kind: 'series'
		};
	}
	const m = h.movie ?? moviesById.get(h.movieId);
	return {
		title: m?.title ?? h.sourceTitle ?? '—',
		href: m ? `/library/m:${m.id}` : '',
		kind: 'movie'
	};
}

const CODE_RE = /S(\d{1,3})E(\d{1,4})/i;

function parseCode(src: string | null | undefined): { season: number; episode: number } | null {
	if (!src) return null;
	const m = CODE_RE.exec(src);
	return m ? { season: +m[1], episode: +m[2] } : null;
}

/** [{s:1,e:1},{s:1,e:2},{s:1,e:3},{s:2,e:1}] → "S01 E1–E3 · S02 E1". */
export function summarizeEpisodes(eps: { season: number; episode: number }[]): string {
	if (eps.length === 0) return '';
	const bySeason = new Map<number, number[]>();
	for (const e of eps) {
		const arr = bySeason.get(e.season) ?? [];
		arr.push(e.episode);
		bySeason.set(e.season, arr);
	}
	const parts: string[] = [];
	for (const season of [...bySeason.keys()].sort((a, b) => a - b)) {
		const nums = [...new Set(bySeason.get(season))].sort((a, b) => a - b);
		const runs: string[] = [];
		let start = nums[0];
		let prev = nums[0];
		for (let i = 1; i <= nums.length; i++) {
			if (nums[i] === prev + 1) {
				prev = nums[i];
				continue;
			}
			runs.push(start === prev ? `E${start}` : `E${start}–E${prev}`);
			start = nums[i];
			prev = nums[i];
		}
		parts.push(`S${String(season).padStart(2, '0')} ${runs.join(', ')}`);
	}
	return parts.join(' · ');
}

export interface GrabGroup {
	key: string;
	color: string;
	title: string;
	event: string;
	/** "S01 E1–E6" for series, "" for movies / no parseable codes. */
	summary: string;
	count: number;
	ago: string;
	latest: number;
	href: string;
}

/**
 * Condense a history list into one row per (title, eventType). Series rows carry an
 * episode summary; a group with no parseable codes falls back to "N episodes".
 */
export function groupGrabs(
	history: HistoryItem[],
	seriesById: Map<number, SeriesResource>,
	moviesById: Map<number, MovieResource>,
	now = new Date()
): GrabGroup[] {
	interface Acc {
		title: string;
		href: string;
		event: HistoryItem['eventType'];
		kind: 'series' | 'movie';
		eps: { season: number; episode: number }[];
		latest: number;
		count: number;
	}
	const groups = new Map<string, Acc>();

	for (const h of history) {
		const { title, href, kind } = resolve(h, seriesById, moviesById);
		const key = `${title}||${h.eventType}`;
		let g = groups.get(key);
		if (!g) {
			g = { title, href, event: h.eventType, kind, eps: [], latest: 0, count: 0 };
			groups.set(key, g);
		}
		g.count += 1;
		const t = Date.parse(h.date);
		if (t > g.latest) g.latest = t;
		if (kind === 'series') {
			const ep = 'episode' in h ? h.episode : undefined;
			const code = ep
				? { season: ep.seasonNumber, episode: ep.episodeNumber }
				: parseCode(h.sourceTitle);
			if (code) g.eps.push(code);
		}
	}

	return [...groups.values()]
		.sort((a, b) => b.latest - a.latest)
		.map((g) => ({
			key: `${g.title}|${g.event}`,
			color: eventColor(g.event),
			title: g.title,
			event: eventLabel(g.event),
			summary:
				g.kind === 'series'
					? summarizeEpisodes(g.eps) || (g.count > 1 ? `${g.count} episodes` : '')
					: '',
			count: g.count,
			ago: relativeAge(new Date(g.latest).toISOString(), now),
			latest: g.latest,
			href: g.href
		}));
}

// ---------------------------------------------------------------------------
// Ungrouped history + blocklist (Activity screen)
// ---------------------------------------------------------------------------

export type HistFilter = 'All' | 'Grabbed' | 'Imported' | 'Failed' | 'Deleted';

export const HIST_FILTERS: HistFilter[] = ['All', 'Grabbed', 'Imported', 'Failed', 'Deleted'];

export function matchesHistFilter(eventType: string, f: HistFilter): boolean {
	switch (f) {
		case 'All':
			return true;
		case 'Grabbed':
			return eventType === 'grabbed';
		case 'Imported':
			return eventType.endsWith('Imported');
		case 'Failed':
			return eventType === 'downloadFailed';
		case 'Deleted':
			return eventType === 'episodeFileDeleted' || eventType === 'movieFileDeleted';
	}
}

export interface HistoryRow {
	key: string;
	kind: 'series' | 'movie';
	tag: 'TV' | 'M';
	event: string;
	eventType: string;
	color: string;
	title: string;
	href: string;
	quality: string;
	indexer: string;
	score: string;
	scoreNum: number;
	ago: string;
	sourceTitle: string;
}

export function historyRows(
	history: HistoryItem[],
	seriesById: Map<number, SeriesResource>,
	moviesById: Map<number, MovieResource>,
	now = new Date()
): HistoryRow[] {
	return history.map((h, i) => {
		let kind: 'series' | 'movie';
		let tag: 'TV' | 'M';
		let title: string;
		let href = '';
		if ('seriesId' in h) {
			kind = 'series';
			tag = 'TV';
			const s = h.series ?? seriesById.get(h.seriesId);
			const ep = h.episode;
			const code = ep ? episodeCode(ep.seasonNumber, ep.episodeNumber) : '';
			title = s?.title ? (code ? `${s.title} · ${code}` : s.title) : (h.sourceTitle ?? '—');
			if (s) href = `/library/s:${s.id}`;
		} else {
			kind = 'movie';
			tag = 'M';
			const m = h.movie ?? moviesById.get(h.movieId);
			title = m?.title ? `${m.title} (${m.year})` : (h.sourceTitle ?? '—');
			if (m) href = `/library/m:${m.id}`;
		}
		const scoreNum = h.customFormatScore ?? 0;
		return {
			key: `${h.eventType}-${h.id}-${i}`,
			kind,
			tag,
			event: eventLabel(h.eventType),
			eventType: h.eventType,
			color: eventColor(h.eventType),
			title,
			href,
			quality: h.quality?.quality?.name ?? '—',
			indexer: (h.data?.['indexer'] as string) ?? '—',
			score: `${scoreNum > 0 ? '+' : ''}${scoreNum}`,
			scoreNum,
			ago: relativeAge(h.date, now),
			sourceTitle: h.sourceTitle ?? ''
		};
	});
}

export interface BlocklistRow {
	key: string;
	tag: 'TV' | 'M';
	release: string;
	indexer: string;
	reason: string;
	protocol: string;
	quality: string;
	ago: string;
	href: string;
}

export function blocklistRows(
	list: BlocklistResource[],
	seriesById: Map<number, SeriesResource>,
	moviesById: Map<number, MovieResource>,
	now = new Date()
): BlocklistRow[] {
	return list.map((b) => {
		let tag: 'TV' | 'M' = 'M';
		let href = '';
		if (b.seriesId != null) {
			tag = 'TV';
			const s = seriesById.get(b.seriesId);
			if (s) href = `/library/s:${s.id}`;
		} else if (b.movieId != null) {
			const m = moviesById.get(b.movieId);
			if (m) href = `/library/m:${m.id}`;
		}
		return {
			key: String(b.id),
			tag,
			release: b.sourceTitle ?? '—',
			indexer: b.indexer ?? '—',
			reason: b.message ?? '—',
			protocol: b.protocol,
			quality: b.quality?.quality?.name ?? '—',
			ago: relativeAge(b.date, now),
			href
		};
	});
}
