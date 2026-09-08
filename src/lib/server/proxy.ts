// Shared implementation for the /api/sonarr/* and /api/radarr/* proxy routes.
// The browser calls these same-origin endpoints; the server attaches the API key
// and forwards to the upstream instance, so the key never reaches the client.

import { json, type RequestEvent } from '@sveltejs/kit';
import type { ArrConfig } from './config';
import { ArrError, arrRequest } from './http';

const FORWARD_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);

export async function proxyArr(
	app: 'sonarr' | 'radarr',
	cfg: ArrConfig | null,
	event: RequestEvent
): Promise<Response> {
	if (!cfg) {
		return json({ error: `${app} is not configured` }, { status: 503 });
	}

	const method = event.request.method.toUpperCase();
	if (!FORWARD_METHODS.has(method)) {
		return json({ error: `method ${method} not allowed` }, { status: 405 });
	}

	const path = event.params.path ?? '';
	if (!path || path.includes('..')) {
		return json({ error: 'invalid path' }, { status: 400 });
	}

	let body: unknown;
	if (method === 'POST' || method === 'PUT') {
		const text = await event.request.text();
		if (text) {
			try {
				body = JSON.parse(text);
			} catch {
				return json({ error: 'request body must be JSON' }, { status: 400 });
			}
		}
	}

	const query = Object.fromEntries(event.url.searchParams.entries());

	// Interactive-search release lookups query indexers live and routinely take
	// longer than a normal request; give them room and skip the response cache.
	const isReleaseSearch = path === 'release' || path.startsWith('release/');
	const timeoutMs = isReleaseSearch ? 55_000 : undefined;
	const cacheMs = isReleaseSearch ? 0 : undefined;

	try {
		const data = await arrRequest(cfg, path, { method, body, query, timeoutMs, cacheMs });
		return json(data ?? null);
	} catch (err) {
		if (err instanceof ArrError) {
			// Real *arr errors are JSON; anything else (e.g. an HTML error page from a
			// misconfigured URL) is truncated so we don't echo a whole document.
			const detail =
				typeof err.body === 'string' && err.body.length > 500
					? `${err.body.slice(0, 500)}…`
					: err.body;
			return json(
				{ error: err.statusText || 'upstream error', status: err.status, detail },
				{ status: err.status && err.status >= 400 ? err.status : 502 }
			);
		}
		return json({ error: 'proxy failure', detail: String(err) }, { status: 502 });
	}
}
