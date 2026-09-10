import { createHttpApi } from '$lib/api/client';
import type { PageLoad } from './$types';

// Per-app so the screen can show Sonarr and Radarr side by side. Every endpoint
// here is a GET, so the proxy's 8s response cache smooths repeat visits.
export const load: PageLoad = async ({ fetch }) => {
	const api = createHttpApi(fetch);

	const settled = await Promise.allSettled([
		api.getSystemStatus(),
		api.status(),
		api.getHealth(),
		api.getTasks('series'),
		api.getTasks('movie'),
		api.getUpdates('series'),
		api.getUpdates('movie'),
		api.getBackups('series'),
		api.getBackups('movie'),
		api.getLogFiles('series'),
		api.getLogFiles('movie')
	]);

	const val = <T>(i: number, fallback: T): T =>
		settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

	type SysStatus = Awaited<ReturnType<typeof api.getSystemStatus>>;
	type Ping = Awaited<ReturnType<typeof api.status>>;
	type Health = Awaited<ReturnType<typeof api.getHealth>>;
	type Tasks = Awaited<ReturnType<typeof api.getTasks>>;
	type Updates = Awaited<ReturnType<typeof api.getUpdates>>;
	type Backups = Awaited<ReturnType<typeof api.getBackups>>;
	type Logs = Awaited<ReturnType<typeof api.getLogFiles>>;

	return {
		status: val(0, { sonarr: null, radarr: null } as SysStatus),
		ping: val(1, {
			sonarr: { configured: false, reachable: false },
			radarr: { configured: false, reachable: false },
			live: false
		} as Ping),
		health: val(2, [] as Health),
		tasks: { sonarr: val(3, [] as Tasks), radarr: val(4, [] as Tasks) },
		updates: { sonarr: val(5, [] as Updates), radarr: val(6, [] as Updates) },
		backups: { sonarr: val(7, [] as Backups), radarr: val(8, [] as Backups) },
		logs: { sonarr: val(9, [] as Logs), radarr: val(10, [] as Logs) }
	};
};
