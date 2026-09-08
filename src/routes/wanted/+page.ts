import { createHttpApi } from '$lib/api/client';
import type { PageLoad } from './$types';

// Missing + cutoff-unmet, for both apps. Series/movie resources for titles come
// from the shared library store (loaded in +layout.svelte).
export const load: PageLoad = async ({ fetch }) => {
	const api = createHttpApi(fetch);
	const opts = { pageSize: 200 };

	const settled = await Promise.allSettled([
		api.getWantedMissing('series', opts),
		api.getWantedMissing('movie', opts),
		api.getWantedCutoff('series', opts),
		api.getWantedCutoff('movie', opts)
	]);

	const keys = ['missingSeries', 'missingMovies', 'cutoffSeries', 'cutoffMovies'];
	const loadErrors = keys.filter((_, i) => settled[i].status === 'rejected');

	const emptyPage = {
		page: 1,
		pageSize: 0,
		sortKey: '',
		sortDirection: 'default' as const,
		totalRecords: 0,
		records: []
	};
	const val = <T>(i: number, fallback: T): T =>
		settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

	type Page = Awaited<ReturnType<typeof api.getWantedMissing>>;
	return {
		missingSeries: val(0, emptyPage as Page),
		missingMovies: val(1, emptyPage as Page),
		cutoffSeries: val(2, emptyPage as Page),
		cutoffMovies: val(3, emptyPage as Page),
		loadErrors
	};
};
