<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { store } from '$lib/stores/store.svelte';
	import { library } from '$lib/stores/library.svelte';
	import { STATUS_BADGE_BG, STATUS_COLOR } from '$lib/view/status';
	import { buildWantedRows, type WantedRow } from '$lib/view/wanted';
	import ActionCluster from '$lib/components/ActionCluster.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let tab = $state<'missing' | 'cutoff'>('missing');
	let confirmOpen = $state(false);
	let sel = $state<Record<string, boolean>>({});
	let now = $state(new Date());
	// Local episode monitor overrides (Sonarr has no per-episode resource in the library store).
	let epMon = $state<Record<number, boolean>>({});

	onMount(() => {
		const t = setInterval(() => (now = new Date()), 300_000);
		return () => clearInterval(t);
	});

	const seriesById = $derived(new Map(library.series.map((s) => [s.id, s])));
	const moviesById = $derived(new Map(library.movies.map((m) => [m.id, m])));

	const missingRows = $derived([
		...buildWantedRows(
			data.missingSeries.records,
			'series',
			'missing',
			seriesById,
			moviesById,
			now
		),
		...buildWantedRows(data.missingMovies.records, 'movie', 'missing', seriesById, moviesById, now)
	]);
	const cutoffRows = $derived([
		...buildWantedRows(data.cutoffSeries.records, 'series', 'cutoff', seriesById, moviesById, now),
		...buildWantedRows(data.cutoffMovies.records, 'movie', 'cutoff', seriesById, moviesById, now)
	]);

	const missingTotal = $derived(data.missingSeries.totalRecords + data.missingMovies.totalRecords);
	const cutoffTotal = $derived(data.cutoffSeries.totalRecords + data.cutoffMovies.totalRecords);

	const rows = $derived(
		(tab === 'missing' ? missingRows : cutoffRows)
			.map((r) => ({
				...r,
				monitored: r.episodeId != null ? (epMon[r.episodeId] ?? r.monitored) : r.monitored
			}))
			.sort((a, b) => b.airMs - a.airMs)
	);

	const tabTotal = $derived(tab === 'missing' ? missingTotal : cutoffTotal);
	const summary = $derived(
		`${rows.length} shown${tabTotal > rows.length ? ` of ${tabTotal}` : ''} · sorted by air date`
	);

	const wantedTabs = $derived([
		{ key: 'missing' as const, label: 'Missing', count: missingTotal },
		{ key: 'cutoff' as const, label: 'Cutoff Unmet', count: cutoffTotal }
	]);

	const hasAny = $derived(missingRows.length + cutoffRows.length > 0);
	const loadFailed = $derived(data.loadErrors.length > 0);

	const selIds = $derived(rows.filter((r) => sel[r.key]));

	const confirmTitle = $derived(
		tab === 'missing' ? 'Search all missing?' : 'Search all cutoff unmet?'
	);
	const confirmDetail = $derived(
		tab === 'missing'
			? `${missingTotal} items · queues a grab for anything found`
			: `${cutoffTotal} items · found releases replace the existing file`
	);

	function switchTab(k: 'missing' | 'cutoff') {
		tab = k;
		confirmOpen = false;
		sel = {};
	}

	function toggleSel(key: string) {
		sel = { ...sel, [key]: !sel[key] };
	}

	async function toggleMonitored(r: WantedRow) {
		if (r.episodeId != null) {
			const next = !r.monitored;
			epMon = { ...epMon, [r.episodeId]: next };
			try {
				await api.setEpisodeMonitored([r.episodeId], next);
				store.toast(`${next ? 'Monitoring' : 'Unmonitored'} · ${r.searchLabel}`, 'var(--neutral)');
			} catch {
				epMon = { ...epMon, [r.episodeId]: !next };
				store.toast(`Couldn't update monitoring · ${r.searchLabel}`, 'var(--err)');
			}
			return;
		}
		const idx = library.movies.findIndex((m) => m.id === r.movieId);
		if (idx < 0) {
			store.toast('Movie not loaded yet, try again', 'var(--neutral)');
			return;
		}
		const movie = library.movies[idx];
		const updated = { ...movie, monitored: !movie.monitored };
		try {
			const saved = await api.updateMovie(updated);
			library.movies[idx] = saved;
			store.toast(
				`${saved.monitored ? 'Monitoring' : 'Unmonitored'} · ${r.searchLabel}`,
				'var(--neutral)'
			);
		} catch {
			store.toast(`Couldn't update monitoring · ${r.searchLabel}`, 'var(--err)');
		}
	}

	async function automaticSearch(r: WantedRow) {
		store.toast(`Searching · ${r.searchLabel}`, 'var(--accent)');
		try {
			if (r.episodeId != null) {
				await api.sendCommand('series', { name: 'EpisodeSearch', episodeIds: [r.episodeId] });
			} else {
				await api.sendCommand('movie', { name: 'MoviesSearch', movieIds: [r.movieId] });
			}
		} catch {
			store.toast(`Search failed · ${r.searchLabel}`, 'var(--err)');
		}
	}

	function interactiveSearch(r: WantedRow) {
		if (r.episodeId != null && r.seriesId != null) {
			store.openSearch({
				kind: 'episode',
				seriesId: r.seriesId,
				episodeId: r.episodeId,
				label: r.searchLabel
			});
		} else if (r.movieId != null) {
			store.openSearch({ kind: 'movie', movieId: r.movieId, label: r.searchLabel });
		}
	}

	function rowActions(r: WantedRow) {
		return [
			{
				icon: 'monitor',
				label: r.monitored ? 'Monitored' : 'Unmonitored',
				on: r.monitored,
				onClick: () => toggleMonitored(r)
			},
			{ icon: 'search', label: 'Automatic Search', onClick: () => automaticSearch(r) },
			{ icon: 'isearch', label: 'Interactive Search', onClick: () => interactiveSearch(r) },
			{ icon: 'history', label: 'History', onClick: () => goto('/activity') }
		];
	}

	async function searchSelected() {
		if (selIds.length === 0) {
			store.toast('Nothing selected', 'var(--neutral)');
			return;
		}
		const episodeIds = selIds.map((r) => r.episodeId).filter((n): n is number => n != null);
		const movieIds = selIds.map((r) => r.movieId).filter((n): n is number => n != null);
		store.toast(`${selIds.length} searches queued`, 'var(--warn)');
		try {
			if (episodeIds.length) await api.sendCommand('series', { name: 'EpisodeSearch', episodeIds });
			if (movieIds.length) await api.sendCommand('movie', { name: 'MoviesSearch', movieIds });
		} catch {
			store.toast('Some searches failed to queue', 'var(--err)');
		}
		sel = {};
	}

	function confirmSearchAll() {
		confirmOpen = false;
		store.toast(`${tabTotal} searches queued`, 'var(--warn)');
		const [seriesCmd, movieCmd] =
			tab === 'missing'
				? ['MissingEpisodeSearch', 'MissingMoviesSearch']
				: ['CutoffUnmetEpisodeSearch', 'CutoffUnmetMoviesSearch'];
		api.sendCommand('series', { name: seriesCmd }).catch(() => {});
		api.sendCommand('movie', { name: movieCmd }).catch(() => {});
	}
</script>

<h1 style="margin:0 0 14px;font-size:24px;font-weight:600;letter-spacing:-.02em">Wanted</h1>

<div style="display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:16px">
	{#each wantedTabs as t (t.key)}
		<button
			type="button"
			onclick={() => switchTab(t.key)}
			class="at-ct"
			style="padding:9px 12px;border:none;background:transparent;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid {tab ===
			t.key
				? 'var(--text)'
				: 'transparent'};margin-bottom:-1px;color:{tab === t.key ? 'var(--text)' : 'var(--muted)'}"
			>{t.label}<span
				style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-left:6px"
				>{t.count}</span
			></button
		>
	{/each}
</div>

<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
	<button
		type="button"
		onclick={searchSelected}
		class="at-op"
		style="height:30px;padding:0 11px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:12px;font-weight:500;cursor:pointer"
		>Search Selected</button
	>
	<button
		type="button"
		onclick={() => (confirmOpen = true)}
		class="at-warn"
		style="height:30px;padding:0 11px;border-radius:6px;border:1px solid rgba(245,166,35,.35);background:rgba(245,166,35,.08);color:var(--warn);font-size:12px;font-weight:500;cursor:pointer"
		>Search All</button
	>
	<div style="flex:1"></div>
	<span style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
		>{summary}</span
	>
</div>

{#if confirmOpen}
	<div
		style="display:flex;align-items:center;gap:14px;padding:13px 16px;margin-bottom:12px;border:1px solid rgba(245,166,35,.35);border-radius:8px;background:rgba(245,166,35,.07);animation:tin 140ms ease-out"
	>
		<div style="flex:1;min-width:0">
			<div style="font-size:13px;font-weight:500">{confirmTitle}</div>
			<div style="font-size:12px;color:var(--sec);margin-top:1px">{confirmDetail}</div>
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
			style="height:30px;padding:0 12px;border-radius:6px;border:none;background:var(--warn);color:#0A0A0A;font-size:12px;font-weight:500;cursor:pointer"
			>Start search</button
		>
	</div>
{/if}

{#if rows.length > 0}
	<div style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden">
		{#each rows as w (w.key)}
			{@const badge = w.status === 'missing' ? 'Missing' : 'Cutoff Unmet'}
			<div
				class="at-hov-bg"
				style="display:flex;align-items:center;gap:12px;padding:var(--rowpad);border-bottom:1px solid var(--bd);transition:background 120ms ease-out"
			>
				<button
					type="button"
					onclick={() => toggleSel(w.key)}
					aria-label={sel[w.key] ? 'Deselect' : 'Select'}
					style="flex:none;width:16px;height:16px;border-radius:4px;display:grid;place-items:center;cursor:pointer;font-size:11px;padding:0;border:1px solid {sel[
						w.key
					]
						? 'var(--inv)'
						: 'var(--bd)'};background:{sel[w.key]
						? 'var(--inv)'
						: 'transparent'};color:var(--invfg)">{sel[w.key] ? '✓' : ''}</button
				>
				<span
					style="flex:none;width:20px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;border:1px solid var(--bd);border-radius:4px;color:var(--muted)"
					>{w.tag}</span
				>
				<a
					href={w.href}
					style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;text-decoration:none;color:inherit"
					>{w.title}</a
				>
				<span
					style="flex:none;width:60px;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
					>{w.code}</span
				>
				<span
					style="flex:none;width:88px;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
					>{w.air}</span
				>
				<span
					style="flex:none;width:150px;font-size:12px;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
					>{w.detail}</span
				>
				<span style="flex:none;width:96px;display:flex;justify-content:flex-end"
					><span
						style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;white-space:nowrap;background:{STATUS_BADGE_BG[
							w.status
						]};color:{STATUS_COLOR[w.status]}">{badge}</span
					></span
				>
				<div style="flex:none"><ActionCluster actions={rowActions(w)} /></div>
			</div>
		{/each}
	</div>
{:else if loadFailed}
	<div
		style="border:1px solid rgba(238,0,0,.3);border-radius:8px;background:var(--surf);padding:28px;text-align:center"
	>
		<div style="font-size:14px;font-weight:600">Couldn't load wanted items</div>
		<div style="font-size:13px;color:var(--sec);margin-top:4px">
			Sonarr or Radarr didn't answer. Check that the instances are up.
		</div>
		<button
			type="button"
			onclick={() => invalidateAll()}
			class="at-bdh"
			style="margin-top:14px;height:32px;padding:0 14px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer"
			>Retry</button
		>
	</div>
{:else}
	<div
		style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);padding:28px;text-align:center"
	>
		<div style="font-size:14px;font-weight:600">
			{tab === 'missing' ? 'Nothing missing' : 'Nothing below cutoff'}
		</div>
		<div style="font-size:13px;color:var(--sec);margin-top:4px">
			{hasAny
				? tab === 'missing'
					? 'Every monitored title has its files.'
					: 'Every file meets its quality-profile cutoff.'
				: 'Monitored items that need a download will show up here.'}
		</div>
	</div>
{/if}
