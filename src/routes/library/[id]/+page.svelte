<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import { store, EP_COLUMNS } from '$lib/stores/store.svelte';
	import { library } from '$lib/stores/library.svelte';
	import { agoLabel, formatBytes, ratingLabel, runtimeLabel } from '$lib/view/format';
	import {
		deriveMovieStatus,
		deriveSeriesStatus,
		eventColor,
		eventLabel,
		STATUS_BADGE_BG,
		STATUS_COLOR,
		STATUS_LABEL,
		type DerivedStatus
	} from '$lib/view/status';
	import { posterUrl, queueIndex } from '$lib/view/media';
	import { buildSeasons, type EpisodeRow } from '$lib/view/episodes';
	import { buildMediaInfoTarget } from '$lib/view/mediainfo';
	import Poster from '$lib/components/Poster.svelte';
	import ActionCluster from '$lib/components/ActionCluster.svelte';
	import type { EpisodeFileResource, SonarrQueueResource } from '$lib/api/sonarr';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const series = $derived(
		data.kind === 'series' ? library.series.find((s) => s.id === data.rawId) : undefined
	);
	const movie = $derived(
		data.kind === 'movie' ? library.movies.find((m) => m.id === data.rawId) : undefined
	);
	const found = $derived(!!series || !!movie);

	const qIndex = $derived(queueIndex(library.queue));
	const queuedEpisodeIds = $derived(
		new Set(
			library.queue
				.filter((q): q is SonarrQueueResource => 'episodeId' in q && q.episodeId != null)
				.map((q) => q.episodeId as number)
		)
	);

	const profileName = $derived(
		series
			? (library.profileNames.get(series.qualityProfileId) ?? '—')
			: movie
				? (library.profileNames.get(movie.qualityProfileId) ?? '—')
				: '—'
	);

	const status = $derived<DerivedStatus>(
		series
			? deriveSeriesStatus(series, qIndex.series.has(series.id))
			: movie
				? deriveMovieStatus(movie, qIndex.movie.has(movie.id))
				: 'unmonitored'
	);

	const title = $derived(series?.title ?? movie?.title ?? '');
	const overview = $derived(series?.overview ?? movie?.overview ?? '');
	const poster = $derived(posterUrl(series?.images ?? movie?.images));
	const source = $derived(series?.network ?? movie?.studio ?? '—');
	const genres = $derived((series?.genres ?? movie?.genres ?? []).join(' · '));
	const path = $derived(series?.path ?? movie?.path ?? '');
	const sizeBytes = $derived(
		series?.statistics?.sizeOnDisk ?? movie?.statistics?.sizeOnDisk ?? movie?.sizeOnDisk ?? 0
	);
	const rating = $derived(
		series ? series.ratings?.value : (movie?.ratings?.imdb?.value ?? movie?.ratings?.tmdb?.value)
	);
	const runtime = $derived(series?.runtime ?? movie?.runtime ?? 0);
	const idLabel = $derived(series ? `tvdb:${series.tvdbId}` : movie ? `tmdb:${movie.tmdbId}` : '');
	const metaSource = $derived(
		series ? 'Metadata provided by TheTVDB' : 'Metadata provided by TMDb'
	);
	const yearRange = $derived(
		series ? `${series.year}${series.ended ? '' : '–'}` : movie ? `${movie.year}` : ''
	);

	const links = $derived.by(() => {
		const out: { label: string; href: string }[] = [];
		if (series) {
			if (series.tvdbId)
				out.push({ label: 'TVDb', href: `https://thetvdb.com/?tab=series&id=${series.tvdbId}` });
			if (series.imdbId)
				out.push({ label: 'IMDb', href: `https://www.imdb.com/title/${series.imdbId}/` });
		} else if (movie) {
			if (movie.tmdbId)
				out.push({ label: 'TMDb', href: `https://www.themoviedb.org/movie/${movie.tmdbId}` });
			if (movie.imdbId)
				out.push({ label: 'IMDb', href: `https://www.imdb.com/title/${movie.imdbId}/` });
		}
		return out;
	});

	let detailTab = $state<'main' | 'history'>('main');

	// ---- seasons / episodes ----
	const seasons = $derived(
		data.kind === 'series' ? buildSeasons(data.episodes, data.episodeFiles, queuedEpisodeIds) : []
	);
	let openSeasons = $state<Record<number, boolean>>({});
	// `?ep=<episodeId>` (from a Calendar or History link) focuses one episode.
	const focusEp = $derived(Number(page.url.searchParams.get('ep')) || null);
	const focusSeasonN = $derived.by(() => {
		if (focusEp == null) return null;
		for (const s of seasons) if (s.episodes.some((e) => e.id === focusEp)) return s.n;
		return null;
	});
	// Default the newest season open (seasons are sorted ascending; Specials is 0).
	const defaultOpenSeason = $derived(seasons.length ? Math.max(...seasons.map((s) => s.n)) : null);
	function seasonOpen(n: number): boolean {
		if (n in openSeasons) return openSeasons[n];
		if (focusSeasonN != null) return n === focusSeasonN;
		return n === defaultOpenSeason;
	}

	// Scroll the focused episode into view once its season table has rendered.
	let scrolledFor: number | null = null;
	$effect(() => {
		const id = focusEp;
		if (id == null || !found || focusSeasonN == null || scrolledFor === id) return;
		scrolledFor = id;
		let tries = 0;
		const go = () => {
			const el = document.getElementById(`ep-${id}`);
			if (!el) {
				if (tries++ < 30) setTimeout(go, 70);
				return;
			}
			// instant scroll; smooth is silently dropped while the page is still loading
			el.scrollIntoView({ block: 'center' });
			// re-assert after a beat in case late images shift layout
			setTimeout(() => el.scrollIntoView({ block: 'center' }), 250);
		};
		setTimeout(go, 50);
	});
	function toggleSeason(n: number) {
		openSeasons = { ...openSeasons, [n]: !seasonOpen(n) };
	}
	function seasonMonitored(n: number): boolean {
		return series?.seasons.find((s) => s.seasonNumber === n)?.monitored ?? false;
	}

	const epCols = $derived(EP_COLUMNS.filter((c) => store.epShow[c.key]));

	// Relative column weights. They are turned into percentages of the visible set
	// (below) so the table is always exactly pane-width with `table-layout:fixed` and
	// never scrolls sideways: tight columns just wrap their text.
	const EP_COL_WEIGHT: Record<string, number> = {
		num: 7,
		title: 20,
		air: 12,
		codec: 6,
		audio: 12,
		subs: 9,
		size: 8,
		group: 11,
		score: 7,
		status: 12
	};
	// Trailing actions column weight (5 icon buttons).
	const EP_ACTIONS_WEIGHT = 14;

	const epColPct = $derived.by(() => {
		const total = epCols.reduce((n, c) => n + (EP_COL_WEIGHT[c.key] ?? 10), 0) + EP_ACTIONS_WEIGHT;
		const pct = (w: number) => `${((w / total) * 100).toFixed(3)}%`;
		const map: Record<string, string> = { actions: pct(EP_ACTIONS_WEIGHT) };
		for (const c of epCols) map[c.key] = pct(EP_COL_WEIGHT[c.key] ?? 10);
		return map;
	});

	function cellValue(row: EpisodeRow, key: string): string {
		switch (key) {
			case 'num':
				return row.code;
			case 'air':
				return row.air;
			case 'codec':
				return row.codec || '—';
			case 'audio':
				return row.audio || '—';
			case 'subs':
				return row.subs || '—';
			case 'size':
				return row.size;
			case 'group':
				return row.group || '—';
			case 'score':
				return row.score || '—';
			default:
				return '';
		}
	}

	// ---- history (fetched per-title in +page.ts) ----
	const history = $derived(data.history ?? []);

	// The episode list has no file details; join in the separately-fetched files
	// so row actions (delete, media info) can reach the raw `EpisodeFileResource`.
	const episodeFileByEpisodeId = $derived.by(() => {
		const map = new Map<number, EpisodeFileResource>();
		if (data.kind !== 'series') return map;
		const filesById = new Map(data.episodeFiles.map((f) => [f.id, f]));
		for (const e of data.episodes) {
			const file = e.episodeFileId ? filesById.get(e.episodeFileId) : undefined;
			if (file) map.set(e.id, file);
		}
		return map;
	});

	// ---- actions ----
	function notYet(label: string) {
		store.toast(`${label} isn't wired up yet`, 'var(--neutral)');
	}

	function openDialog(mode: 'edit' | 'delete') {
		const item = series ?? movie;
		if (!item) return;
		store.openDialog(mode, {
			kind: data.kind,
			id: item.id,
			title: item.title ?? '',
			year: item.year
		});
	}

	async function toggleMonitored() {
		try {
			if (series) {
				const saved = await api.updateSeries({ ...series, monitored: !series.monitored });
				const idx = library.series.findIndex((x) => x.id === saved.id);
				if (idx >= 0) library.series[idx] = saved;
				store.toast(saved.monitored ? 'Monitoring on' : 'Monitoring off', 'var(--neutral)');
			} else if (movie) {
				const saved = await api.updateMovie({ ...movie, monitored: !movie.monitored });
				const idx = library.movies.findIndex((x) => x.id === saved.id);
				if (idx >= 0) library.movies[idx] = saved;
				store.toast(saved.monitored ? 'Monitoring on' : 'Monitoring off', 'var(--neutral)');
			}
		} catch {
			store.toast('Could not update monitoring', 'var(--err)');
		}
	}

	function automaticSearch() {
		if (series) {
			store.toast(`Automatic search started · ${series.title}`, 'var(--accent)');
			api
				.sendCommand('series', { name: 'SeriesSearch', seriesId: series.id })
				.catch(() => store.toast('Search failed to start', 'var(--err)'));
		} else if (movie) {
			store.toast(`Automatic search started · ${movie.title}`, 'var(--accent)');
			api
				.sendCommand('movie', { name: 'MoviesSearch', movieIds: [movie.id] })
				.catch(() => store.toast('Search failed to start', 'var(--err)'));
		}
	}

	function interactiveSearch() {
		if (series)
			store.openSearch({
				kind: 'series',
				seriesId: series.id,
				label: `${series.title} (${series.year})`
			});
		else if (movie)
			store.openSearch({
				kind: 'movie',
				movieId: movie.id,
				label: `${movie.title} (${movie.year})`
			});
	}

	function refreshAndScan() {
		if (series)
			api.sendCommand('series', { name: 'RefreshSeries', seriesId: series.id }).catch(() => {});
		else if (movie)
			api.sendCommand('movie', { name: 'RefreshMovie', movieIds: [movie.id] }).catch(() => {});
		store.toast('Refreshed and rescanned', 'var(--ok)');
	}

	async function toggleSeasonMonitored(seasonNumber: number) {
		if (!series) return;
		const nextSeasons = series.seasons.map((s) =>
			s.seasonNumber === seasonNumber ? { ...s, monitored: !s.monitored } : s
		);
		try {
			const saved = await api.updateSeries({ ...series, seasons: nextSeasons });
			const idx = library.series.findIndex((x) => x.id === saved.id);
			if (idx >= 0) library.series[idx] = saved;
			store.toast(`Season ${seasonNumber} monitoring toggled`, 'var(--neutral)');
		} catch {
			store.toast('Could not update season', 'var(--err)');
		}
	}

	function searchSeason(seasonNumber: number) {
		if (!series) return;
		store.toast(`Searching season ${seasonNumber}`, 'var(--accent)');
		api
			.sendCommand('series', { name: 'SeasonSearch', seriesId: series.id, seasonNumber })
			.catch(() => {});
	}

	function toggleEpisodeMonitored(row: EpisodeRow) {
		api
			.setEpisodeMonitored([row.id], !row.monitored)
			.then(() => store.toast(`${row.code} monitoring toggled`, 'var(--neutral)'))
			.catch(() => store.toast('Could not update monitoring', 'var(--err)'));
	}

	function searchEpisode(row: EpisodeRow) {
		store.toast(`Searching ${row.code}`, 'var(--accent)');
		api.sendCommand('series', { name: 'EpisodeSearch', episodeIds: [row.id] }).catch(() => {});
	}

	function openEpisodeSearch(row: EpisodeRow) {
		if (!series) return;
		store.openSearch({
			kind: 'episode',
			seriesId: series.id,
			episodeId: row.id,
			label: `${series.title} ${row.code}`
		});
	}

	function openEpisodeModal(row: EpisodeRow) {
		if (!series) return;
		store.openEp({
			seriesId: series.id,
			seriesTitle: series.title ?? '',
			network: series.network ?? '—',
			qualityProfile: profileName,
			row,
			file: episodeFileByEpisodeId.get(row.id)
		});
	}

	function deleteEpisodeFile(row: EpisodeRow) {
		const file = episodeFileByEpisodeId.get(row.id);
		if (!file) {
			store.toast('No file to delete', 'var(--neutral)');
			return;
		}
		store.openConfirm({
			title: 'Delete file?',
			body: `Remove the downloaded file for ${row.code}. This cannot be undone.`,
			confirmLabel: 'Delete',
			danger: true,
			onConfirm: async () => {
				await api.deleteEpisodeFile(file.id);
				await library.refresh();
				store.toast(`Deleted file for ${row.code}`, 'var(--err)');
			}
		});
	}

	function episodeActions(row: EpisodeRow) {
		return [
			{
				icon: 'monitor',
				label: 'Monitored',
				on: row.monitored,
				onClick: () => toggleEpisodeMonitored(row)
			},
			{ icon: 'search', label: 'Automatic Search', onClick: () => searchEpisode(row) },
			{ icon: 'isearch', label: 'Interactive Search', onClick: () => openEpisodeSearch(row) },
			{ icon: 'import', label: 'Manual Import', onClick: () => notYet('Manual import') },
			{ icon: 'del', label: 'Delete file', tone: 'danger', onClick: () => deleteEpisodeFile(row) }
		];
	}

	function seasonActions(n: number) {
		return [
			{
				icon: 'monitor',
				label: 'Monitor season',
				on: seasonMonitored(n),
				onClick: () => toggleSeasonMonitored(n)
			},
			{ icon: 'search', label: 'Search season', onClick: () => searchSeason(n) }
		];
	}

	function showMovieMediaInfo() {
		if (!movie?.movieFile) return;
		store.openMediaInfo(
			buildMediaInfoTarget(movie.title ?? 'Movie', String(movie.year ?? ''), movie.movieFile)
		);
	}

	function deleteMovieFile() {
		if (!movie?.movieFile) return;
		const fileId = movie.movieFile.id;
		const title = movie.title ?? 'this movie';
		store.openConfirm({
			title: 'Delete file?',
			body: `Remove the downloaded file for ${title}. This cannot be undone.`,
			confirmLabel: 'Delete',
			danger: true,
			onConfirm: async () => {
				await api.deleteMovieFile(fileId);
				await library.refresh();
				store.toast(`Deleted file for ${title}`, 'var(--err)');
			}
		});
	}

	function previewRename() {
		const item = series ?? movie;
		if (!item) return;
		store.openRename({ kind: data.kind, id: item.id, title: item.title ?? '' });
	}

	const movieFileActions = [
		{
			icon: 'edit',
			label: 'Edit quality / language',
			onClick: () => notYet('Edit quality / language')
		},
		{ icon: 'info', label: 'Media info', onClick: showMovieMediaInfo },
		{ icon: 'del', label: 'Delete file', tone: 'danger', onClick: deleteMovieFile }
	];
</script>

<a
	href="/library"
	class="at-hov"
	style="display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;padding:4px 8px 4px 6px;border-radius:6px;color:var(--sec);font-size:13px;font-weight:500;text-decoration:none;transition:background 120ms ease-out"
>
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"><path d="M15 5l-7 7 7 7" /></svg
	>Library
</a>

{#if !found}
	<div style="padding:28px;font-size:13px;color:var(--muted)">
		{library.loading ? 'Loading…' : "Couldn't find that title in your library."}
	</div>
{:else}
	<div
		style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden;margin-bottom:16px"
	>
		<div
			style="position:relative;min-height:128px;border-bottom:1px solid var(--bd);background:var(--bg);padding:20px 24px;display:flex;align-items:flex-end"
		>
			<div
				style="max-width:100%;font-size:40px;font-weight:600;letter-spacing:-.04em;line-height:1.06;color:var(--bd);overflow:hidden;text-wrap:pretty"
			>
				{title}
			</div>
			<div
				style="position:absolute;top:14px;right:24px;padding:3px 0 3px 12px;background:var(--bg);font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);text-align:right;line-height:1.7"
			>
				<div>{idLabel}</div>
				<div>{metaSource}</div>
			</div>
		</div>
		<div style="display:flex;gap:24px;padding:20px 24px;align-items:flex-start">
			<div
				style="position:relative;flex:none;align-self:flex-start;width:132px;aspect-ratio:2/3;border:1px solid var(--bd);border-radius:8px;overflow:hidden"
			>
				<Poster src={poster} alt={title} fallbackText={title} />
			</div>
			<div style="flex:1;min-width:0">
				<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:10px">
					<h1 style="margin:0;font-size:32px;font-weight:600;letter-spacing:-.03em;line-height:1.1">
						{title}
					</h1>
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:16px;color:var(--muted)"
						>{series?.year ?? movie?.year ?? ''}</span
					>
				</div>
				<div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:8px">
					<span style="font-size:13px;color:var(--sec);white-space:nowrap"
						>{runtimeLabel(runtime)}</span
					>
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:13px;color:var(--sec);white-space:nowrap"
						>★ {ratingLabel(rating)}</span
					>
					<span style="font-size:13px;color:var(--sec);white-space:nowrap">{genres || '—'}</span>
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:13px;color:var(--sec);white-space:nowrap"
						>{yearRange}</span
					>
				</div>
				<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px">
					<span
						title={path}
						style="display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:5px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);font-size:12px;white-space:nowrap;color:var(--sec);font-family:'Geist Mono',ui-monospace,monospace"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"><path d="M3 6h6l2 2h10v11H3z" /></svg
						><span style="overflow:hidden;text-overflow:ellipsis">{path}</span>
					</span>
					<span
						style="display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);font-size:12px;white-space:nowrap;color:var(--sec);font-family:'Geist Mono',ui-monospace,monospace"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"><path d="M3 6h18v12H3z" /><path d="M7 12h4" /></svg
						>{formatBytes(sizeBytes)}
					</span>
					<span
						style="display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);font-size:12px;white-space:nowrap;color:var(--sec)"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"
							><path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /><path
								d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"
							/></svg
						>{profileName}
					</span>
					<span
						style="display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);font-size:12px;white-space:nowrap;color:var(--sec)"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill={(series?.monitored ?? movie?.monitored) ? 'currentColor' : 'none'}
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg
						>{(series?.monitored ?? movie?.monitored) ? 'Monitored' : 'Unmonitored'}
					</span>
					<span
						style="display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);font-size:12px;white-space:nowrap;color:var(--sec)"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"><path d="M4 5h16v11H4z" /><path d="M9 20h6" /></svg
						>{source}
					</span>
				</div>
				<p
					style="margin:14px 0 0;font-size:14px;color:var(--sec);line-height:1.6;max-width:86ch;text-wrap:pretty"
				>
					{overview || 'No overview available.'}
				</p>
				<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;align-items:center">
					<button
						type="button"
						onclick={toggleMonitored}
						class="at-bdh"
						style="display:flex;align-items:center;gap:8px;height:34px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
					>
						<span
							style="width:28px;height:16px;border-radius:9px;background:{(series?.monitored ??
							movie?.monitored)
								? 'var(--inv)'
								: 'var(--bd)'};position:relative;transition:background 150ms ease-out"
							><span
								style="position:absolute;top:2px;left:{(series?.monitored ?? movie?.monitored)
									? '14px'
									: '2px'};width:12px;height:12px;border-radius:50%;background:{(series?.monitored ??
								movie?.monitored)
									? 'var(--invfg)'
									: 'var(--muted)'};transition:left 150ms ease-out"
							></span></span
						>Monitored
					</button>
					<button
						type="button"
						onclick={automaticSearch}
						class="at-op"
						style="height:34px;padding:0 13px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out"
						>Automatic Search</button
					>
					<button
						type="button"
						onclick={interactiveSearch}
						class="at-bdh"
						style="height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
						>Interactive Search</button
					>
					<button
						type="button"
						onclick={refreshAndScan}
						class="at-bdh"
						style="height:34px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
						>Refresh &amp; Scan</button
					>
					<button
						type="button"
						onclick={() => openDialog('edit')}
						class="at-bdh"
						style="height:34px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
						>Edit</button
					>
					<button
						type="button"
						onclick={previewRename}
						class="at-bdh"
						style="height:34px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
						>Preview Rename</button
					>
					<button
						type="button"
						onclick={() => openDialog('delete')}
						class="at-bdh"
						style="height:34px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--err);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
						>Delete</button
					>
					{#if links.length}
						<span style="display:inline-flex;align-items:center;gap:14px;margin-left:2px">
							<span style="width:1px;height:20px;background:var(--bd)"></span>
							{#each links as l (l.label)}
								<a
									href={l.href}
									target="_blank"
									rel="noreferrer"
									style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--accent);cursor:pointer"
									>{l.label}</a
								>
							{/each}
						</span>
					{/if}
				</div>
			</div>
		</div>
		<div style="display:flex;gap:2px;padding:0 24px;border-top:1px solid var(--bd)">
			<button
				type="button"
				onclick={() => (detailTab = 'main')}
				style="padding:11px 12px;border:none;background:transparent;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid {detailTab ===
				'main'
					? 'var(--text)'
					: 'transparent'};color:{detailTab === 'main' ? 'var(--text)' : 'var(--muted)'}"
				>{data.kind === 'series' ? 'Seasons' : 'Files'}{#if data.kind === 'series'}<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-left:6px"
						>{seasons.length}</span
					>{/if}</button
			>
			<button
				type="button"
				onclick={() => (detailTab = 'history')}
				style="padding:11px 12px;border:none;background:transparent;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid {detailTab ===
				'history'
					? 'var(--text)'
					: 'transparent'};color:{detailTab === 'history' ? 'var(--text)' : 'var(--muted)'}"
				>History<span
					style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-left:6px"
					>{history.length}</span
				></button
			>
		</div>
	</div>

	{#if detailTab === 'main' && data.kind === 'series'}
		<div style="display:flex;flex-direction:column;gap:10px">
			{#each seasons as season (season.key)}
				{@const open = seasonOpen(season.n)}
				<section
					style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
				>
					<div
						role="button"
						tabindex="0"
						onclick={() => toggleSeason(season.n)}
						onkeydown={(e) => e.key === 'Enter' && toggleSeason(season.n)}
						class="at-hov-bg"
						style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;transition:background 120ms ease-out;background:{open
							? 'var(--bg)'
							: 'transparent'}"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							style="flex:none;color:var(--sec);transition:transform 130ms ease-out;transform:rotate({open
								? '90deg'
								: '0deg'})"><path d="M9 6l6 6-6 6" /></svg
						>
						<span style="font-size:14px;font-weight:600;letter-spacing:-.01em">{season.label}</span>
						<span
							style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
							>{season.have} / {season.count}</span
						>
						<div
							style="flex:1;max-width:150px;height:4px;border-radius:6px;background:var(--bd);overflow:hidden"
						>
							<div
								style="height:100%;border-radius:6px;background:{season.have === season.count
									? 'var(--ok)'
									: 'var(--warn)'};width:{season.count
									? Math.round((season.have / season.count) * 100)
									: 0}%"
							></div>
						</div>
						<span
							style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
							>{formatBytes(season.sizeBytes)}</span
						>
						<div
							style="flex:none;margin-left:auto"
							role="none"
							onclick={(e) => e.stopPropagation()}
						>
							<ActionCluster actions={seasonActions(season.n)} />
						</div>
					</div>
					{#if open}
						<div style="border-top:1px solid var(--bd);animation:fin 130ms ease-out">
							<table style="width:100%;border-collapse:collapse;table-layout:fixed">
								<thead>
									<tr>
										{#each epCols as c (c.key)}
											<th
												style="text-align:{c.key === 'size' || c.key === 'score'
													? 'right'
													: 'left'};padding:7px 8px;border-bottom:1px solid var(--bd);font-size:11px;font-weight:500;color:var(--muted);overflow-wrap:break-word;width:{epColPct[
													c.key
												]}">{c.label}</th
											>
										{/each}
										<th
											style="width:{epColPct.actions};padding:7px 8px;border-bottom:1px solid var(--bd);text-align:right"
										>
											<button
												type="button"
												onclick={() => (store.epColsOpen = true)}
												title="Table options"
												aria-label="Table options"
												style="display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;border:none;background:transparent;color:var(--muted);cursor:pointer"
											>
												<svg
													width="13"
													height="13"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="1.7"
													><path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" /><path
														d="M12 4v2M12 18v2M4 12h2M18 12h2M6.5 6.5 8 8M16 16l1.5 1.5M17.5 6.5 16 8M8 16l-1.5 1.5"
													/></svg
												>
											</button>
										</th>
									</tr>
								</thead>
								<tbody>
									{#each season.episodes as e (e.key)}
										<tr
											id="ep-{e.id}"
											class="at-hov-bg"
											style="transition:background 120ms ease-out;{e.id === focusEp
												? 'background:var(--sel);box-shadow:inset 2px 0 0 var(--accent)'
												: ''}"
										>
											{#each epCols as c (c.key)}
												<td
													style="padding:var(--rowpad);padding-inline:8px;border-bottom:1px solid var(--bd);vertical-align:top;text-align:{c.key ===
														'size' || c.key === 'score'
														? 'right'
														: 'left'};font-family:{c.key === 'num' ||
													c.key === 'air' ||
													c.key === 'codec' ||
													c.key === 'size' ||
													c.key === 'score'
														? "'Geist Mono',ui-monospace,monospace"
														: 'inherit'};font-size:12px;color:var(--sec)"
												>
													{#if c.key === 'title'}
														<div
															style="display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;min-width:0"
														>
															<span
																role="button"
																tabindex="0"
																title={e.title}
																onclick={() => openEpisodeModal(e)}
																onkeydown={(ev) => ev.key === 'Enter' && openEpisodeModal(e)}
																style="overflow-wrap:break-word;font-size:13px;font-weight:500;color:var(--text);cursor:pointer"
																>{e.title}</span
															>
															{#if e.badge}
																<span
																	title={e.badge}
																	style="flex:none;font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:rgba(0,112,243,.12);color:var(--accent);white-space:nowrap"
																	>{e.badge}</span
																>
															{/if}
														</div>
													{:else if c.key === 'status'}
														<span
															style="display:inline-block;font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;border:1px solid {e.status ===
															'unaired'
																? 'var(--bd)'
																: 'transparent'};background:{STATUS_BADGE_BG[
																e.status
															]};color:{STATUS_COLOR[e.status]};overflow-wrap:break-word"
															>{e.hasFile ? e.quality : STATUS_LABEL[e.status]}</span
														>
													{:else}
														{@const cv = cellValue(e, c.key)}
														<div style="overflow-wrap:break-word">{cv}</div>
													{/if}
												</td>
											{/each}
											<td
												style="width:{epColPct.actions};padding:var(--rowpad);padding-inline:6px;border-bottom:1px solid var(--bd);vertical-align:top;text-align:right"
											>
												<div style="display:flex;flex-wrap:wrap;justify-content:flex-end">
													<ActionCluster actions={episodeActions(e)} />
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>
			{/each}
			{#if seasons.length === 0}
				<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
					No episode data yet.
				</div>
			{/if}
		</div>
	{/if}

	{#if detailTab === 'main' && data.kind === 'movie' && movie}
		<div
			style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px;align-items:start"
		>
			<section
				style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
			>
				<div
					style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bd)"
				>
					<h2 style="margin:0;font-size:14px;font-weight:600">Movie file</h2>
					{#if movie.movieFile}
						<ActionCluster actions={movieFileActions} />
					{/if}
				</div>
				{#if movie.movieFile}
					{@const mf = movie.movieFile}
					<div
						style="padding:14px 16px;border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec);word-break:break-all"
					>
						{mf.path}
					</div>
					<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
						{#each [['Quality', mf.quality?.quality?.name ?? '—'], ['Size', formatBytes(mf.size)], ['Video', `${mf.mediaInfo?.videoCodec ?? '—'}${mf.mediaInfo?.videoBitDepth ? ' · ' + mf.mediaInfo.videoBitDepth + 'bit' : ''}`], ['Resolution', mf.mediaInfo?.resolution ?? '—'], ['Audio', `${mf.mediaInfo?.audioCodec ?? '—'}${mf.mediaInfo?.audioChannels ? ' ' + mf.mediaInfo.audioChannels + 'ch' : ''}`], ['Runtime', mf.mediaInfo?.runTime ?? '—'], ['Languages', mf.languages
									?.map((l) => l.name)
									.join(', ') || '—'], ['Custom format', mf.customFormatScore != null ? `${mf.customFormatScore > 0 ? '+' : ''}${mf.customFormatScore}` : '—']] as [k, v] (k)}
							<div
								style="padding:12px 16px;border-bottom:1px solid var(--bd);border-right:1px solid var(--bd)"
							>
								<div style="font-size:11px;color:var(--muted);font-weight:500">{k}</div>
								<div
									style="font-family:'Geist Mono',ui-monospace,monospace;font-size:13px;margin-top:3px"
								>
									{v}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">
						No file downloaded.
					</div>
				{/if}
				{#if movie.alternateTitles?.length}
					<div style="padding:13px 16px;border-bottom:1px solid var(--bd)">
						<h2 style="margin:0;font-size:14px;font-weight:600">Alternative titles</h2>
					</div>
					{#each movie.alternateTitles as a (a.id)}
						<div
							style="display:flex;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--bd);font-size:13px"
						>
							<span>{a.title}</span>
						</div>
					{/each}
				{/if}
			</section>
		</div>
	{/if}

	{#if detailTab === 'history'}
		<section
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
		>
			{#each history as h (h.id)}
				<div
					style="display:flex;align-items:center;gap:12px;padding:var(--rowpad);border-bottom:1px solid var(--bd)"
				>
					<span
						style="flex:none;width:6px;height:6px;border-radius:50%;background:{eventColor(
							h.eventType
						)}"
					></span>
					<span
						style="flex:none;width:120px;font-size:12px;font-weight:500;color:{eventColor(
							h.eventType
						)}">{eventLabel(h.eventType)}</span
					>
					<span
						style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
						>{h.sourceTitle}</span
					>
					<span style="flex:none;font-size:12px;color:var(--muted)"
						>{h.quality?.quality?.name ?? ''}</span
					>
					<span
						style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
						>{agoLabel(h.date)}</span
					>
				</div>
			{/each}
			{#if history.length === 0}
				<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">
					No history yet.
				</div>
			{/if}
		</section>
	{/if}
{/if}
