<script lang="ts">
	import '$lib/styles/atlas.css';
	import { onMount } from 'svelte';
	import { createHttpApi } from '$lib/api/client';
	import { store } from '$lib/stores/store.svelte';
	import { library } from '$lib/stores/library.svelte';
	import { rootFolderDisks, diskSummary } from '$lib/view/disk';
	import { deriveMovieStatus, deriveSeriesStatus } from '$lib/view/status';
	import { queueIndex } from '$lib/view/media';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Header from '$lib/components/Header.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import InteractiveSearch from '$lib/components/modals/InteractiveSearch.svelte';
	import EpisodeModal from '$lib/components/modals/EpisodeModal.svelte';
	import TableOptions from '$lib/components/modals/TableOptions.svelte';
	import Dialog from '$lib/components/modals/Dialog.svelte';
	import ConfirmModal from '$lib/components/modals/ConfirmModal.svelte';
	import MediaInfoModal from '$lib/components/modals/MediaInfoModal.svelte';
	import RenamePreviewModal from '$lib/components/modals/RenamePreviewModal.svelte';
	import EditFileModal from '$lib/components/modals/EditFileModal.svelte';
	import ManualImportModal from '$lib/components/modals/ManualImportModal.svelte';

	let { children }: { children: import('svelte').Snippet } = $props();

	let healthCount = $state(0);

	const ROWPAD: Record<string, string> = {
		Compact: '7px 12px',
		Balanced: '11px 14px',
		Roomy: '15px 16px'
	};

	// Apply UI prefs to the document + persist them.
	$effect(() => {
		const root = document.documentElement;
		root.dataset.theme = store.theme;
		root.style.setProperty('--rowpad', ROWPAD[store.density]);
		root.style.setProperty('--poster', `${store.posterSize}px`);
		root.style.setProperty('--sidebar', store.sidebarExpanded ? '216px' : '60px');
		try {
			localStorage.setItem('atlas:theme', store.theme);
			localStorage.setItem('atlas:density', store.density);
			localStorage.setItem('atlas:poster', String(store.posterSize));
			localStorage.setItem('atlas:libpagesize', String(store.libPageSize));
			localStorage.setItem('atlas:sidebar', store.sidebarExpanded ? '1' : '0');
			localStorage.setItem('atlas:epcols', JSON.stringify(store.epShow));
		} catch {
			/* private mode / disabled storage */
		}
	});

	onMount(() => {
		library.load();
		createHttpApi(fetch)
			.getHealth()
			.then((h) => (healthCount = h.filter((x) => x.type !== 'ok').length))
			.catch(() => {});
	});

	const disks = $derived(diskSummary(rootFolderDisks(library.rootFolders, library.diskSpace)));

	// "Missing" derived from the loaded library. This is the single definition used across
	// the sidebar badge, the Dashboard stat, and the Library "Missing" filter.
	const qIndex = $derived(queueIndex(library.queue));
	const wantedCount = $derived(
		library.series.filter((s) => deriveSeriesStatus(s, qIndex.series.has(s.id)) === 'missing')
			.length +
			library.movies.filter((m) => deriveMovieStatus(m, qIndex.movie.has(m.id)) === 'missing')
				.length
	);
</script>

<div
	style="display:flex;min-height:100vh;background:var(--bg);color:var(--text);font-family:Geist,Inter,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased"
>
	<Sidebar
		libraryCount={library.series.length + library.movies.length}
		activityCount={library.queue.length + store.extraQueue.length}
		{wantedCount}
		systemCount={healthCount}
		diskSummary={disks.summary}
		diskPct={disks.pct}
	/>

	<div style="flex:1;min-width:0;display:flex;flex-direction:column">
		<Header systemCount={healthCount} />
		<main style="flex:1;min-width:0;padding:24px 28px 72px">
			{@render children()}
		</main>
	</div>
</div>

<Toasts />
<InteractiveSearch />
<EpisodeModal />
<TableOptions />
<Dialog />
<ConfirmModal />
<MediaInfoModal />
<RenamePreviewModal />
<EditFileModal />
<ManualImportModal />
