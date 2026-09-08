// Low-level HTTP helper for talking to a Sonarr / Radarr instance.

import type { ArrConfig } from './config';

export class ArrError extends Error {
	readonly status: number;
	readonly statusText: string;
	readonly url: string;
	readonly body: unknown;

	constructor(status: number, statusText: string, url: string, body: unknown) {
		super(`${status} ${statusText} (${url})`);
		this.name = 'ArrError';
		this.status = status;
		this.statusText = statusText;
		this.url = url;
		this.body = body;
	}
}

export interface ArrRequestOptions {
	method?: string;
	/** Query params; `undefined` / `null` values are dropped. */
	query?: Record<string, string | number | boolean | undefined | null>;
	/** JSON request body (object is stringified). */
	body?: unknown;
	/** Abort the request after this many ms (default 8000). */
	timeoutMs?: number;
	signal?: AbortSignal;
	headers?: Record<string, string>;
	/**
	 * Serve a cached response for identical GETs within this many ms (default 8000;
	 * 0 disables). Smooths repeated loads and rides over brief upstream stalls.
	 */
	cacheMs?: number;
}

// Tiny in-memory GET cache. Keyed by full URL; the app makes only a few dozen
// distinct requests so no eviction is needed.
const getCache = new Map<string, { at: number; value: unknown }>();

function buildUrl(cfg: ArrConfig, path: string, query?: ArrRequestOptions['query']): string {
	const url = new URL(`${cfg.baseUrl}/${path.replace(/^\/+/, '')}`);
	if (query) {
		for (const [k, v] of Object.entries(query)) {
			if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
		}
	}
	return url.toString();
}

/**
 * Perform a request against an *arr instance and parse the JSON response.
 * Throws {@link ArrError} on any non-2xx response.
 */
export async function arrRequest<T = unknown>(
	cfg: ArrConfig,
	path: string,
	opts: ArrRequestOptions = {}
): Promise<T> {
	const url = buildUrl(cfg, path, opts.query);
	const { method = 'GET', body, timeoutMs = 8000, signal, headers = {}, cacheMs = 8000 } = opts;

	const cacheable = method === 'GET' && cacheMs > 0;
	if (cacheable) {
		const hit = getCache.get(url);
		if (hit && Date.now() - hit.at < cacheMs) return hit.value as T;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

	let res: Response;
	try {
		res = await fetch(url, {
			method,
			headers: {
				'X-Api-Key': cfg.apiKey,
				accept: 'application/json',
				...(body !== undefined ? { 'content-type': 'application/json' } : {}),
				...headers
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
			signal: controller.signal
		});
	} catch (err) {
		clearTimeout(timer);
		const reason =
			err instanceof Error && err.name === 'AbortError' ? 'request timed out' : String(err);
		throw new ArrError(0, 'Network Error', url, reason);
	}
	clearTimeout(timer);

	const text = await res.text();
	let parsed: unknown = null;
	if (text) {
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = text;
		}
	}

	if (!res.ok) throw new ArrError(res.status, res.statusText, url, parsed);
	if (cacheable) getCache.set(url, { at: Date.now(), value: parsed });
	return parsed as T;
}

/** GET `${origin}/ping`. No API key required; used for connection checks. */
export async function arrPing(cfg: ArrConfig, timeoutMs = 5000): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(`${cfg.origin}/ping`, {
			headers: { accept: 'application/json' },
			signal: controller.signal
		});
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}
