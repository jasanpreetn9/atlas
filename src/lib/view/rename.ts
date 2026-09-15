// Flattens a `GET /rename` preview (one shape per app) into rows the Rename
// Preview modal can list, regardless of whether it's a series or a movie.

import type { RenameItem } from '$lib/api/client';
import { pad } from './format';

export interface RenameRow {
	key: string;
	/** "S01E02,03" for a series file; empty for a movie (there's only ever one). */
	code: string;
	from: string;
	to: string;
	fileId: number;
}

export function renameRows(items: RenameItem[]): RenameRow[] {
	return items.map((it) => {
		if (it.kind === 'series') {
			return {
				key: `s${it.id}`,
				code: `S${pad(it.seasonNumber)}E${it.episodeNumbers.map(pad).join(',')}`,
				from: it.existingPath ?? '',
				to: it.newPath ?? '',
				fileId: it.episodeFileId
			};
		}
		return {
			key: `m${it.id}`,
			code: '',
			from: it.existingPath ?? '',
			to: it.newPath ?? '',
			fileId: it.movieFileId
		};
	});
}
