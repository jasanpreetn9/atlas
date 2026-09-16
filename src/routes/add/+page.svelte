<script lang="ts">
	import { api } from '$lib/api/client';
	import type { MonitorTypes, SeriesResource } from '$lib/api/sonarr';
	import type { MovieResource } from '$lib/api/radarr';
	import { store } from '$lib/stores/store.svelte';
	import { library } from '$lib/stores/library.svelte';
	import { posterUrl } from '$lib/view/media';
	import { ratingLabel } from '$lib/view/format';
	import Poster from '$lib/components/Poster.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let loading = $state(false);
	let error = $state(false);
	let searched = $state(false);
	let results = $state<LookupItem[]>([]);
	let added = $state<Record<string, boolean>>({});

	interface LookupItem {
		key: string;
		kind: 'series' | 'movie';
		tag: 'TV' | 'M';
		title: string;
		year: string;
		overview: string;
		rating: string;
		source: string;
		genres: string;
		idLabel: string;
		poster: string | null;
		inLibrary: boolean;
		resource: SeriesResource | MovieResource;
	}

	const seriesTvdbIds = $derived(new Set(library.series.map((s) => s.tvdbId)));
	const movieTmdbIds = $derived(new Set(library.movies.map((m) => m.tmdbId)));

	let seq = 0;

	$effect(() => {
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			loading = false;
			searched = false;
			return;
		}
		loading = true;
		const t = setTimeout(() => runSearch(q), 350);
		return () => clearTimeout(t);
	});

	async function runSearch(term: string) {
		const mine = ++seq;
		error = false;
		const [ser, mov] = await Promise.all([
			api.lookupSeries(term).catch(() => [] as SeriesResource[]),
			api.lookupMovie(term).catch(() => [] as MovieResource[])
		]);
		if (mine !== seq) return;

		const seriesItems: LookupItem[] = ser.map((s) => ({
			key: `tvdb:${s.tvdbId}`,
			kind: 'series',
			tag: 'TV',
			title: s.title ?? 'Untitled',
			year: s.year ? String(s.year) : '',
			overview: s.overview ?? '',
			rating: ratingLabel(s.ratings?.value),
			source: `Series · ${s.network ?? '—'}`,
			genres: s.genres.join(' · '),
			idLabel: `tvdb:${s.tvdbId}`,
			poster: posterUrl(s.images) ?? s.remotePoster ?? null,
			inLibrary: s.id > 0 || seriesTvdbIds.has(s.tvdbId),
			resource: s
		}));
		const movieItems: LookupItem[] = mov.map((m) => ({
			key: `tmdb:${m.tmdbId}`,
			kind: 'movie',
			tag: 'M',
			title: m.title ?? 'Untitled',
			year: m.year ? String(m.year) : '',
			overview: m.overview ?? '',
			rating: ratingLabel(m.ratings?.tmdb?.value ?? m.ratings?.imdb?.value),
			source: `Movie · ${m.studio ?? '—'}`,
			genres: m.genres.join(' · '),
			idLabel: `tmdb:${m.tmdbId}`,
			poster: posterUrl(m.images) ?? m.remotePoster ?? null,
			inLibrary: m.id > 0 || movieTmdbIds.has(m.tmdbId),
			resource: m
		}));

		const ql = term.toLowerCase();
		const rank = (it: LookupItem) =>
			it.title.toLowerCase() === ql ? 0 : it.title.toLowerCase().startsWith(ql) ? 1 : 2;
		results = [...seriesItems, ...movieItems]
			.sort((a, b) => rank(a) - rank(b) || Number(b.year) - Number(a.year))
			.slice(0, 24);
		loading = false;
		searched = true;
	}

	function isAdded(it: LookupItem) {
		return it.inLibrary || added[it.key];
	}

	// ---- add dialog ----
	interface DlgState {
		item: LookupItem;
	}
	let dlg = $state<DlgState | null>(null);
	let saving = $state(false);

	let fRoot = $state('');
	let fProfile = $state(0);
	let fMonitor = $state('all');
	let fType = $state<'standard' | 'daily' | 'anime'>('standard');
	let fMinAvail = $state<'announced' | 'inCinemas' | 'released'>('released');
	let fSeasonFolder = $state(true);
	let fSearch = $state(false);
	let fTags = $state<number[]>([]);

	const SERIES_MONITOR = [
		['all', 'All Episodes'],
		['future', 'Future Episodes'],
		['missing', 'Missing Episodes'],
		['existing', 'Existing Episodes'],
		['firstSeason', 'First Season'],
		['lastSeason', 'Latest Season'],
		['pilot', 'Pilot Only'],
		['recent', 'Recent Episodes'],
		['none', 'None']
	] as const;
	const MOVIE_MONITOR = [
		['movieOnly', 'Movie Only'],
		['movieAndCollection', 'Movie and Collection'],
		['none', 'None']
	] as const;

	function openDlg(it: LookupItem) {
		dlg = { item: it };
		const roots = it.kind === 'series' ? data.seriesRoots : data.movieRoots;
		const profiles = it.kind === 'series' ? data.seriesProfiles : data.movieProfiles;
		fRoot = roots[0]?.path ?? '';
		fProfile = profiles[0]?.id ?? 0;
		fMonitor = it.kind === 'series' ? 'all' : 'movieOnly';
		fType = 'standard';
		fMinAvail = 'released';
		fSeasonFolder = true;
		fSearch = false;
		fTags = [];
	}
	function toggleTag(id: number) {
		fTags = fTags.includes(id) ? fTags.filter((t) => t !== id) : [...fTags, id];
	}
	function closeDlg() {
		if (saving) return;
		dlg = null;
	}

	async function confirmAdd() {
		if (!dlg) return;
		const { item } = dlg;
		saving = true;
		try {
			if (item.kind === 'series') {
				const base = item.resource as SeriesResource;
				await api.addSeries({
					...base,
					qualityProfileId: fProfile,
					rootFolderPath: fRoot,
					monitored: true,
					seasonFolder: fSeasonFolder,
					seriesType: fType,
					tags: fTags,
					addOptions: {
						monitor: fMonitor as MonitorTypes,
						searchForMissingEpisodes: fSearch,
						searchForCutoffUnmetEpisodes: false,
						ignoreEpisodesWithFiles: false,
						ignoreEpisodesWithoutFiles: false
					}
				});
			} else {
				const base = item.resource as MovieResource;
				await api.addMovie({
					...base,
					qualityProfileId: fProfile,
					rootFolderPath: fRoot,
					monitored: true,
					minimumAvailability: fMinAvail,
					tags: fTags,
					addOptions: {
						monitor: fMonitor,
						searchForMovie: fSearch,
						addMethod: 'manual',
						ignoreEpisodesWithFiles: false,
						ignoreEpisodesWithoutFiles: false
					}
				});
			}
			added = { ...added, [item.key]: true };
			store.toast(`Added ${item.title}${fSearch ? ' · search started' : ''}`, 'var(--ok)');
			dlg = null;
			library.refresh();
		} catch (e) {
			store.toast(`Add failed · ${e instanceof Error ? e.message : item.title}`, 'var(--err)');
		} finally {
			saving = false;
		}
	}

	const dlgRoots = $derived(
		dlg ? (dlg.item.kind === 'series' ? data.seriesRoots : data.movieRoots) : []
	);
	const dlgProfiles = $derived(
		dlg ? (dlg.item.kind === 'series' ? data.seriesProfiles : data.movieProfiles) : []
	);
	const dlgTags = $derived(
		dlg ? (dlg.item.kind === 'series' ? data.seriesTags : data.movieTags) : []
	);
</script>

<h1 style="margin:0 0 3px;font-size:24px;font-weight:600;letter-spacing:-.02em">Add New</h1>
<p style="margin:0 0 20px;font-size:13px;color:var(--sec)">
	Search by title, TMDb/TVDb id, or IMDb id
</p>

<div style="position:relative;max-width:620px;margin-bottom:20px">
	<!-- svelte-ignore a11y_autofocus -->
	<input
		type="text"
		bind:value={query}
		autofocus
		placeholder="e.g. Dune, Severance, tmdb:693134, tvdb:371980"
		class="at-focus"
		style="width:100%;height:40px;padding:0 14px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:14px;outline:none;transition:border-color 120ms ease-out,box-shadow 120ms ease-out"
	/>
</div>

<div style="display:flex;flex-direction:column;gap:10px;max-width:900px">
	{#if loading}
		<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Searching...</div>
	{:else if query.trim().length < 2}
		<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">
			Type at least two characters to search Sonarr and Radarr.
		</div>
	{:else if error}
		<div style="padding:32px;text-align:center;color:var(--err);font-size:13px">
			Lookup failed. Check that the instances are reachable.
		</div>
	{:else if searched && results.length === 0}
		<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">
			No results for {query.trim()}.
		</div>
	{/if}

	{#each results as r (r.key)}
		{@const done = isAdded(r)}
		<div
			class="at-bdh"
			style="display:flex;gap:16px;padding:16px;border:1px solid var(--bd);border-radius:8px;background:var(--surf);transition:border-color 120ms ease-out"
		>
			<div
				style="position:relative;flex:none;width:76px;aspect-ratio:2/3;border:1px solid var(--bd);border-radius:6px;overflow:hidden"
			>
				<Poster src={r.poster} alt={r.title} fallbackText={r.title} />
			</div>
			<div style="flex:1;min-width:0">
				<div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap">
					<h3 style="margin:0;font-size:16px;font-weight:600;letter-spacing:-.02em">{r.title}</h3>
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
						>{r.year}</span
					>
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);border:1px solid var(--bd);border-radius:4px;padding:1px 5px"
						>{r.tag}</span
					>
				</div>
				<p
					style="margin:6px 0 0;font-size:13px;color:var(--sec);line-height:1.55;max-width:74ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"
				>
					{r.overview || 'No overview available.'}
				</p>
				<div
					style="display:flex;flex-wrap:wrap;gap:14px;margin-top:9px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
				>
					<span>★ {r.rating}</span><span>{r.source}</span>{#if r.genres}<span>{r.genres}</span>{/if}
				</div>
			</div>
			<div style="flex:none;display:flex;flex-direction:column;gap:8px;align-items:flex-end">
				<button
					type="button"
					onclick={() => openDlg(r)}
					disabled={done}
					class="at-op"
					style="height:32px;padding:0 14px;border-radius:6px;border:none;font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;background:{done
						? 'rgba(0,202,81,.14)'
						: 'var(--inv)'};color:{done ? 'var(--ok)' : 'var(--invfg)'}"
					>{done ? (r.inLibrary && !added[r.key] ? 'In library' : 'Added') : 'Add'}</button
				>
				<span
					style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
					>{r.idLabel}</span
				>
			</div>
		</div>
	{/each}
</div>

{#if dlg}
	{@const it = dlg.item}
	<div
		onclick={closeDlg}
		onkeydown={(e) => e.key === 'Escape' && closeDlg()}
		role="presentation"
		style="position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(e) => e.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:520px;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div style="padding:16px 18px;border-bottom:1px solid var(--bd)">
				<h2 style="margin:0;font-size:15px;font-weight:600;letter-spacing:-.01em">
					Add {it.title}
				</h2>
				<div style="font-size:12px;color:var(--sec);margin-top:2px">
					{it.kind === 'series' ? 'Series' : 'Movie'} · {it.year || 'year unknown'} · {it.idLabel}
				</div>
			</div>

			<div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">
				<div>
					<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
						Root Folder
					</div>
					{#if dlgRoots.length}
						<select
							bind:value={fRoot}
							style="width:100%;height:34px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:13px;font-family:'Geist Mono',ui-monospace,monospace;outline:none;cursor:pointer"
						>
							{#each dlgRoots as rf (rf.id)}
								<option value={rf.path}>{rf.path}</option>
							{/each}
						</select>
					{:else}
						<div style="font-size:12px;color:var(--err)">
							No root folders configured on {it.kind === 'series' ? 'Sonarr' : 'Radarr'}.
						</div>
					{/if}
				</div>

				<div>
					<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
						Quality Profile
					</div>
					<select
						bind:value={fProfile}
						style="width:100%;height:34px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:13px;outline:none;cursor:pointer"
					>
						{#each dlgProfiles as p (p.id)}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				</div>

				<div>
					<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
						Monitor
					</div>
					<select
						bind:value={fMonitor}
						style="width:100%;height:34px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:13px;outline:none;cursor:pointer"
					>
						{#each it.kind === 'series' ? SERIES_MONITOR : MOVIE_MONITOR as [v, label] (v)}
							<option value={v}>{label}</option>
						{/each}
					</select>
				</div>

				{#if it.kind === 'series'}
					<div>
						<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
							Series Type
						</div>
						<select
							bind:value={fType}
							style="width:100%;height:34px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:13px;outline:none;cursor:pointer"
						>
							<option value="standard">Standard</option>
							<option value="daily">Daily</option>
							<option value="anime">Anime</option>
						</select>
					</div>
					<div>
						<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
							Season Folder
						</div>
						<button
							type="button"
							onclick={() => (fSeasonFolder = !fSeasonFolder)}
							style="display:flex;align-items:center;gap:10px;padding:0;border:none;background:transparent;color:var(--text);font-size:13px;cursor:pointer"
						>
							<span
								style="width:32px;height:18px;border-radius:10px;position:relative;transition:background 150ms ease-out;background:{fSeasonFolder
									? 'var(--inv)'
									: 'var(--bd)'}"
							>
								<span
									style="position:absolute;top:2px;width:14px;height:14px;border-radius:50%;transition:left 150ms ease-out;left:{fSeasonFolder
										? '16px'
										: '2px'};background:{fSeasonFolder ? 'var(--invfg)' : 'var(--muted)'}"
								></span>
							</span>
							{fSeasonFolder ? 'Yes' : 'No'}
						</button>
					</div>
				{:else}
					<div>
						<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
							Minimum Availability
						</div>
						<select
							bind:value={fMinAvail}
							style="width:100%;height:34px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:13px;outline:none;cursor:pointer"
						>
							<option value="announced">Announced</option>
							<option value="inCinemas">In Cinemas</option>
							<option value="released">Released</option>
						</select>
					</div>
				{/if}

				{#if dlgTags.length}
					<div>
						<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
							Tags
						</div>
						<div style="display:flex;flex-wrap:wrap;gap:6px">
							{#each dlgTags as t (t.id)}
								{@const on = fTags.includes(t.id)}
								<button
									type="button"
									onclick={() => toggleTag(t.id)}
									class="at-op"
									style="height:24px;padding:0 10px;border-radius:12px;font-size:12px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;border:1px solid {on
										? 'transparent'
										: 'var(--bd)'};background:{on ? 'var(--inv)' : 'transparent'};color:{on
										? 'var(--invfg)'
										: 'var(--sec)'}">{t.label}</button
								>
							{/each}
						</div>
					</div>
				{/if}

				<div>
					<div style="font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px">
						Start search after adding
					</div>
					<button
						type="button"
						onclick={() => (fSearch = !fSearch)}
						style="display:flex;align-items:center;gap:10px;padding:0;border:none;background:transparent;color:var(--text);font-size:13px;cursor:pointer"
					>
						<span
							style="width:32px;height:18px;border-radius:10px;position:relative;transition:background 150ms ease-out;background:{fSearch
								? 'var(--inv)'
								: 'var(--bd)'}"
						>
							<span
								style="position:absolute;top:2px;width:14px;height:14px;border-radius:50%;transition:left 150ms ease-out;left:{fSearch
									? '16px'
									: '2px'};background:{fSearch ? 'var(--invfg)' : 'var(--muted)'}"
							></span>
						</span>
						{fSearch ? 'Yes, grab a release now' : 'No, add only'}
					</button>
				</div>
			</div>

			<div
				style="display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid var(--bd)"
			>
				<button
					type="button"
					onclick={closeDlg}
					disabled={saving}
					class="at-bdh"
					style="height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
					>Cancel</button
				>
				<button
					type="button"
					onclick={confirmAdd}
					disabled={saving || !fRoot || !fProfile}
					class="at-op"
					style="height:34px;padding:0 13px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;opacity:{saving ||
					!fRoot ||
					!fProfile
						? '.55'
						: '1'}"
					>{saving ? 'Adding...' : `Add ${it.kind === 'series' ? 'Series' : 'Movie'}`}</button
				>
			</div>
		</div>
	</div>
{/if}
