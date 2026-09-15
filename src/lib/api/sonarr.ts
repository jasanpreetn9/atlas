// Sonarr v3 REST API resource types (github.com/Sonarr/Sonarr, src/Sonarr.Api.V3/openapi.json).

import type {
	CustomFormatResource,
	DownloadProtocol,
	Language,
	MediaCover,
	MediaInfoResource,
	QualityModel,
	QueueResourceBase
} from './common';

export interface Ratings {
	votes: number;
	value: number;
}

export interface AlternateTitleResource {
	title: string | null;
	seasonNumber?: number | null;
	sceneSeasonNumber?: number | null;
	sceneOrigin?: string | null;
	comment?: string | null;
}

export type SeriesStatusType = 'continuing' | 'ended' | 'upcoming' | 'deleted';
export type SeriesTypes = 'standard' | 'daily' | 'anime';
export type NewItemMonitorTypes = 'all' | 'none';

export type MonitorTypes =
	| 'unknown'
	| 'all'
	| 'future'
	| 'missing'
	| 'existing'
	| 'firstSeason'
	| 'lastSeason'
	| 'latestSeason'
	| 'pilot'
	| 'recent'
	| 'monitorSpecials'
	| 'unmonitorSpecials'
	| 'none'
	| 'skip';

export interface AddSeriesOptions {
	ignoreEpisodesWithFiles: boolean;
	ignoreEpisodesWithoutFiles: boolean;
	monitor: MonitorTypes;
	searchForMissingEpisodes: boolean;
	searchForCutoffUnmetEpisodes: boolean;
}

export interface SeasonStatisticsResource {
	nextAiring: string | null;
	previousAiring: string | null;
	episodeFileCount: number;
	episodeCount: number;
	totalEpisodeCount: number;
	sizeOnDisk: number;
	releaseGroups: string[];
	percentOfEpisodes: number;
}

export interface SeasonResource {
	seasonNumber: number;
	monitored: boolean;
	statistics?: SeasonStatisticsResource;
	images?: MediaCover[];
}

export interface SeriesStatisticsResource {
	seasonCount: number;
	episodeFileCount: number;
	episodeCount: number;
	totalEpisodeCount: number;
	sizeOnDisk: number;
	releaseGroups: string[];
	percentOfEpisodes: number;
}

export interface SeriesResource {
	id: number;
	title: string | null;
	alternateTitles: AlternateTitleResource[];
	sortTitle: string | null;
	status: SeriesStatusType;
	ended: boolean;
	profileName?: string | null;
	overview: string | null;
	// Omitted by newer Sonarr builds when there is no next/previous airing.
	nextAiring?: string | null;
	previousAiring?: string | null;
	network: string | null;
	airTime: string | null;
	images: MediaCover[];
	originalLanguage: Language;
	remotePoster?: string | null;
	seasons: SeasonResource[];
	year: number;
	path: string | null;
	qualityProfileId: number;
	seasonFolder: boolean;
	monitored: boolean;
	monitorNewItems: NewItemMonitorTypes;
	useSceneNumbering: boolean;
	runtime: number;
	tvdbId: number;
	tvRageId: number;
	tvMazeId: number;
	tmdbId: number;
	firstAired: string | null;
	lastAired: string | null;
	seriesType: SeriesTypes;
	cleanTitle: string | null;
	imdbId: string | null;
	titleSlug: string | null;
	rootFolderPath: string | null;
	folder?: string | null;
	certification: string | null;
	genres: string[];
	tags: number[];
	added: string;
	addOptions?: AddSeriesOptions;
	ratings: Ratings;
	statistics?: SeriesStatisticsResource;
	languageProfileId?: number;
}

export interface EpisodeFileResource {
	id: number;
	seriesId: number;
	seasonNumber: number;
	relativePath: string | null;
	path: string | null;
	size: number;
	dateAdded: string;
	sceneName?: string | null;
	releaseGroup?: string | null;
	languages: Language[];
	quality: QualityModel;
	customFormats?: CustomFormatResource[];
	customFormatScore?: number;
	indexerFlags?: number | null;
	releaseType?: string;
	mediaInfo: MediaInfoResource;
	qualityCutoffNotMet: boolean;
}

export interface EpisodeResource {
	id: number;
	seriesId: number;
	tvdbId: number;
	episodeFileId: number;
	seasonNumber: number;
	episodeNumber: number;
	title: string | null;
	airDate: string | null;
	airDateUtc: string | null;
	lastSearchTime?: string | null;
	runtime: number;
	finaleType?: string | null;
	overview: string | null;
	episodeFile?: EpisodeFileResource;
	hasFile: boolean;
	monitored: boolean;
	absoluteEpisodeNumber?: number | null;
	unverifiedSceneNumbering: boolean;
	endTime?: string | null;
	grabDate?: string | null;
	series?: SeriesResource;
	images?: MediaCover[];
}

export interface SonarrQueueResource extends QueueResourceBase {
	seriesId: number | null;
	episodeId: number | null;
	seasonNumber: number | null;
	series?: SeriesResource;
	episode?: EpisodeResource;
	episodeHasFile: boolean;
}

export type EpisodeHistoryEventType =
	| 'unknown'
	| 'grabbed'
	| 'seriesFolderImported'
	| 'downloadFolderImported'
	| 'downloadFailed'
	| 'episodeFileDeleted'
	| 'episodeFileRenamed'
	| 'downloadIgnored';

export interface SonarrHistoryResource {
	id: number;
	episodeId: number;
	seriesId: number;
	sourceTitle: string | null;
	languages: Language[];
	quality: QualityModel;
	customFormats: CustomFormatResource[];
	customFormatScore: number;
	qualityCutoffNotMet: boolean;
	date: string;
	downloadId: string | null;
	eventType: EpisodeHistoryEventType;
	data: Record<string, string | null>;
	episode?: EpisodeResource;
	series?: SeriesResource;
}

export interface SonarrReleaseResource {
	guid: string | null;
	quality: QualityModel;
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
	fullSeason: boolean;
	sceneSource: boolean;
	seasonNumber: number;
	languages: Language[];
	languageWeight: number;
	airDate: string | null;
	seriesTitle: string | null;
	episodeNumbers: number[];
	absoluteEpisodeNumbers: number[];
	mappedSeriesId: number | null;
	approved: boolean;
	temporarilyRejected: boolean;
	rejected: boolean;
	tvdbId: number;
	tvRageId: number;
	imdbId: string | null;
	rejections: string[];
	publishDate: string;
	commentUrl: string | null;
	downloadUrl: string | null;
	infoUrl: string | null;
	episodeRequested: boolean;
	downloadAllowed: boolean;
	releaseWeight: number;
	customFormats: CustomFormatResource[];
	customFormatScore: number;
	magnetUrl: string | null;
	infoHash: string | null;
	seeders: number | null;
	leechers: number | null;
	protocol: DownloadProtocol;
	indexerFlags: number;
	isDaily: boolean;
	isAbsoluteNumbering: boolean;
	isPossibleSpecialEpisode: boolean;
	special: boolean;
	seriesId: number | null;
	episodeId: number | null;
	episodeIds: number[];
	downloadClientId: number | null;
	downloadClient: string | null;
	shouldOverride: boolean | null;
}

/** One episode file that `GET /rename?seriesId=` would rename under the current naming format. */
export interface RenamingResource {
	id: number;
	seriesId: number;
	seasonNumber: number;
	episodeNumbers: number[];
	episodeFileId: number;
	existingPath: string | null;
	newPath: string | null;
}
