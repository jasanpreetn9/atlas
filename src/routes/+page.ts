import { createHttpApi } from '$lib/api/client';
import type { PageLoad } from './$types';

// Dashboard-specific reads. Series / movies / queue / folders / profiles come from
// the shared library store (loaded in +layout.svelte), not from here.
export const load: PageLoad = async ({ fetch }) => {
	const api = createHttpApi(fetch);
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
	const end = new Date(now.getTime() + 21 * 86_400_000).toISOString();

	const settled = await Promise.allSettled([
		api.getCalendar(start, end),
		api.getHistory({ pageSize: 100 }),
		api.getHealth(),
		api.getWantedMissing('series', { pageSize: 20 }),
		api.getWantedMissing('movie', { pageSize: 20 })
	]);

	const keys = ['calendar', 'history', 'health', 'wantedSeries', 'wantedMovies'];
	const loadErrors = keys.filter((_, i) => settled[i].status === 'rejected');
	const val = <T>(i: number, fallback: T): T =>
		settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

	const emptyPage = {
		page: 1,
		pageSize: 0,
		sortKey: '',
		sortDirection: 'default' as const,
		totalRecords: 0,
		records: []
	};

	return {
		calendar: val(0, [] as Awaited<ReturnType<typeof api.getCalendar>>),
		history: val(1, [] as Awaited<ReturnType<typeof api.getHistory>>),
		health: val(2, [] as Awaited<ReturnType<typeof api.getHealth>>),
		wantedSeries: val(3, emptyPage as Awaited<ReturnType<typeof api.getWantedMissing>>),
		wantedMovies: val(4, emptyPage as Awaited<ReturnType<typeof api.getWantedMissing>>),
		loadErrors
	};
};
