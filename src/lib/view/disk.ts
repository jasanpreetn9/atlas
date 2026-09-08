// Turns Sonarr/Radarr root folders + disk mounts into the rows the Dashboard shows.
// Both apps report every OS mount from /diskspace (often overlapping); what a user
// actually cares about is free space on the folders their library lives in.

import type { DiskSpaceResource, RootFolderResource } from '$lib/api/common';
import { formatBytes } from './format';

export interface DiskRow {
	key: string;
	path: string;
	/** Mount that backs this folder (for de-duping in the sidebar summary). */
	mount: string;
	freeBytes: number;
	totalBytes: number;
	usedBytes: number;
	pct: string;
	ratio: number;
	fill: string;
	label: string;
}

function backingMount(
	folderPath: string,
	mounts: DiskSpaceResource[]
): DiskSpaceResource | undefined {
	let best: DiskSpaceResource | undefined;
	for (const m of mounts) {
		if (!m.path) continue;
		const mp = m.path.endsWith('/') ? m.path : `${m.path}/`;
		if (folderPath === m.path || folderPath.startsWith(mp)) {
			if (!best || (m.path.length ?? 0) > (best.path?.length ?? 0)) best = m;
		}
	}
	return best;
}

export function rootFolderDisks(
	roots: RootFolderResource[],
	mounts: DiskSpaceResource[]
): DiskRow[] {
	const seen = new Set<string>();
	const out: DiskRow[] = [];
	for (const rf of roots) {
		if (!rf.path || seen.has(rf.path)) continue;
		seen.add(rf.path);
		const mount = backingMount(rf.path, mounts);
		const total = mount?.totalSpace ?? 0;
		const free = rf.freeSpace ?? mount?.freeSpace ?? 0;
		const used = total > 0 ? Math.max(0, total - free) : 0;
		const ratio = total > 0 ? used / total : 0;
		out.push({
			key: rf.path,
			path: rf.path,
			mount: mount?.path ?? rf.path,
			freeBytes: free,
			totalBytes: total,
			usedBytes: used,
			ratio,
			pct: total > 0 ? `${Math.round(ratio * 100)}%` : '0%',
			fill: ratio > 0.9 ? 'var(--err)' : ratio > 0.75 ? 'var(--warn)' : 'var(--sec)',
			label:
				total > 0
					? `${formatBytes(free)} free · ${formatBytes(total)}`
					: `${formatBytes(free)} free`
		});
	}
	return out;
}

/** One line for the sidebar: total free / total capacity across distinct backing mounts. */
export function diskSummary(rows: DiskRow[]): { summary: string; pct: string } {
	const byMount = new Map<string, DiskRow>();
	for (const r of rows) if (!byMount.has(r.mount)) byMount.set(r.mount, r);
	let free = 0;
	let total = 0;
	for (const r of byMount.values()) {
		free += r.freeBytes;
		total += r.totalBytes;
	}
	const used = Math.max(0, total - free);
	return {
		summary:
			total > 0 ? `${formatBytes(free)} free / ${formatBytes(total)}` : `${formatBytes(free)} free`,
		pct: total > 0 ? `${Math.round((used / total) * 100)}%` : '0%'
	};
}
