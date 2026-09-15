// Normalizes an episode file or a movie file into the flat shape the Media Info
// modal renders. Both resources carry the same fields under different resource
// types, so this is the one place that reads either.

import type { MediaInfoResource } from '$lib/api/common';
import type { EpisodeFileResource } from '$lib/api/sonarr';
import type { MovieFileResource } from '$lib/api/radarr';
import { agoLabel, formatBytes } from './format';

export interface MediaInfoTarget {
	title: string;
	subtitle: string;
	path: string;
	size: string;
	quality: string;
	languages: string;
	releaseGroup: string;
	added: string;
	info: MediaInfoResource | null;
}

export function buildMediaInfoTarget(
	title: string,
	subtitle: string,
	file: EpisodeFileResource | MovieFileResource
): MediaInfoTarget {
	return {
		title,
		subtitle,
		path: file.path ?? file.relativePath ?? '—',
		size: formatBytes(file.size),
		quality: file.quality?.quality?.name ?? '—',
		languages: file.languages?.length ? file.languages.map((l) => l.name).join(', ') : '—',
		releaseGroup: file.releaseGroup ?? '—',
		added: agoLabel(file.dateAdded),
		info: file.mediaInfo ?? null
	};
}
