import { json } from '@sveltejs/kit';
import { getRadarrConfig, getSonarrConfig } from '$lib/server/config';
import { arrPing } from '$lib/server/http';
import type { RequestHandler } from './$types';

export interface AtlasStatus {
	sonarr: { configured: boolean; reachable: boolean };
	radarr: { configured: boolean; reachable: boolean };
	/** True when at least one upstream instance answered a ping. */
	live: boolean;
}

export const GET: RequestHandler = async () => {
	const sonarrCfg = getSonarrConfig();
	const radarrCfg = getRadarrConfig();

	const [sonarrReachable, radarrReachable] = await Promise.all([
		sonarrCfg ? arrPing(sonarrCfg) : Promise.resolve(false),
		radarrCfg ? arrPing(radarrCfg) : Promise.resolve(false)
	]);

	const status: AtlasStatus = {
		sonarr: { configured: sonarrCfg !== null, reachable: sonarrReachable },
		radarr: { configured: radarrCfg !== null, reachable: radarrReachable },
		live: sonarrReachable || radarrReachable
	};
	return json(status);
};
