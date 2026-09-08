// Radarr v3 REST API resource types (github.com/Radarr/Radarr, src/Radarr.Api.V3/openapi.json).

import type {
	CustomFormatResource,
	DownloadProtocol,
	Language,
	MediaCover,
	MediaInfoResource,
	QualityModel,
	QueueResourceBase
} from './common';

export type RatingType = 'user' | 'critic';

export interface RatingChild {
	votes: number;
	value: number;
	type: RatingType;
}

export interface RadarrRatings {
	imdb?: RatingChild;
	tmdb?: RatingChild;
	metacritic?: RatingChild;
	rottenTomatoes?: RatingChild;
	trakt?: RatingChild;
}

export type MovieStatusType = 'tba' | 'announced' | 'inCinemas' | 'released' | 'deleted';
/** Radarr reuses `MovieStatusType` for `minimumAvailability`. */
export type MinimumAvailabilityType = MovieStatusType;

export type AddMovieMethod = 'manual' | 'list' | 'collection';

export interface AddMovieOptions {
	ignoreEpisodesWithFiles: boolean;
	ignoreEpisodesWithoutFiles: boolean;
	monitor: string;
	searchForMovie: boolean;
	addMethod: AddMovieMethod;
}

export type SourceType = 'tmdb' | 'mappings' | 'user' | 'indexer';

export interface AlternativeTitleResource {
	id: number;
	sourceType: SourceType;
	movieMetadataId: number;
	title: string | null;
	cleanTitle: string | null;
}

export interface MovieCollectionResource {
	title: string | null;
	tmdbId: number;
}

export interface MovieStatisticsResource {
	movieFileCount: number;
	sizeOnDisk: number;
	releaseGroups: string[];
}

export interface MovieFileResource {
	id: number;
	movieId: number;
	relativePath: string | null;
	path: string | null;
	size: number;
	dateAdded: string;
	sceneName?: string | null;
	releaseGroup?: string | null;
	edition: string | null;
	languages: Language[];
	quality: QualityModel;
	customFormats?: CustomFormatResource[];
	customFormatScore?: number | null;
	indexerFlags?: number | null;
	mediaInfo: MediaInfoResource;
	originalFilePath?: string | null;
	qualityCutoffNotMet: boolean;
}

export interface MovieResource {
	id: number;
	title: string | null;
	originalTitle: string | null;
	originalLanguage: Language;
	alternateTitles: AlternativeTitleResource[];
	secondaryYear?: number | null;
	sortTitle: string | null;
	sizeOnDisk: number | null;
	status: MovieStatusType;
	overview: string | null;
	inCinemas: string | null;
	physicalRelease: string | null;
	digitalRelease: string | null;
	releaseDate: string | null;
	images: MediaCover[];
	website: string | null;
	remotePoster?: string | null;
	year: number;
	youTubeTrailerId: string | null;
	studio: string | null;
	path: string | null;
	qualityProfileId: number;
	hasFile: boolean | null;
	movieFileId: number;
	monitored: boolean;
	minimumAvailability: MinimumAvailabilityType;
	isAvailable: boolean;
	folderName: string | null;
	runtime: number;
	cleanTitle: string | null;
	imdbId: string | null;
	tmdbId: number;
	titleSlug: string | null;
	rootFolderPath: string | null;
	folder?: string | null;
	certification: string | null;
	genres: string[];
	keywords: string[];
	tags: number[];
	added: string;
	addOptions?: AddMovieOptions;
	ratings: RadarrRatings;
	movieFile?: MovieFileResource;
	collection?: MovieCollectionResource;
	popularity: number;
	lastSearchTime?: string | null;
	statistics?: MovieStatisticsResource;
}

export interface RadarrQueueResource extends QueueResourceBase {
	movieId: number | null;
	movie?: MovieResource;
}

export type MovieHistoryEventType =
	| 'unknown'
	| 'grabbed'
	| 'downloadFolderImported'
	| 'downloadFailed'
	| 'movieFileDeleted'
	| 'movieFolderImported'
	| 'movieFileRenamed'
	| 'downloadIgnored';

export interface RadarrHistoryResource {
	id: number;
	movieId: number;
	sourceTitle: string | null;
	languages: Language[];
	quality: QualityModel;
	customFormats: CustomFormatResource[];
	customFormatScore: number;
	qualityCutoffNotMet: boolean;
	date: string;
	downloadId: string | null;
	eventType: MovieHistoryEventType;
	data: Record<string, string | null>;
	movie?: MovieResource;
}

export interface RadarrReleaseResource {
	guid: string | null;
	quality: QualityModel;
	customFormats: CustomFormatResource[];
	customFormatScore: number;
	qualityWeight: number;
	age: number;
	ageHours: number;
	ageMinutes: number;
	size: number;
	indexerId: number;
	indexer: string | null;
	releaseGroup: string | null;
	subGroup: string | null;
	releaseHash: string | null;
	title: string | null;
	sceneSource: boolean;
	movieTitles: string[];
	languages: Language[];
	mappedMovieId: number | null;
	approved: boolean;
	temporarilyRejected: boolean;
	rejected: boolean;
	tmdbId: number;
	imdbId: number;
	rejections: string[];
	publishDate: string;
	commentUrl: string | null;
	downloadUrl: string | null;
	infoUrl: string | null;
	movieRequested: boolean;
	downloadAllowed: boolean;
	releaseWeight: number;
	edition: string | null;
	magnetUrl: string | null;
	infoHash: string | null;
	seeders: number | null;
	leechers: number | null;
	protocol: DownloadProtocol;
	indexerFlags: number | null;
	movieId: number | null;
	downloadClientId: number | null;
	downloadClient: string | null;
	shouldOverride: boolean | null;
}
