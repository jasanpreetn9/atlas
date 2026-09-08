// Cross-route UI state + global overlays for the Atlas frontend.
// A single rune-backed singleton; persistence + CSS-var application live in +layout.svelte.

import { browser } from '$app/environment';
import { api } from '$lib/api/client';
import type { QueueItem, ReleaseItem, SearchSubject } from '$lib/api/client';
import type { EpisodeRow } from '$lib/view/episodes';

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
}

export type DialogKind = 'add' | 'edit' | 'delete';

export interface DialogTarget {
	kind: 'series' | 'movie';
	id?: number;
	title: string;
	year?: number;
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

const POSTER_SIZES = [120, 158, 210];

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
	query = $state('');

	// ---- overlays ----
	srch = $state<SearchSubject | null>(null);
	srchSort = $state<'score' | 'size' | 'age' | 'indexer' | 'title'>('score');
	epModal = $state<EpModalTarget | null>(null);
	epModalTab = $state<'details' | 'history'>('details');
	epColsOpen = $state(false);
	epShow = $state<Record<string, boolean>>({ ...EP_SHOW_DEFAULT });
	dlg = $state<DialogKind | null>(null);
	dlgTarget = $state<DialogTarget | null>(null);

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
		this.grabs = { ...this.grabs, [key]: 'grabbing' };
		try {
			await api.pushRelease(subject.kind === 'movie' ? 'movie' : 'series', key, release.indexerId);
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

export const store = new AtlasStore();
