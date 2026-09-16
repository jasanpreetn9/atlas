import { createHttpApi } from '$lib/api/client';
import type { PageLoad } from './$types';

// Quality profiles and root folders, scoped per app so the add dialog offers the
// right options for a series vs a movie. Lookups themselves run in the page.
export const load: PageLoad = async ({ fetch }) => {
	const api = createHttpApi(fetch);

	const settled = await Promise.allSettled([
		api.getQualityProfiles('series'),
		api.getQualityProfiles('movie'),
		api.getRootFolders('series'),
		api.getRootFolders('movie'),
		api.getTags('series'),
		api.getTags('movie')
	]);

	const val = <T>(i: number, fallback: T): T =>
		settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

	type Profiles = Awaited<ReturnType<typeof api.getQualityProfiles>>;
	type Roots = Awaited<ReturnType<typeof api.getRootFolders>>;
	type Tags = Awaited<ReturnType<typeof api.getTags>>;

	return {
		seriesProfiles: val(0, [] as Profiles),
		movieProfiles: val(1, [] as Profiles),
		seriesRoots: val(2, [] as Roots),
		movieRoots: val(3, [] as Roots),
		seriesTags: val(4, [] as Tags),
		movieTags: val(5, [] as Tags)
	};
};
