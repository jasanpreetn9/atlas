import { createHttpApi } from '$lib/api/client';
import type { PageLoad } from './$types';

// Queue comes from the shared library store + a live poll in the page; here we
// load the history feed and the blocklist for both apps.
export const load: PageLoad = async ({ fetch }) => {
	const api = createHttpApi(fetch);

	const settled = await Promise.allSettled([api.getHistory({ pageSize: 100 }), api.getBlocklist()]);

	const keys = ['history', 'blocklist'];
	const loadErrors = keys.filter((_, i) => settled[i].status === 'rejected');
	const val = <T>(i: number, fallback: T): T =>
		settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

	return {
		history: val(0, [] as Awaited<ReturnType<typeof api.getHistory>>),
		blocklist: val(1, [] as Awaited<ReturnType<typeof api.getBlocklist>>),
		loadErrors
	};
};
