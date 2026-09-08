<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { store } from '$lib/stores/store.svelte';
	import { formatBytes } from '$lib/view/format';
	import {
		STATUS_BADGE_BG,
		STATUS_COLOR,
		STATUS_LABEL,
		type DerivedStatus
	} from '$lib/view/status';
	import {
		countLabel,
		movieToMediaItem,
		queueIndex,
		seriesToMediaItem,
		type MediaItem
	} from '$lib/view/media';
	import { queueRow } from '$lib/view/activity';
	import { library } from '$lib/stores/library.svelte';
	import Poster from '$lib/components/Poster.svelte';

	// ---- local view state ----
	let view = $state<'poster' | 'overview' | 'table'>('poster');
	let sort = $state<'added' | 'title' | 'year' | 'size' | 'status'>('added');
	let filter = $state<
		'all' | 'monitored' | 'unmonitored' | 'downloaded' | 'missing' | 'downloading' | 'cutoff'
	>('all');
	let typeFilter = $state<'all' | 'movie' | 'series'>('all');
	let filtersOpen = $state(true);
	let mass = $state(false);
	let sel = $state<Record<string, boolean>>({});
	let saved = $state<string[]>([]);
	let confirmOpen = $state(false);

	// ---- data (from the shared library store) ----
	const qIndex = $derived(queueIndex([...store.extraQueue, ...library.queue]));
	const queueProgress = $derived.by(() => {
		const m = new Map<string, string>();
		for (const q of [...store.extraQueue, ...library.queue]) {
			const row = queueRow(q);
			let id: string | null = null;
			if ('seriesId' in q && q.seriesId != null) id = `s:${q.seriesId}`;
			else if ('movieId' in q && q.movieId != null) id = `m:${q.movieId}`;
			if (id) m.set(id, `${row.pctNum}%`);
		}
		return m;
	});

	const allItems = $derived<MediaItem[]>([
		...library.series.map((s) =>
			seriesToMediaItem(s, library.profileNames, qIndex.series.has(s.id))
		),
		...library.movies.map((m) => movieToMediaItem(m, library.profileNames, qIndex.movie.has(m.id)))
	]);

	const seriesCount = $derived(library.series.length);
	const movieCount = $derived(library.movies.length);
	const totalBytes = $derived(allItems.reduce((n, it) => n + it.sizeBytes, 0));

	const q = $derived(store.query.trim().toLowerCase());

	// pool = type + text-search filter (before status filter), matches the design.
	const pool = $derived(
		allItems.filter((it) => {
			if (typeFilter !== 'all' && it.kind !== typeFilter) return false;
			if (q && !it.title.toLowerCase().includes(q)) return false;
			return true;
		})
	);

	const counts = $derived({
		all: pool.length,
		monitored: pool.filter((it) => it.monitored).length,
		unmonitored: pool.filter((it) => !it.monitored).length,
		downloaded: pool.filter((it) => it.status === 'downloaded').length,
		missing: pool.filter((it) => it.status === 'missing').length,
		downloading: pool.filter((it) => it.status === 'downloading').length,
		cutoff: pool.filter((it) => it.status === 'upgrading').length
	} as Record<string, number>);

	const filtered = $derived.by(() => {
		let a = pool;
		if (filter === 'monitored') a = a.filter((it) => it.monitored);
		else if (filter === 'unmonitored') a = a.filter((it) => !it.monitored);
		else if (filter === 'missing') a = a.filter((it) => it.status === 'missing');
		else if (filter === 'downloaded') a = a.filter((it) => it.status === 'downloaded');
		else if (filter === 'downloading') a = a.filter((it) => it.status === 'downloading');
		else if (filter === 'cutoff') a = a.filter((it) => it.status === 'upgrading');
		return [...a].sort((x, y) => {
			if (sort === 'title') return x.title.localeCompare(y.title);
			if (sort === 'year') return y.year - x.year;
			if (sort === 'size') return y.sizeBytes - x.sizeBytes;
			if (sort === 'status') return x.status.localeCompare(y.status);
			return Date.parse(y.added) - Date.parse(x.added);
		});
	});

	const rows = $derived(
		filtered.map((it) => ({
			it,
			key: it.id,
			href: `/library/${it.id}`,
			tag: it.kind === 'series' ? 'TV' : 'M',
			sizeLabel: formatBytes(it.sizeBytes),
			genresLabel: it.genres.join(' · '),
			countLabel: countLabel(it),
			statusLabel: STATUS_LABEL[it.status as DerivedStatus],
			// Series show "12/24 eps" in place of the state label; movies keep the label.
			statusText:
				it.kind === 'series' && it.totalCount > 0
					? `${it.haveCount}/${it.totalCount} eps`
					: STATUS_LABEL[it.status as DerivedStatus],
			statusFg: STATUS_COLOR[it.status as DerivedStatus],
			badgeBg: STATUS_BADGE_BG[it.status as DerivedStatus],
			unmon: !it.monitored,
			progress: queueProgress.get(it.id) ?? null,
			get selected() {
				return !!sel[it.id];
			}
		}))
	);

	const libSummary = $derived(
		`${movieCount} movies · ${seriesCount} series · ${formatBytes(totalBytes)} · ${counts.missing} missing`
	);

	// ---- filters bar config ----
	const VIEW_ICONS: Record<string, string[]> = {
		poster: ['M4 4h6v16H4zM14 4h6v16h-6z'],
		overview: ['M4 6h4v12H4z', 'M11 7h9M11 12h9M11 17h6'],
		table: ['M3 6h18M3 12h18M3 18h18']
	};
	const VIEWS = [
		{ key: 'poster', label: 'Poster' },
		{ key: 'overview', label: 'Overview' },
		{ key: 'table', label: 'Table' }
	] as const;
	const SORT_OPTS = [
		{ v: 'added', l: 'Sort: Recently added' },
		{ v: 'title', l: 'Sort: Title' },
		{ v: 'year', l: 'Sort: Year' },
		{ v: 'size', l: 'Sort: Size' },
		{ v: 'status', l: 'Sort: Status' }
	];
	const TYPE_FILTERS = [
		{ key: 'all', label: 'All' },
		{ key: 'movie', label: 'Movies' },
		{ key: 'series', label: 'Series' }
	] as const;
	const STATUS_FILTERS = [
		{ key: 'all', label: 'Any', dot: null },
		{ key: 'monitored', label: 'Monitored', dot: null },
		{ key: 'downloaded', label: 'Downloaded', dot: 'var(--ok)' },
		{ key: 'missing', label: 'Missing', dot: 'var(--warn)' },
		{ key: 'downloading', label: 'Downloading', dot: 'var(--accent)' },
		{ key: 'cutoff', label: 'Cutoff Unmet', dot: 'var(--accent)' },
		{ key: 'unmonitored', label: 'Unmonitored', dot: 'var(--neutral)' }
	] as const;

	const typeCounts = $derived({
		all: allItems.length,
		movie: movieCount,
		series: seriesCount
	} as Record<string, number>);

	const filtersActive = $derived(typeFilter !== 'all' || filter !== 'all');
	const FILTER_LABEL: Record<string, string> = {
		all: 'Any status',
		monitored: 'Monitored',
		unmonitored: 'Unmonitored',
		downloaded: 'Downloaded',
		missing: 'Missing',
		downloading: 'Downloading',
		cutoff: 'Cutoff Unmet'
	};
	const filtersSummary = $derived(
		`${typeFilter === 'all' ? 'All types' : typeFilter === 'movie' ? 'Movies' : 'Series'} · ${
			FILTER_LABEL[filter]
		}${saved.length ? ` +${saved.length}` : ''}`
	);

	const libCols = $derived([
		...(mass ? [{ key: 'chk', label: '', align: 'left', w: '34px' }] : []),
		{ key: 'tag', label: '', align: 'left', w: '34px' },
		{ key: 'title', label: 'Title', align: 'left', w: 'auto' },
		{ key: 'year', label: 'Year', align: 'right', w: '56px' },
		{ key: 'quality', label: 'Quality', align: 'left', w: '124px' },
		{ key: 'count', label: 'Files / Eps', align: 'right', w: '84px' },
		{ key: 'size', label: 'Size', align: 'right', w: '80px' },
		{ key: 'status', label: 'Status', align: 'left', w: '116px' }
	]);

	// ---- mass editor ----
	const selIds = $derived(Object.keys(sel).filter((k) => sel[k]));
	const allSelected = $derived(rows.length > 0 && rows.every((r) => sel[r.key]));

	function toggleSel(id: string) {
		sel = { ...sel, [id]: !sel[id] };
	}
	function selectAll() {
		if (allSelected) {
			sel = {};
		} else {
			const n: Record<string, boolean> = {};
			for (const r of rows) n[r.key] = true;
			sel = n;
		}
	}
	function toggleMass() {
		mass = !mass;
		sel = {};
	}

	const massActions = $derived(
		(
			[
				['Monitor', () => store.toast(`${selIds.length} titles monitored`, 'var(--ok)'), false],
				[
					'Unmonitor',
					() => store.toast(`${selIds.length} titles unmonitored`, 'var(--neutral)'),
					false
				],
				[
					'Quality Profile',
					() => store.toast('Quality profile: opens editor', 'var(--accent)'),
					false
				],
				['Root Folder', () => store.toast('Root folder: opens editor', 'var(--accent)'), false],
				['Tags', () => store.toast('Tags: opens editor', 'var(--accent)'), false],
				['Refresh', () => runRefreshSelected(), false],
				['Delete', () => store.toast(`Delete ${selIds.length} titles`, 'var(--err)'), true]
			] as [string, () => void, boolean][]
		).map(([label, onClick, danger]) => ({
			key: label,
			label,
			danger,
			disabled: selIds.length === 0,
			onClick: () => selIds.length > 0 && onClick()
		}))
	);

	function rowClick(e: MouseEvent, r: (typeof rows)[number]) {
		if (mass) {
			e.preventDefault();
			toggleSel(r.key);
		}
	}

	// ---- actions ----
	function runRefreshSelected() {
		const ser = selIds.filter((id) => id.startsWith('s:')).map((id) => +id.slice(2));
		const mov = selIds.filter((id) => id.startsWith('m:')).map((id) => +id.slice(2));
		store.toast(`Rescan queued · ${selIds.length} titles`, 'var(--accent)');
		if (ser.length)
			api.sendCommand('series', { name: 'RefreshSeries', seriesIds: ser }).catch(() => {});
		if (mov.length)
			api.sendCommand('movie', { name: 'RefreshMovie', movieIds: mov }).catch(() => {});
	}
	function updateLibrary() {
		store.toast('Library refresh queued', 'var(--accent)');
		api.sendCommand('series', { name: 'RefreshSeries' }).catch(() => {});
		api.sendCommand('movie', { name: 'RefreshMovie' }).catch(() => {});
	}
	function rssSync() {
		store.toast('RSS sync started', 'var(--accent)');
		api.sendCommand('series', { name: 'RssSync' }).catch(() => {});
		api.sendCommand('movie', { name: 'RssSync' }).catch(() => {});
	}
	function confirmSearchAll() {
		confirmOpen = false;
		store.toast(`Search started · ${counts.monitored} monitored titles`, 'var(--warn)');
		api.sendCommand('series', { name: 'MissingEpisodeSearch' }).catch(() => {});
		api.sendCommand('movie', { name: 'MissingMoviesSearch' }).catch(() => {});
	}
	function addSavedFilter() {
		saved = [...saved, `Custom · ${saved.length + 1}`];
		store.toast('Custom filter saved', 'var(--accent)');
	}
</script>

<div
	style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px"
>
	<div>
		<h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:-.02em">Library</h1>
		<p style="margin:3px 0 0;font-size:13px;color:var(--sec)">{libSummary}</p>
	</div>
	<div style="display:flex;gap:8px">
		<button
			type="button"
			onclick={() => library.refresh()}
			title="Reload from Sonarr / Radarr"
			class="at-bdh-t"
			style="display:grid;place-items:center;width:32px;height:32px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--sec);cursor:pointer;transition:border-color 120ms ease-out"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				style={library.loading ? 'animation:spin 700ms linear infinite' : ''}
				><path d="M20.5 12a8.5 8.5 0 1 1-3.2-6.6" /><path d="M21 4v5h-5" /></svg
			>
		</button>
		<button
			type="button"
			onclick={toggleMass}
			class="at-bdh"
			style="height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out;background:{mass
				? 'var(--hover)'
				: 'transparent'};color:var(--text)">{mass ? 'Exit Mass Editor' : 'Mass Editor'}</button
		>
	</div>
</div>

<!-- actions bar -->
<div style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);margin-bottom:12px">
	<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 12px">
		<span
			style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:4px"
			>Actions</span
		>
		<button
			type="button"
			onclick={updateLibrary}
			class="at-bdh"
			style="display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
		>
			<svg
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"><path d="M20.5 12a8.5 8.5 0 1 1-3.2-6.6" /><path d="M21 4v5h-5" /></svg
			>Update Library
		</button>
		<button
			type="button"
			onclick={rssSync}
			class="at-bdh"
			style="height:30px;padding:0 10px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
			>RSS Sync</button
		>
		<button
			type="button"
			onclick={() => store.toast('Manual import opened', 'var(--accent)')}
			class="at-bdh"
			style="height:30px;padding:0 10px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
			>Manual Import</button
		>
		<div style="flex:1"></div>
		<button
			type="button"
			onclick={() => (confirmOpen = true)}
			class="at-warn"
			style="display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:6px;border:1px solid rgba(245,166,35,.35);background:rgba(245,166,35,.08);color:var(--warn);font-size:12px;font-weight:500;cursor:pointer;transition:background 120ms ease-out"
		>
			<svg
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				><path d="M12 4.5 21 19H3z" /><path d="M12 10v4" /><path d="M12 16.6h.01" /></svg
			>Search All Monitored
		</button>
	</div>
	{#if confirmOpen}
		<div
			style="display:flex;align-items:center;gap:14px;padding:13px 16px;border-top:1px solid rgba(245,166,35,.35);background:rgba(245,166,35,.07);animation:tin 140ms ease-out"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				style="flex:none;color:var(--warn)"
				><path d="M12 4.5 21 19H3z" /><path d="M12 10v4" /><path d="M12 16.6h.01" /></svg
			>
			<div style="flex:1;min-width:0">
				<div style="font-size:13px;font-weight:500">Search all monitored titles?</div>
				<div style="font-size:12px;color:var(--sec);margin-top:1px">
					{counts.monitored} monitored titles · runs missing searches on Sonarr + Radarr
				</div>
			</div>
			<button
				type="button"
				onclick={() => (confirmOpen = false)}
				style="height:30px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer"
				>Cancel</button
			>
			<button
				type="button"
				onclick={confirmSearchAll}
				class="at-op"
				style="height:30px;padding:0 12px;border-radius:6px;border:none;background:var(--warn);color:#0A0A0A;font-size:12px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out"
				>Search {counts.monitored} titles</button
			>
		</div>
	{/if}
</div>

<!-- view + filters bar -->
<div style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);margin-bottom:16px">
	<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 12px">
		<span
			style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:4px"
			>View</span
		>
		<div style="display:flex;gap:2px;padding:2px;border:1px solid var(--bd);border-radius:6px">
			{#each VIEWS as v (v.key)}
				<button
					type="button"
					onclick={() => (view = v.key)}
					title={v.label}
					style="display:grid;place-items:center;width:28px;height:24px;border:none;border-radius:5px;cursor:pointer;transition:background 120ms ease-out;background:{view ===
					v.key
						? 'var(--inv)'
						: 'transparent'};color:{view === v.key ? 'var(--invfg)' : 'var(--sec)'}"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.7"
						>{#each VIEW_ICONS[v.key] as d}<path {d} />{/each}</svg
					>
				</button>
			{/each}
		</div>
		<select
			bind:value={sort}
			style="height:30px;padding:0 8px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--text);font-size:12px;cursor:pointer;outline:none"
		>
			{#each SORT_OPTS as o (o.v)}
				<option value={o.v}>{o.l}</option>
			{/each}
		</select>
		{#if view === 'poster'}
			<button
				type="button"
				onclick={() => store.cyclePoster()}
				title="Poster size"
				class="at-bdh-t"
				style="height:30px;padding:0 10px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--sec);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
				>{store.posterSizeLabel}</button
			>
		{/if}
		<button
			type="button"
			onclick={() => (filtersOpen = !filtersOpen)}
			class="at-bdh"
			style="display:flex;align-items:center;gap:7px;height:30px;padding:0 10px;border-radius:6px;border:1px solid {filtersActive
				? 'var(--bdh)'
				: 'var(--bd)'};font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out;background:{filtersActive
				? 'var(--hover)'
				: 'transparent'};color:{filtersActive ? 'var(--text)' : 'var(--sec)'}"
		>
			<svg
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				style="flex:none"><path d="M4 6h16M7 12h10M10 18h4" /></svg
			>Filters
			<span
				style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
				>{filtersSummary}</span
			>
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				style="flex:none;color:var(--muted);transition:transform 130ms ease-out;transform:rotate({filtersOpen
					? '180deg'
					: '0deg'})"><path d="M6 9l6 6 6-6" /></svg
			>
		</button>
	</div>

	{#if filtersOpen}
		<div
			style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:10px 12px;border-top:1px solid var(--bd);animation:fin 130ms ease-out"
		>
			<span
				style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:2px"
				>Type</span
			>
			{#each TYPE_FILTERS as f (f.key)}
				{@const on = typeFilter === f.key}
				<button
					type="button"
					onclick={() => {
						typeFilter = f.key;
						sel = {};
					}}
					style="display:flex;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:6px;border:1px solid {on
						? 'var(--bdh)'
						: 'var(--bd)'};font-size:12px;font-weight:500;cursor:pointer;background:{on
						? 'var(--hover)'
						: 'transparent'};color:{on ? 'var(--text)' : 'var(--sec)'}"
				>
					{f.label}<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
						>{typeCounts[f.key]}</span
					>
				</button>
			{/each}
			<span style="width:1px;height:18px;background:var(--bd);margin:0 6px"></span>
			<span
				style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:2px"
				>Status</span
			>
			{#each STATUS_FILTERS as f (f.key)}
				{@const on = filter === f.key}
				<button
					type="button"
					onclick={() => (filter = f.key)}
					style="display:flex;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:6px;border:1px solid {on
						? 'var(--bdh)'
						: 'var(--bd)'};font-size:12px;font-weight:500;cursor:pointer;background:{on
						? 'var(--hover)'
						: 'transparent'};color:{on ? 'var(--text)' : 'var(--sec)'}"
				>
					{#if f.dot}<span style="width:6px;height:6px;border-radius:50%;background:{f.dot}"
						></span>{/if}{f.label}
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
						>{counts[f.key]}</span
					>
				</button>
			{/each}
			<span style="width:1px;height:18px;background:var(--bd);margin:0 4px"></span>
			<button
				type="button"
				onclick={addSavedFilter}
				class="at-bdh-t"
				style="display:flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:6px;border:1px dashed var(--bd);background:transparent;color:var(--sec);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><path d="M12 5v14M5 12h14" /></svg
				>Custom filter
			</button>
			{#each saved as s, i (s)}
				<button
					type="button"
					onclick={() => (filter = 'missing')}
					style="display:flex;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:6px;border:1px solid var(--accent);background:var(--sel);color:var(--text);font-size:12px;font-weight:500;cursor:pointer"
				>
					{s}<span
						role="button"
						tabindex="0"
						onclick={(e) => {
							e.stopPropagation();
							saved = saved.filter((_, j) => j !== i);
						}}
						onkeydown={() => {}}
						style="color:var(--muted);font-size:13px">×</span
					>
				</button>
			{/each}
		</div>
	{/if}

	{#if mass}
		<div
			style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:11px 12px;border-top:1px solid var(--bd);background:var(--bg);animation:tin 140ms ease-out"
		>
			<button
				type="button"
				onclick={selectAll}
				style="height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer"
				>{allSelected ? 'Deselect All' : 'Select All'}</button
			>
			<span style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
				>{selIds.length} selected</span
			>
			<span style="width:1px;height:18px;background:var(--bd);margin:0 2px"></span>
			{#each massActions as m (m.key)}
				<button
					type="button"
					onclick={m.onClick}
					disabled={m.disabled}
					class="at-bdh"
					style="height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--bd);background:transparent;font-size:12px;font-weight:500;cursor:pointer;opacity:{m.disabled
						? '.45'
						: '1'};transition:border-color 120ms ease-out;color:{m.danger
						? 'var(--err)'
						: 'var(--text)'}">{m.label}</button
				>
			{/each}
		</div>
	{/if}
</div>

{#if allItems.length === 0 && library.loading}
	<div
		style="display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--poster),1fr));gap:14px"
	>
		{#each Array(12) as _, i (i)}
			<div
				style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;background:var(--surf)"
			>
				<div
					style="aspect-ratio:2/3;background:var(--bd);opacity:.4;animation:fin 900ms ease-in-out infinite alternate"
				></div>
				<div style="height:34px"></div>
			</div>
		{/each}
	</div>
{:else if allItems.length === 0 && library.error}
	<div
		style="border:1px solid rgba(238,0,0,.3);border-radius:8px;background:var(--surf);padding:28px;text-align:center"
	>
		<div style="font-size:14px;font-weight:600">Couldn't reach Sonarr / Radarr</div>
		<div style="font-size:13px;color:var(--sec);margin-top:4px">
			The library couldn't be loaded. Check that the instances are up.
		</div>
		<button
			type="button"
			onclick={() => library.refresh()}
			class="at-bdh"
			style="margin-top:14px;height:32px;padding:0 14px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer"
			>Retry</button
		>
	</div>
{:else if allItems.length === 0}
	<div style="padding:28px;font-size:13px;color:var(--muted);text-align:center">
		Your library is empty. Add something from <a href="/add">Add New</a>.
	</div>
{/if}

<!-- poster view -->
{#if allItems.length > 0 && view === 'poster'}
	<div
		style="display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--poster),1fr));gap:14px"
	>
		{#each rows as r (r.key)}
			<a
				href={r.href}
				onclick={(e) => rowClick(e, r)}
				class="at-bdh"
				style="position:relative;display:block;border:1px solid {r.selected
					? 'var(--accent)'
					: 'var(--bd)'};border-radius:8px;background:{r.selected
					? 'var(--sel)'
					: 'var(--surf)'};overflow:hidden;text-decoration:none;color:inherit;transition:border-color 120ms ease-out"
			>
				<div style="position:relative;aspect-ratio:2/3;border-bottom:1px solid var(--bd)">
					<Poster src={r.it.poster} alt={r.it.title} fallbackText={r.it.title}>
						{#snippet top({ onImage })}
							{#if mass}
								<span
									style="width:15px;height:15px;flex:none;border-radius:4px;border:1px solid {r.selected
										? 'var(--inv)'
										: onImage
											? 'rgba(255,255,255,.6)'
											: 'var(--bd)'};background:{r.selected
										? 'var(--inv)'
										: 'transparent'};display:grid;place-items:center;color:var(--invfg);font-size:10px"
									>{r.selected ? '✓' : ''}</span
								>
							{/if}
							<span
								style="flex:1;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;color:{onImage
									? 'rgba(255,255,255,.85)'
									: 'var(--muted)'};padding-left:2px;text-shadow:{onImage
									? '0 1px 2px rgba(0,0,0,.6)'
									: 'none'}">{r.tag}</span
							>
							<span style="display:flex;align-items:center;gap:5px">
								{#if r.unmon}
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.8"
										style="color:{onImage ? 'rgba(255,255,255,.85)' : 'var(--muted)'}"
										><path d="M6 3h12v18l-6-4-6 4z" /><path d="M4 4l16 16" /></svg
									>
								{/if}
								<span
									style="width:7px;height:7px;border-radius:50%;background:{r.statusFg};box-shadow:{onImage
										? '0 0 0 1.5px rgba(0,0,0,.35)'
										: 'none'}"
								></span>
							</span>
						{/snippet}
						{#snippet bottom({ onImage })}
							<div
								style="font-size:13px;font-weight:600;letter-spacing:-.01em;line-height:1.2;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:{onImage
									? '#fff'
									: 'var(--text)'};text-shadow:{onImage ? '0 1px 3px rgba(0,0,0,.7)' : 'none'}"
							>
								{r.it.title}
							</div>
							<div
								style="font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:{onImage
									? 'rgba(255,255,255,.8)'
									: 'var(--muted)'};text-shadow:{onImage ? '0 1px 2px rgba(0,0,0,.6)' : 'none'}"
							>
								{r.it.year} · {r.it.source}
							</div>
							<span
								style="align-self:flex-start;font-size:10px;font-weight:500;padding:1px 6px;border-radius:4px;background:{onImage
									? 'rgba(255,255,255,.16)'
									: 'var(--bg)'};border:1px solid {onImage
									? 'transparent'
									: 'var(--bd)'};color:{onImage ? '#fff' : 'var(--sec)'}">{r.it.qualityLabel}</span
							>
						{/snippet}
					</Poster>
				</div>

				<div
					style="padding:8px 11px;display:flex;align-items:center;justify-content:space-between;gap:6px"
				>
					<span
						style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:{r.statusFg};overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
					>
						<span style="width:5px;height:5px;border-radius:50%;background:{r.statusFg}"
						></span>{r.statusText}
					</span>
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);flex:none"
						>{r.sizeLabel}</span
					>
				</div>
				{#if r.progress}
					<div style="height:4px;background:var(--bd)">
						<div style="height:100%;background:var(--accent);width:{r.progress}"></div>
					</div>
				{/if}
			</a>
		{/each}
	</div>
{/if}

<!-- overview view -->
{#if allItems.length > 0 && view === 'overview'}
	<div style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden">
		{#each rows as r (r.key)}
			<a
				href={r.href}
				onclick={(e) => rowClick(e, r)}
				class="at-hov-bg"
				style="display:flex;gap:16px;padding:16px;border-bottom:1px solid var(--bd);text-decoration:none;color:inherit;transition:background 120ms ease-out"
			>
				<div
					style="position:relative;flex:none;width:84px;aspect-ratio:2/3;border:1px solid var(--bd);border-radius:6px;overflow:hidden"
				>
					<Poster src={r.it.poster} alt={r.it.title} fallbackText={r.it.title} />
				</div>
				<div style="flex:1;min-width:0">
					<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
						<span
							style="font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;padding:2px 5px;border-radius:4px;border:1px solid var(--bd);color:var(--muted)"
							>{r.tag}</span
						>
						<h3 style="margin:0;font-size:14px;font-weight:600;letter-spacing:-.02em">
							{r.it.title}
						</h3>
						<span
							style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
							>{r.it.year}</span
						>
						<span
							style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;background:{r.badgeBg};color:{r.statusFg}"
						>
							<span style="width:5px;height:5px;border-radius:50%;background:{r.statusFg}"
							></span>{r.statusText}
						</span>
						<span
							style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;border:1px solid var(--bd);color:var(--sec)"
							>{r.it.qualityLabel}</span
						>
					</div>
					<p
						style="margin:7px 0 0;font-size:13px;color:var(--sec);line-height:1.55;max-width:78ch;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"
					>
						{r.it.overview}
					</p>
					<div
						style="display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
					>
						<span>{r.sizeLabel}</span><span>{r.countLabel}</span><span>{r.genresLabel}</span><span
							>{r.it.path}</span
						>
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}

<!-- table view -->
{#if allItems.length > 0 && view === 'table'}
	<div style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow-x:auto">
		<table style="width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed">
			<thead>
				<tr style="background:var(--surf)">
					{#each libCols as c (c.key)}
						<th
							style="text-align:{c.align};padding:10px 14px;border-bottom:1px solid var(--bd);font-size:12px;font-weight:500;color:var(--muted);white-space:nowrap;background:var(--surf);width:{c.w}"
							>{c.label}</th
						>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.key)}
					<tr
						onclick={(e) => {
							if (mass) toggleSel(r.key);
							else goto(r.href);
						}}
						style="cursor:pointer;transition:background 120ms ease-out"
					>
						{#if mass}
							<td style="padding:var(--rowpad);border-bottom:1px solid var(--bd);width:34px">
								<span
									style="display:block;width:15px;height:15px;border-radius:4px;border:1px solid {r.selected
										? 'var(--inv)'
										: 'var(--bd)'};background:{r.selected
										? 'var(--inv)'
										: 'transparent'};color:var(--invfg);font-size:10px;text-align:center;line-height:13px"
									>{r.selected ? '✓' : ''}</span
								>
							</td>
						{/if}
						<td style="padding:var(--rowpad);border-bottom:1px solid var(--bd);width:30px"
							><span
								style="font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;color:var(--muted)"
								>{r.tag}</span
							></td
						>
						<td style="padding:var(--rowpad);border-bottom:1px solid var(--bd);font-weight:500"
							><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
								{r.it.title}
							</div></td
						>
						<td
							style="padding:var(--rowpad);border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;color:var(--sec);text-align:right;white-space:nowrap"
							>{r.it.year}</td
						>
						<td style="padding:var(--rowpad);border-bottom:1px solid var(--bd);color:var(--sec)"
							><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
								{r.it.qualityLabel}
							</div></td
						>
						<td
							style="padding:var(--rowpad);border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;color:var(--sec);text-align:right;white-space:nowrap"
							>{r.countLabel}</td
						>
						<td
							style="padding:var(--rowpad);border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;color:var(--sec);text-align:right;white-space:nowrap"
							>{r.sizeLabel}</td
						>
						<td style="padding:var(--rowpad);border-bottom:1px solid var(--bd)">
							<span
								style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:{r.statusFg};white-space:nowrap"
							>
								<span style="width:6px;height:6px;border-radius:50%;background:{r.statusFg}"
								></span>{r.statusLabel}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if allItems.length > 0 && rows.length === 0}
	<div style="padding:24px;font-size:13px;color:var(--muted)">
		Nothing matches the current filters.
	</div>
{/if}

{#if allItems.length > 0}
	<div
		style="margin-top:14px;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
	>
		Showing {rows.length} of {pool.length}
	</div>
{/if}
