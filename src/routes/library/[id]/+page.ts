import { error } from '@sveltejs/kit';
import { createHttpApi } from '$lib/api/client';
import { parseMediaId } from '$lib/view/media';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const parsed = parseMediaId(params.id);
	if (!parsed) error(404, 'Not found');

	const api = createHttpApi(fetch);

	if (parsed.kind === 'series') {
		const [episodes, episodeFiles, history] = await Promise.allSettled([
			api.getEpisodes(parsed.rawId),
			api.getEpisodeFiles(parsed.rawId),
			api.getSeriesHistory(parsed.rawId)
		]);
		return {
			kind: 'series' as const,
			rawId: parsed.rawId,
			episodes: episodes.status === 'fulfilled' ? episodes.value : [],
			episodeFiles: episodeFiles.status === 'fulfilled' ? episodeFiles.value : [],
			history: history.status === 'fulfilled' ? history.value : []
		};
	}

	const history = await api.getMovieHistory(parsed.rawId).catch(() => []);
	return { kind: 'movie' as const, rawId: parsed.rawId, history };
};
