// Cross-route UI state + global overlays for the Atlas frontend.
// A single rune-backed singleton; persistence + CSS-var application live in +layout.svelte.

import { browser } from '$app/environment';
import { api } from '$lib/api/client';
import type {
	QueueItem,
	ReleaseItem,
	ReleaseOverride,
	SearchSubject,
	WantedKind
} from '$lib/api/client';
import type { EpisodeFileResource } from '$lib/api/sonarr';
import type { MovieFileResource } from '$lib/api/radarr';
import type { EpisodeRow } from '$lib/view/episodes';
import type { MediaInfoTarget } from '$lib/view/mediainfo';

export type Theme = 'dark' | 'light';
export type Density = 'Compact' | 'Balanced' | 'Roomy';

export interface Toast {
	id: number;
	msg: string;
	color: string;
}

export interface EpModalTarget {
	seriesId: number;
	seriesTitle: string;
	network: string;
	qualityProfile: string;
	row: EpisodeRow;
	/** The raw file, when one exists, so the modal can open Media Info. */
	file?: EpisodeFileResource;
}

export type DialogKind = 'add' | 'edit' | 'delete';

export interface DialogTarget {
	kind: 'series' | 'movie';
	id?: number;
	title: string;
	year?: number;
}

/** A destructive or otherwise confirm-first action, run by the global ConfirmModal. */
export interface ConfirmSpec {
	title: string;
	body: string;
	confirmLabel?: string;
	danger?: boolean;
	onConfirm: () => void | Promise<void>;
}

export interface RenameTarget {
	kind: WantedKind;
	id: number;
	title: string;
}

export type EditFileTarget =
	| { kind: 'series'; title: string; subtitle: string; file: EpisodeFileResource }
	| { kind: 'movie'; title: string; subtitle: string; file: MovieFileResource };

export interface ManualImportTarget {
	seriesId: number;
	seriesTitle: string;
	folder: string;
}

export const EP_COLUMNS = [
	{ key: 'num', label: '#', locked: true },
	{ key: 'title', label: 'Title', locked: true },
	{ key: 'air', label: 'Air Date', locked: false },
	{ key: 'codec', label: 'Codec', locked: false },
	{ key: 'audio', label: 'Audio', locked: false },
	{ key: 'subs', label: 'Subtitles', locked: false },
	{ key: 'size', label: 'Size', locked: false },
	{ key: 'group', label: 'Release Group', locked: false },
	{ key: 'score', label: 'Score', locked: false },
	{ key: 'status', label: 'Status', locked: true }
] as const;

const EP_SHOW_DEFAULT: Record<string, boolean> = {
	num: true,
	title: true,
	air: true,
	codec: false,
	audio: false,
	subs: false,
	size: true,
	group: false,
	score: false,
	status: true
};

/** Merge a persisted map over the defaults; locked columns are always on. */
function parseEpShow(raw: string): Record<string, boolean> {
	const merged: Record<string, boolean> = { ...EP_SHOW_DEFAULT };
	try {
		const saved = JSON.parse(raw) as Record<string, unknown>;
		for (const c of EP_COLUMNS) {
			if (c.locked) merged[c.key] = true;
			else if (typeof saved[c.key] === 'boolean') merged[c.key] = saved[c.key] as boolean;
		}
	} catch {
		/* keep defaults */
	}
	return merged;
}

const POSTER_SIZES = [120, 158, 210];

/** Library page sizes; 0 means "show everything on one page". */
export const LIB_PAGE_SIZES = [24, 48, 96, 0] as const;

function read<T>(key: string, fallback: T, parse: (raw: string) => T): T {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? fallback : parse(raw);
	} catch {
		return fallback;
	}
}

class AtlasStore {
	// ---- chrome ----
	theme = $state<Theme>(read('atlas:theme', 'dark', (r) => (r === 'light' ? 'light' : 'dark')));
	sidebarExpanded = $state<boolean>(read('atlas:sidebar', true, (r) => r !== '0'));
	density = $state<Density>(
		read('atlas:density', 'Balanced', (r) =>
			r === 'Compact' || r === 'Roomy' ? (r as Density) : 'Balanced'
		)
	);
	posterSize = $state<number>(
		read('atlas:poster', 158, (r) => (POSTER_SIZES.includes(+r) ? +r : 158))
	);
	libPageSize = $state<number>(
		read('atlas:libpagesize', 48, (r) =>
			(LIB_PAGE_SIZES as readonly number[]).includes(+r) ? +r : 48
		)
	);
	query = $state('');

	// ---- overlays ----
	srch = $state<SearchSubject | null>(null);
	srchSort = $state<'score' | 'size' | 'age' | 'indexer' | 'title'>('score');
	epModal = $state<EpModalTarget | null>(null);
	epModalTab = $state<'details' | 'history'>('details');
	epColsOpen = $state(false);
	epShow = $state<Record<string, boolean>>(
		read('atlas:epcols', { ...EP_SHOW_DEFAULT }, parseEpShow)
	);
	dlg = $state<DialogKind | null>(null);
	dlgTarget = $state<DialogTarget | null>(null);
	confirmSpec = $state<ConfirmSpec | null>(null);
	confirmBusy = $state(false);
	mediaInfo = $state<MediaInfoTarget | null>(null);
	renameTarget = $state<RenameTarget | null>(null);
	editFileTarget = $state<EditFileTarget | null>(null);
	manualImport = $state<ManualImportTarget | null>(null);

	// ---- mutable session data ----
	toasts = $state<Toast[]>([]);
	grabs = $state<Record<string, 'grabbing' | 'grabbed'>>({});
	extraQueue = $state<QueueItem[]>([]);
	added = $state<Record<string, boolean>>({});
	overrides = $state<Record<string, { monitored?: boolean; status?: string }>>({});

	#nToast = 0;

	toast(msg: string, color = 'var(--ok)') {
		const id = ++this.#nToast;
		this.toasts = [...this.toasts, { id, msg, color }];
		setTimeout(() => {
			this.toasts = this.toasts.filter((t) => t.id !== id);
		}, 2600);
	}

	toggleTheme() {
		this.theme = this.theme === 'dark' ? 'light' : 'dark';
	}

	toggleSidebar() {
		this.sidebarExpanded = !this.sidebarExpanded;
	}

	cyclePoster() {
		const i = POSTER_SIZES.indexOf(this.posterSize);
		this.posterSize = POSTER_SIZES[(i + 1) % POSTER_SIZES.length];
	}

	get posterSizeLabel() {
		return `Poster ${this.posterSize === 120 ? 'S' : this.posterSize === 210 ? 'L' : 'M'}`;
	}

	openSearch(subject: SearchSubject) {
		this.srch = subject;
		this.srchSort = 'score';
	}
	closeSearch() {
		this.srch = null;
	}

	openEp(target: EpModalTarget) {
		this.epModal = target;
		this.epModalTab = 'details';
	}
	closeEp() {
		this.epModal = null;
	}

	openDialog(kind: DialogKind, target: DialogTarget) {
		this.dlg = kind;
		this.dlgTarget = target;
	}
	closeDialog() {
		this.dlg = null;
		this.dlgTarget = null;
	}

	/** Ask before a destructive action; the ConfirmModal calls `runConfirm()` on accept. */
	openConfirm(spec: ConfirmSpec) {
		this.confirmSpec = spec;
		this.confirmBusy = false;
	}
	closeConfirm() {
		this.confirmSpec = null;
		this.confirmBusy = false;
	}
	async runConfirm() {
		const spec = this.confirmSpec;
		if (!spec || this.confirmBusy) return;
		this.confirmBusy = true;
		try {
			await spec.onConfirm();
			this.confirmSpec = null;
		} catch {
			this.toast('Action failed', 'var(--err)');
		} finally {
			this.confirmBusy = false;
		}
	}

	openMediaInfo(target: MediaInfoTarget) {
		this.mediaInfo = target;
	}
	closeMediaInfo() {
		this.mediaInfo = null;
	}

	openRename(target: RenameTarget) {
		this.renameTarget = target;
	}
	closeRename() {
		this.renameTarget = null;
	}

	openEditFile(target: EditFileTarget) {
		this.editFileTarget = target;
	}
	closeEditFile() {
		this.editFileTarget = null;
	}

	openManualImport(target: ManualImportTarget) {
		this.manualImport = target;
	}
	closeManualImport() {
		this.manualImport = null;
	}

	toggleEpColumn(key: string) {
		const col = EP_COLUMNS.find((c) => c.key === key);
		if (!col || col.locked) return;
		this.epShow = { ...this.epShow, [key]: !this.epShow[key] };
	}

	setOverride(id: string, patch: { monitored?: boolean; status?: string }) {
		this.overrides = { ...this.overrides, [id]: { ...this.overrides[id], ...patch } };
	}

	/** Grab a release found by the current Interactive Search. Issues a real `POST /release`. */
	async grab(release: ReleaseItem, opts: { override?: boolean } = {}) {
		const subject = this.srch;
		const key = release.guid ?? '';
		if (!subject || !key) return;

		const kind: WantedKind = subject.kind === 'movie' ? 'movie' : 'series';
		let override: ReleaseOverride | undefined;
		if (opts.override) {
			override = resolveOverride(release, subject) ?? undefined;
			if (!override) {
				this.toast(`Can't override · missing series/movie match`, 'var(--err)');
				return;
			}
		}

		this.grabs = { ...this.grabs, [key]: 'grabbing' };
		try {
			await api.pushRelease(kind, key, release.indexerId, override);
			this.grabs = { ...this.grabs, [key]: 'grabbed' };
			this.toast(
				`${opts.override ? 'Override & grabbed' : 'Grabbed'} · ${release.indexer ?? 'indexer'} → queue`,
				'var(--ok)'
			);
		} catch {
			const next = { ...this.grabs };
			delete next[key];
			this.grabs = next;
			this.toast(`Grab failed · ${subject.label}`, 'var(--err)');
		}
	}
}

/**
 * What Sonarr/Radarr need to bypass a rejection: the release's own parse when it has
 * one (it was rejected for e.g. quality, not identification), else the search
 * subject's own id - see `ReleaseController.DownloadRelease` in both apps.
 */
export function resolveOverride(
	release: ReleaseItem,
	subject: SearchSubject
): ReleaseOverride | null {
	if (subject.kind === 'movie') {
		const movieId = ('movieId' in release ? release.movieId : null) ?? subject.movieId;
		if (movieId == null) return null;
		return { movieId, quality: release.quality, languages: release.languages };
	}
	const seriesId = ('seriesId' in release ? release.seriesId : null) ?? subject.seriesId;
	const episodeIds =
		'episodeIds' in release && release.episodeIds.length > 0
			? release.episodeIds
			: subject.kind === 'episode'
				? [subject.episodeId]
				: [];
	if (seriesId == null || episodeIds.length === 0) return null;
	return { seriesId, episodeIds, quality: release.quality, languages: release.languages };
}

export const store = new AtlasStore();
