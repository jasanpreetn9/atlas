// Shared library snapshot (series + movies + queue + folders + profiles).
//
// Loaded once on app start from `+layout.svelte` so the chrome paints immediately
// instead of every page blocking on ~600 KB of series/movies. Routes read from here;
// `refresh()` re-pulls (e.g. a "Refresh" button, or after a mutating action).

import { createHttpApi } from '$lib/api/client';
import type { QueueItem } from '$lib/api/client';
import type { DiskSpaceResource, RootFolderResource } from '$lib/api/common';
import type { SeriesResource } from '$lib/api/sonarr';
import type { MovieResource } from '$lib/api/radarr';

class LibraryStore {
	series = $state<SeriesResource[]>([]);
	movies = $state<MovieResource[]>([]);
	queue = $state<QueueItem[]>([]);
	diskSpace = $state<DiskSpaceResource[]>([]);
	rootFolders = $state<RootFolderResource[]>([]);
	profileNames = $state<Map<number, string>>(new Map());

	loading = $state(true);
	/** True when Sonarr or Radarr failed to answer, so the data may be partial or empty. */
	error = $state(false);
	loadedAt = $state(0);

	#inflight: Promise<void> | null = null;

	/** Load once; subsequent calls within `staleMs` are no-ops unless `force`. */
	load(opts: { force?: boolean; staleMs?: number } = {}): Promise<void> {
		const { force = false, staleMs = 15_000 } = opts;
		if (this.#inflight) return this.#inflight;
		if (!force && this.loadedAt && Date.now() - this.loadedAt < staleMs) return Promise.resolve();

		this.loading = true;
		const api = createHttpApi(fetch);
		this.#inflight = Promise.allSettled([
			api.getSeries(),
			api.getMovies(),
			api.getQueue(),
			api.getDiskSpace(),
			api.getRootFolders(),
			api.getQualityProfiles()
		]).then(([s, m, q, d, rf, p]) => {
			if (s.status === 'fulfilled') this.series = s.value;
			if (m.status === 'fulfilled') this.movies = m.value;
			if (q.status === 'fulfilled') this.queue = q.value;
			if (d.status === 'fulfilled') this.diskSpace = d.value;
			if (rf.status === 'fulfilled') this.rootFolders = rf.value;
			if (p.status === 'fulfilled') {
				const map = new Map<number, string>();
				for (const prof of p.value) map.set(prof.id, prof.name ?? `Profile ${prof.id}`);
				this.profileNames = map;
			}
			this.error = s.status === 'rejected' || m.status === 'rejected';
			this.loading = false;
			this.loadedAt = Date.now();
			this.#inflight = null;
		});
		return this.#inflight;
	}

	refresh(): Promise<void> {
		return this.load({ force: true });
	}
}

export const library = new LibraryStore();
