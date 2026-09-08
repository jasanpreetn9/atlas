import { createHttpApi } from '$lib/api/client';
import type { PageLoad } from './$types';

// `?m=` is a month offset from the current month. The load window covers the
// six-week grid for that month, so Month view needs no client-side refetch.
export const load: PageLoad = async ({ fetch, url }) => {
	const offset = Math.trunc(Number(url.searchParams.get('m') ?? 0)) || 0;
	const now = new Date();
	const anchor = new Date(now.getFullYear(), now.getMonth() + offset, 1);

	const gridStart = new Date(anchor);
	gridStart.setDate(1 - anchor.getDay());
	const gridEnd = new Date(gridStart);
	gridEnd.setDate(gridStart.getDate() + 42);

	const api = createHttpApi(fetch);
	let items: Awaited<ReturnType<typeof api.getCalendar>> = [];
	let loadError = false;
	try {
		items = await api.getCalendar(gridStart.toISOString(), gridEnd.toISOString());
	} catch {
		loadError = true;
	}

	return {
		offset,
		anchorISO: anchor.toISOString(),
		gridStartISO: gridStart.toISOString(),
		items,
		loadError
	};
};
