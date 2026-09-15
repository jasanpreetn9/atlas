// Row models for the System screen. Each tab is a flat list of `SysRow`
// (`a` = label, `b` = value, `c` = meta, `dot` = optional status colour).

import type {
	BackupResource,
	HealthResource,
	LogFileResource,
	SystemResource,
	TaskResource,
	UpdateResource
} from '$lib/api/common';
import { agoLabel, airLabel, formatBytes, relativeAge } from './format';

export interface SysRow {
	key: string;
	a: string;
	b: string;
	c: string;
	dot: string | null;
	href?: string;
}

const HEALTH_DOT: Record<string, string> = {
	ok: 'var(--ok)',
	notice: 'var(--accent)',
	warning: 'var(--warn)',
	error: 'var(--err)'
};

function join(parts: (string | null | undefined)[], sep = ' '): string {
	return parts.filter((p): p is string => !!p).join(sep);
}

export function statusRows(sys: SystemResource, now = new Date()): SysRow[] {
	const up = relativeAge(sys.startTime, now);
	return [
		{ key: 'ver', a: 'Version', b: sys.version ?? '—', c: sys.branch ?? '', dot: null },
		{
			key: 'rt',
			a: 'Runtime',
			b: join([sys.runtimeName, sys.runtimeVersion]) || '—',
			c: join([sys.osName, sys.osVersion]),
			dot: null
		},
		{
			key: 'db',
			a: 'Database',
			b: join([sys.databaseType ?? 'SQLite', sys.databaseVersion ?? sys.sqliteVersion]) || '—',
			c: `migration ${sys.migrationVersion}`,
			dot: null
		},
		{ key: 'appdata', a: 'App data', b: sys.appData ?? '—', c: '', dot: null },
		{
			key: 'started',
			a: 'Started',
			b: airLabel(sys.startTime, now),
			c: up ? `up ${up}` : '',
			dot: null
		},
		{
			key: 'mode',
			a: 'Mode',
			b: join([sys.mode, sys.isDocker ? 'docker' : null], ' · ') || '—',
			c: sys.packageUpdateMechanism ?? '',
			dot: null
		},
		{ key: 'auth', a: 'Authentication', b: sys.authentication || '—', c: '', dot: null }
	];
}

function intervalLabel(min: number): string {
	if (!min) return 'manual';
	if (min < 60) return `every ${min}m`;
	if (min < 1440) return `every ${Math.round(min / 60)}h`;
	return `every ${Math.round(min / 1440)}d`;
}

function nextLabel(iso: string, now: Date): string {
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return '';
	const ms = t - now.getTime();
	if (ms <= 0) return 'due now';
	const min = Math.round(ms / 60_000);
	if (min < 60) return `in ${min}m`;
	const hr = Math.round(min / 60);
	if (hr < 48) return `in ${hr}h`;
	return `in ${Math.round(hr / 24)}d`;
}

export function taskRows(tasks: TaskResource[], now = new Date()): SysRow[] {
	return tasks.map((t) => ({
		key: `t${t.id}`,
		a: t.name ?? t.taskName ?? '—',
		b: intervalLabel(t.interval),
		c: nextLabel(t.nextExecution, now),
		dot: null
	}));
}

export function updateRows(updates: UpdateResource[], now = new Date()): SysRow[] {
	return [...updates]
		.sort((a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate))
		.map((u) => ({
			key: `u${u.id}-${u.version}`,
			a: u.version ?? '—',
			b: join([u.branch, airLabel(u.releaseDate, now)], ' · '),
			c: u.installed ? 'installed' : u.latest ? 'latest' : u.installable ? 'installable' : '',
			dot: u.installed ? 'var(--ok)' : u.latest ? 'var(--accent)' : null
		}));
}

export function backupRows(backups: BackupResource[], now = new Date()): SysRow[] {
	return [...backups]
		.sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
		.map((bk) => ({
			key: `b${bk.id}`,
			a: bk.name ?? '—',
			b: bk.path ?? '',
			c: join([formatBytes(bk.size), agoLabel(bk.time, now)], ' · '),
			dot: bk.type === 'scheduled' ? 'var(--neutral)' : 'var(--accent)'
		}));
}

export function logRows(logs: LogFileResource[], now = new Date()): SysRow[] {
	return [...logs]
		.sort((a, b) => Date.parse(b.lastWriteTime) - Date.parse(a.lastWriteTime))
		.map((l) => ({
			key: `l${l.id}-${l.filename}`,
			a: l.filename ?? '—',
			b: '',
			c: agoLabel(l.lastWriteTime, now),
			dot: null
		}));
}

export function healthRows(health: HealthResource[]): SysRow[] {
	return health.map((h, i) => ({
		key: `h${h.id ?? i}-${h.source}`,
		a: h.source ?? 'Health',
		b: h.message ?? '',
		c: h.type,
		dot: HEALTH_DOT[h.type] ?? 'var(--muted)',
		href: h.wikiUrl ?? undefined
	}));
}
