// Server-only configuration for the upstream Sonarr / Radarr instances.
// Nothing here is ever sent to the browser. The API keys stay on the server and
// the client talks only to the same-origin proxy routes under /api/{sonarr,radarr}.

import { env } from '$env/dynamic/private';

export interface ArrConfig {
	/** Origin only, no trailing slash, e.g. `http://localhost:8989`. */
	origin: string;
	/** `origin` + `/api/v3`. */
	baseUrl: string;
	apiKey: string;
}

function build(url: string | undefined, apiKey: string | undefined): ArrConfig | null {
	if (!url || !apiKey) return null;
	const origin = url.trim().replace(/\/+$/, '');
	if (!origin) return null;
	return { origin, baseUrl: `${origin}/api/v3`, apiKey: apiKey.trim() };
}

export function getSonarrConfig(): ArrConfig | null {
	return build(env.SONARR_URL, env.SONARR_API_KEY);
}

export function getRadarrConfig(): ArrConfig | null {
	return build(env.RADARR_URL, env.RADARR_API_KEY);
}

export function isSonarrConfigured(): boolean {
	return getSonarrConfig() !== null;
}

export function isRadarrConfigured(): boolean {
	return getRadarrConfig() !== null;
}

/** True when at least one upstream instance is configured. */
export function isAnyArrConfigured(): boolean {
	return isSonarrConfigured() || isRadarrConfigured();
}
