// Types shared by the Sonarr v3 and Radarr v3 REST APIs.
//
// Field names and shapes are copied verbatim from the official OpenAPI specs
// (github.com/Sonarr/Sonarr and github.com/Radarr/Radarr, `src/*.Api.V3/openapi.json`).
// `date-time` values are ISO-8601 strings; `date-span` values are `d.hh:mm:ss` strings.
// Only the surface Atlas actually consumes is modelled. The resources are otherwise
// structurally compatible with the real payloads.

export interface Language {
	id: number;
	name: string | null;
}

export type MediaCoverType =
	'unknown' | 'poster' | 'banner' | 'fanart' | 'screenshot' | 'headshot' | 'clearlogo';

export interface MediaCover {
	coverType: MediaCoverType;
	url: string | null;
	remoteUrl?: string | null;
}

export type QualitySource =
	| 'unknown'
	| 'cam'
	| 'telesync'
	| 'telecine'
	| 'workprint'
	| 'dvd'
	| 'tv'
	| 'webdl'
	| 'webrip'
	| 'bluray';

export type QualityModifier = 'none' | 'regional' | 'screener' | 'rawhd' | 'brdisk' | 'remux';

export interface Quality {
	id: number;
	name: string | null;
	source: QualitySource;
	resolution: number;
	/** Radarr only. */
	modifier?: QualityModifier;
}

export interface Revision {
	version: number;
	real: number;
	isRepack: boolean;
}

export interface QualityModel {
	quality: Quality;
	revision: Revision;
}

export interface QualityProfileQualityItemResource {
	id?: number;
	name?: string | null;
	quality?: Quality;
	items: QualityProfileQualityItemResource[];
	allowed: boolean;
}

/** One entry from `GET /qualitydefinition`: every quality the app knows about. */
export interface QualityDefinitionResource {
	id: number;
	quality: Quality;
	title: string | null;
	weight: number;
	minSize?: number | null;
	maxSize?: number | null;
	preferredSize?: number | null;
}

export interface QualityProfileResource {
	id: number;
	name: string | null;
	upgradeAllowed: boolean;
	cutoff: number;
	items: QualityProfileQualityItemResource[];
	minFormatScore: number;
	cutoffFormatScore: number;
	minUpgradeFormatScore: number;
	formatItems: unknown[];
	/** Radarr only. */
	language?: Language;
}

export interface CustomFormatResource {
	id: number;
	name: string | null;
	includeCustomFormatWhenRenaming?: boolean | null;
	specifications?: unknown[];
}

export interface MediaInfoResource {
	id: number;
	audioBitrate: number;
	audioChannels: number;
	audioCodec: string | null;
	audioLanguages: string | null;
	audioStreamCount: number;
	videoBitDepth: number;
	videoBitrate: number;
	videoCodec: string | null;
	videoFps: number;
	videoDynamicRange: string | null;
	videoDynamicRangeType: string | null;
	resolution: string | null;
	runTime: string | null;
	scanType: string | null;
	subtitles: string | null;
}

export interface DiskSpaceResource {
	/** Absent on some Sonarr/Radarr builds. */
	id?: number;
	path: string | null;
	label: string | null;
	freeSpace: number;
	totalSpace: number;
}

export interface UnmappedFolder {
	name: string | null;
	path: string | null;
	relativePath: string | null;
}

export interface RootFolderResource {
	id: number;
	path: string | null;
	accessible: boolean;
	freeSpace: number | null;
	unmappedFolders: UnmappedFolder[];
}

export type HealthCheckResult = 'ok' | 'notice' | 'warning' | 'error';

export interface HealthResource {
	/** Absent on some Sonarr/Radarr builds. */
	id?: number;
	source: string | null;
	type: HealthCheckResult;
	message: string | null;
	wikiUrl: string | null;
}

export type CommandStatus =
	'queued' | 'started' | 'completed' | 'failed' | 'aborted' | 'cancelled' | 'orphaned';

export type CommandResult = 'unknown' | 'successful' | 'unsuccessful';
export type CommandPriority = 'normal' | 'high' | 'low';
export type CommandTrigger = 'unspecified' | 'manual' | 'scheduled';

export interface CommandResource {
	id: number;
	name: string | null;
	commandName: string | null;
	message: string | null;
	body?: Record<string, unknown>;
	priority: CommandPriority;
	status: CommandStatus;
	result: CommandResult;
	queued: string;
	started: string | null;
	ended: string | null;
	duration: string | null;
	exception: string | null;
	trigger: CommandTrigger;
	stateChangeTime: string | null;
	sendUpdatesToClient: boolean;
	updateScheduledTask: boolean;
	lastExecutionTime: string | null;
}

export type UpdateMechanism = 'builtIn' | 'script' | 'external' | 'apt' | 'docker';

export interface SystemResource {
	appName: string | null;
	instanceName: string | null;
	version: string | null;
	buildTime: string;
	isDebug: boolean;
	isProduction: boolean;
	isAdmin: boolean;
	isUserInteractive: boolean;
	startupPath: string | null;
	appData: string | null;
	osName: string | null;
	osVersion: string | null;
	isNetCore: boolean;
	isLinux: boolean;
	isOsx: boolean;
	isWindows: boolean;
	isDocker: boolean;
	mode: string;
	branch: string | null;
	authentication: string;
	sqliteVersion?: string | null;
	databaseType?: string;
	databaseVersion?: string | null;
	migrationVersion: number;
	urlBase: string | null;
	runtimeVersion: string | null;
	runtimeName: string | null;
	startTime: string;
	packageVersion: string | null;
	packageAuthor: string | null;
	packageUpdateMechanism: UpdateMechanism;
	packageUpdateMechanismMessage?: string | null;
}

export interface TaskResource {
	id: number;
	name: string | null;
	taskName: string | null;
	interval: number;
	lastExecution: string;
	lastStartTime: string;
	nextExecution: string;
	lastDuration: string;
}

export interface UpdateChanges {
	new: string[];
	fixed: string[];
}

export interface UpdateResource {
	id: number;
	version: string | null;
	branch: string | null;
	releaseDate: string;
	fileName: string | null;
	url: string | null;
	installed: boolean;
	installedOn: string | null;
	installable: boolean;
	latest: boolean;
	changes: UpdateChanges;
	hash: string | null;
}

export interface LogFileResource {
	id: number;
	filename: string | null;
	lastWriteTime: string;
	contentsUrl: string | null;
	downloadUrl: string | null;
}

export type BackupType = 'scheduled' | 'manual' | 'update';

export interface BackupResource {
	id: number;
	name: string | null;
	path: string | null;
	type: BackupType;
	size: number;
	time: string;
}

export type DownloadProtocol = 'unknown' | 'usenet' | 'torrent';

export type QueueStatus =
	| 'unknown'
	| 'queued'
	| 'paused'
	| 'downloading'
	| 'completed'
	| 'failed'
	| 'warning'
	| 'delay'
	| 'downloadClientUnavailable'
	| 'fallback';

export type TrackedDownloadStatus = 'ok' | 'warning' | 'error';

export type TrackedDownloadState =
	| 'downloading'
	| 'importBlocked'
	| 'importPending'
	| 'importing'
	| 'imported'
	| 'failedPending'
	| 'failed'
	| 'ignored';

export interface TrackedDownloadStatusMessage {
	title: string | null;
	messages: string[];
}

/** Base fields common to Sonarr/Radarr `QueueResource`; each app adds its own media refs. */
export interface QueueResourceBase {
	id: number;
	languages: Language[];
	quality: QualityModel;
	customFormats: CustomFormatResource[];
	customFormatScore: number;
	size: number;
	title: string | null;
	estimatedCompletionTime: string | null;
	added: string | null;
	status: QueueStatus;
	trackedDownloadStatus: TrackedDownloadStatus;
	trackedDownloadState: TrackedDownloadState;
	statusMessages: TrackedDownloadStatusMessage[];
	errorMessage: string | null;
	downloadId: string | null;
	protocol: DownloadProtocol;
	downloadClient: string | null;
	downloadClientHasPostImportCategory: boolean;
	indexer: string | null;
	outputPath: string | null;
	sizeleft: number;
	timeleft: string | null;
}

export type SortDirection = 'default' | 'ascending' | 'descending';

/** Wrapper returned by paged endpoints (`/wanted/missing`, `/history`, `/blocklist`, …). */
export interface PagingResource<T> {
	page: number;
	pageSize: number;
	sortKey: string;
	sortDirection: SortDirection;
	totalRecords: number;
	records: T[];
}

export interface BlocklistResource {
	id: number;
	sourceTitle: string | null;
	languages: Language[];
	quality: QualityModel;
	customFormats: CustomFormatResource[];
	date: string;
	protocol: DownloadProtocol;
	indexer: string | null;
	message: string | null;
	/** Sonarr. */
	seriesId?: number;
	episodeIds?: number[];
	/** Radarr. */
	movieId?: number;
}
