// Pure display formatters. Take raw Sonarr/Radarr values, return strings for the UI.

import type { QualityModel } from '$lib/api/common';

export function pad(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

/** Bytes → "1.4 TB" / "12.3 GB" / "820 MB" / "512 KB" (mirrors the design's `gb()`). */
export function formatBytes(bytes: number | null | undefined): string {
	if (!bytes || bytes < 0) return '0 B';
	const gb = bytes / 1_073_741_824;
	if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
	if (gb >= 1) return `${gb.toFixed(1)} GB`;
	const mb = bytes / 1_048_576;
	if (mb >= 1) return `${Math.round(mb)} MB`;
	return `${Math.round(bytes / 1024)} KB`;
}

/** Split for the two-line stat card on the dashboard: ["12.3", "GB"]. */
export function splitBytes(bytes: number | null | undefined): [string, string] {
	const [value, unit] = formatBytes(bytes).split(' ');
	return [value, unit ?? ''];
}

export function episodeCode(season: number, episode: number): string {
	return `S${pad(season)}E${pad(episode)}`;
}

export function qualityLabel(q: QualityModel | null | undefined): string {
	return q?.quality?.name ?? '—';
}

export function runtimeLabel(minutes: number | null | undefined): string {
	if (!minutes) return '—';
	return `${minutes} Minutes`;
}

export function ratingLabel(value: number | null | undefined): string {
	return value ? value.toFixed(1) : '—';
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
	if (!iso) return null;
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return null;
	return Math.round((t - now.getTime()) / 86_400_000);
}

/** "Today" / "Tomorrow" / "Mon 4 Sep 2026" for an air date. */
export function airLabel(iso: string | null | undefined, now = new Date()): string {
	if (!iso) return 'TBA';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return 'TBA';
	const days = daysUntil(iso, now);
	if (days === 0) return 'Today';
	if (days === 1) return 'Tomorrow';
	if (days !== null && days > 1 && days <= 7) return DOW[d.getDay()];
	return `${MON[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

export function timeLabel(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "3d" / "5h" / "2w" / "now" for an elapsed timestamp. */
export function relativeAge(iso: string | null | undefined, now = new Date()): string {
	if (!iso) return '';
	const ms = now.getTime() - Date.parse(iso);
	if (Number.isNaN(ms)) return '';
	const min = Math.floor(ms / 60_000);
	if (min < 1) return 'now';
	if (min < 60) return `${min}m`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h`;
	const day = Math.floor(hr / 24);
	if (day < 14) return `${day}d`;
	const wk = Math.floor(day / 7);
	if (wk < 9) return `${wk}w`;
	return `${Math.floor(day / 30)}mo`;
}

/** `relativeAge` with the trailing "ago", e.g. "3d ago" / "just now" (not "now ago"). */
export function agoLabel(iso: string | null | undefined, now = new Date()): string {
	const a = relativeAge(iso, now);
	if (!a) return '—';
	return a === 'now' ? 'just now' : `${a} ago`;
}

/** ISO-8601 duration ("PT1H23M") or Sonarr timespan ("1:23:00") → "1h 23m left". */
export function timeleftLabel(v: string | null | undefined): string {
	if (!v) return '—';
	let h = 0;
	let m = 0;
	const iso = /P(?:.*?T)?(?:(\d+)H)?(?:(\d+)M)?/.exec(v);
	if (v.startsWith('P') && iso) {
		h = +(iso[1] ?? 0);
		m = +(iso[2] ?? 0);
	} else {
		const parts = v.split(':').map(Number);
		if (parts.length === 3) [h, m] = parts;
		else if (parts.length === 2) [h, m] = [0, parts[0]];
	}
	const total = h * 60 + m;
	if (total <= 0) return 'any moment';
	return h >= 1 ? `${h}h ${m}m left` : `${m}m left`;
}

export function pct(part: number, whole: number): string {
	if (!whole) return '0%';
	return `${Math.round((part / whole) * 100)}%`;
}
