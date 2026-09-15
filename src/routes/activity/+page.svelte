<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import type { QueueItem, WantedKind } from '$lib/api/client';
	import { store } from '$lib/stores/store.svelte';
	import { library } from '$lib/stores/library.svelte';
	import {
		blocklistRows,
		historyRows,
		matchesHistFilter,
		queueRow,
		HIST_FILTERS,
		type HistFilter
	} from '$lib/view/activity';
	import ActionCluster from '$lib/components/ActionCluster.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'queue' | 'history' | 'blocklist';
	const fromUrl = page.url.searchParams.get('tab');
	let tab = $state<Tab>(fromUrl === 'history' || fromUrl === 'blocklist' ? fromUrl : 'queue');
	let histFilter = $state<HistFilter>('All');
	let now = $state(new Date());

	// Live queue poll (30s), same pattern as the Dashboard.
	let liveQueue = $state<QueueItem[] | null>(null);
	const queue = $derived([...store.extraQueue, ...(liveQueue ?? library.queue)]);

	async function refreshQueue() {
		try {
			liveQueue = await api.getQueue();
		} catch {
			/* keep last snapshot */
		}
	}

	onMount(() => {
		const poll = setInterval(refreshQueue, 30_000);
		const tick = setInterval(() => (now = new Date()), 30_000);
		return () => {
			clearInterval(poll);
			clearInterval(tick);
		};
	});

	const seriesById = $derived(new Map(library.series.map((s) => [s.id, s])));
	const moviesById = $derived(new Map(library.movies.map((m) => [m.id, m])));

	const qRows = $derived(queue.map(queueRow));
	const hRowsAll = $derived(historyRows(data.history, seriesById, moviesById, now));
	const hRows = $derived(hRowsAll.filter((r) => matchesHistFilter(r.eventType, histFilter)));
	const bRows = $derived(blocklistRows(data.blocklist, seriesById, moviesById, now));

	const tabs = $derived([
		{ key: 'queue' as const, label: 'Queue', count: qRows.length },
		{ key: 'history' as const, label: 'History', count: hRowsAll.length },
		{ key: 'blocklist' as const, label: 'Blocklist', count: bRows.length }
	]);

	const loadFailed = (key: string) => data.loadErrors.includes(key);

	function notYet(label: string) {
		store.toast(`${label} isn't wired up yet`, 'var(--neutral)');
	}

	/** Queue and blocklist rows only carry `tag`; series is always Sonarr, movie always Radarr. */
	function appOf(tag: 'TV' | 'M'): WantedKind {
		return tag === 'TV' ? 'series' : 'movie';
	}

	// ---- queue ----
	let qSel = $state<Record<string, boolean>>({});
	const qSelIds = $derived(Object.keys(qSel).filter((k) => qSel[k]));

	function toggleQueueSel(key: string) {
		qSel = { ...qSel, [key]: !qSel[key] };
	}

	async function removeQueueItem(q: (typeof qRows)[number], blocklist: boolean) {
		try {
			await api.removeFromQueue(appOf(q.tag), Number(q.key), { blocklist });
			store.toast(
				blocklist ? `Removed & blocklisted · ${q.title}` : `Removed from queue · ${q.title}`,
				blocklist ? 'var(--err)' : 'var(--neutral)'
			);
			await refreshQueue();
		} catch {
			store.toast('Could not remove from queue', 'var(--err)');
		}
	}

	function confirmRemoveAndBlocklist(q: (typeof qRows)[number]) {
		store.openConfirm({
			title: 'Remove & blocklist?',
			body: `Remove "${q.title}" from the queue and blocklist it, so it won't be grabbed again.`,
			confirmLabel: 'Remove',
			danger: true,
			onConfirm: () => removeQueueItem(q, true)
		});
	}

	function removeSelectedQueue() {
		const rows = qSelIds.map((k) => qRows.find((r) => r.key === k)).filter((r) => !!r);
		if (rows.length === 0) {
			store.toast('Nothing selected', 'var(--neutral)');
			return;
		}
		store.openConfirm({
			title: `Remove ${rows.length} item${rows.length === 1 ? '' : 's'}?`,
			body: 'Remove the selected downloads from the queue.',
			confirmLabel: 'Remove',
			danger: true,
			onConfirm: async () => {
				const seriesIds = rows.filter((r) => r.tag === 'TV').map((r) => Number(r.key));
				const movieIds = rows.filter((r) => r.tag === 'M').map((r) => Number(r.key));
				await Promise.all([
					seriesIds.length
						? api.bulkRemoveFromQueue('series', seriesIds, { blocklist: false })
						: null,
					movieIds.length ? api.bulkRemoveFromQueue('movie', movieIds, { blocklist: false }) : null
				]);
				qSel = {};
				store.toast(`Removed ${rows.length} item${rows.length === 1 ? '' : 's'}`, 'var(--neutral)');
				await refreshQueue();
			}
		});
	}

	function queueActions(q: (typeof qRows)[number]) {
		return [
			{ icon: 'pause', label: 'Pause', onClick: () => notYet('Pause') },
			{ icon: 'import', label: 'Manual Import', onClick: () => notYet('Manual import') },
			{
				icon: 'block',
				label: 'Remove & blocklist',
				tone: 'danger',
				onClick: () => confirmRemoveAndBlocklist(q)
			},
			{
				icon: 'del',
				label: 'Remove from queue',
				tone: 'danger',
				onClick: () => removeQueueItem(q, false)
			}
		];
	}

	// ---- history ----
	function markFailed(r: (typeof hRows)[number]) {
		store.openConfirm({
			title: 'Mark as failed?',
			body: `Mark "${r.title}" as a failed download. Sonarr/Radarr will blocklist it and search again.`,
			confirmLabel: 'Mark failed',
			danger: true,
			onConfirm: async () => {
				await api.markHistoryFailed(r.kind, r.id);
				store.toast(`Marked as failed · ${r.title}`, 'var(--err)');
				await invalidateAll();
			}
		});
	}

	function historyActions(r: (typeof hRows)[number]) {
		return [
			{
				icon: 'info',
				label: 'Details',
				onClick: () =>
					store.toast(`${r.quality} · score ${r.score} · ${r.indexer}`, 'var(--accent)')
			},
			{
				icon: 'block',
				label: 'Mark as Failed',
				tone: r.eventType === 'downloadFailed' ? 'danger' : undefined,
				onClick: () => markFailed(r)
			}
		];
	}

	// ---- blocklist ----
	async function removeBlocklistEntry(b: (typeof bRows)[number]) {
		try {
			await api.removeFromBlocklist(appOf(b.tag), Number(b.key));
			store.toast(`Removed from blocklist · ${b.release}`, 'var(--neutral)');
			await invalidateAll();
		} catch {
			store.toast('Could not remove from blocklist', 'var(--err)');
		}
	}

	function clearBlocklist() {
		if (bRows.length === 0) return;
		store.openConfirm({
			title: 'Clear the blocklist?',
			body: `Remove all ${bRows.length} blocklisted release${bRows.length === 1 ? '' : 's'}, so they can be grabbed again.`,
			confirmLabel: 'Clear',
			danger: true,
			onConfirm: async () => {
				const seriesIds = bRows.filter((b) => b.tag === 'TV').map((b) => Number(b.key));
				const movieIds = bRows.filter((b) => b.tag === 'M').map((b) => Number(b.key));
				await Promise.all([
					seriesIds.length ? api.bulkRemoveFromBlocklist('series', seriesIds) : null,
					movieIds.length ? api.bulkRemoveFromBlocklist('movie', movieIds) : null
				]);
				store.toast('Blocklist cleared', 'var(--neutral)');
				await invalidateAll();
			}
		});
	}

	function blocklistActions(b: (typeof bRows)[number]) {
		return [
			{
				icon: 'del',
				label: 'Remove from blocklist',
				tone: 'danger',
				onClick: () => removeBlocklistEntry(b)
			}
		];
	}
</script>

<h1 style="margin:0 0 14px;font-size:24px;font-weight:600;letter-spacing:-.02em">Activity</h1>

<div style="display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:16px">
	{#each tabs as t (t.key)}
		<button
			type="button"
			onclick={() => (tab = t.key)}
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

{#if tab === 'queue'}
	<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
		<button
			type="button"
			onclick={removeSelectedQueue}
			disabled={qSelIds.length === 0}
			class="at-bdh"
			style="height:30px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out;opacity:{qSelIds.length ===
			0
				? '.5'
				: '1'}">Remove Selected{qSelIds.length ? ` (${qSelIds.length})` : ''}</button
		>
		<button
			type="button"
			onclick={() => notYet('Pause all')}
			class="at-bdh"
			style="height:30px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
			>Pause all</button
		>
		<div style="flex:1"></div>
		<span style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
			>auto-refresh 30s</span
		>
	</div>

	{#if qRows.length > 0}
		<div
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
		>
			{#each qRows as q (q.key)}
				<div
					class="at-hov-bg"
					style="padding:14px 16px;border-bottom:1px solid var(--bd);transition:background 120ms ease-out"
				>
					<div style="display:flex;align-items:center;gap:12px">
						<button
							type="button"
							onclick={() => toggleQueueSel(q.key)}
							aria-label={qSel[q.key] ? 'Deselect' : 'Select'}
							style="flex:none;display:grid;place-items:center;width:15px;height:15px;padding:0;border-radius:4px;border:1px solid {qSel[
								q.key
							]
								? 'var(--inv)'
								: 'var(--bd)'};background:{qSel[q.key]
								? 'var(--inv)'
								: 'transparent'};color:var(--invfg);font-size:10px;cursor:pointer"
							>{qSel[q.key] ? '✓' : ''}</button
						>
						<span
							style="flex:none;width:22px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;padding:2px 0;border-radius:4px;border:1px solid var(--bd);color:var(--muted)"
							>{q.tag}</span
						>
						<span
							style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500"
							>{q.title}</span
						>
						<span style="flex:none;font-size:12px;color:var(--sec)">{q.quality}</span>
						<span
							style="flex:none;font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;background:{q.badgeBg};color:{q.badgeFg}"
							>{q.status}</span
						>
						<div style="flex:none"><ActionCluster actions={queueActions(q)} /></div>
					</div>
					<div
						style="height:4px;border-radius:6px;background:var(--bd);margin-top:10px;overflow:hidden"
					>
						<div
							style="height:100%;border-radius:6px;transition:width 150ms ease-out;background:{q.fill};width:{q.pct}"
						></div>
					</div>
					<div
						style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
					>
						<span>{q.pct}</span><span>{q.size}</span><span>{q.eta}</span><span>{q.client}</span
						><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46ch"
							>{q.release}</span
						>
					</div>
				</div>
			{/each}
		</div>
	{:else if loadFailed('history')}
		<div style="padding:24px;font-size:13px;color:var(--muted);text-align:center">
			Couldn't reach Sonarr / Radarr.
		</div>
	{:else}
		<div style="padding:24px;font-size:13px;color:var(--muted);text-align:center">
			The download queue is empty.
		</div>
	{/if}
{/if}

{#if tab === 'history'}
	<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
		{#each HIST_FILTERS as f (f)}
			{@const on = histFilter === f}
			<button
				type="button"
				onclick={() => (histFilter = f)}
				style="height:26px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid {on
					? 'var(--bdh)'
					: 'var(--bd)'};background:{on ? 'var(--hover)' : 'transparent'};color:{on
					? 'var(--text)'
					: 'var(--sec)'}">{f}</button
			>
		{/each}
	</div>

	{#if hRows.length > 0}
		<div
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
		>
			{#each hRows as h (h.key)}
				<div
					class="at-hov-bg"
					style="display:flex;align-items:center;gap:12px;padding:var(--rowpad);border-bottom:1px solid var(--bd);transition:background 120ms ease-out"
				>
					<span
						style="flex:none;width:20px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;border:1px solid var(--bd);border-radius:4px;color:var(--muted)"
						>{h.tag}</span
					>
					<span
						style="flex:none;width:118px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:{h.color}"
						><span style="width:6px;height:6px;border-radius:50%;background:{h.color}"
						></span>{h.event}</span
					>
					<a
						href={h.href || undefined}
						style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;text-decoration:none;color:inherit"
						>{h.title}</a
					>
					<span
						style="flex:none;width:112px;font-size:12px;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
						>{h.quality}</span
					>
					<span
						style="flex:none;width:90px;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
						>{h.indexer}</span
					>
					<span
						style="flex:none;width:52px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:{h.scoreNum <
						0
							? 'var(--err)'
							: 'var(--muted)'}">{h.score}</span
					>
					<span
						style="flex:none;width:64px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
						>{h.ago}</span
					>
					<div style="flex:none"><ActionCluster actions={historyActions(h)} /></div>
				</div>
			{/each}
		</div>
	{:else if loadFailed('history')}
		<div style="padding:24px;font-size:13px;color:var(--muted);text-align:center">
			Couldn't load history.
		</div>
	{:else}
		<div style="padding:24px;font-size:13px;color:var(--muted);text-align:center">
			{histFilter === 'All' ? 'No history yet.' : `No "${histFilter}" events.`}
		</div>
	{/if}
{/if}

{#if tab === 'blocklist'}
	<div style="display:flex;gap:8px;margin-bottom:12px">
		<button
			type="button"
			onclick={clearBlocklist}
			disabled={bRows.length === 0}
			class="at-bdh"
			style="height:30px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--err);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out;opacity:{bRows.length ===
			0
				? '.5'
				: '1'}">Clear all</button
		>
	</div>

	{#if bRows.length > 0}
		<div
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
		>
			{#each bRows as b (b.key)}
				<div
					style="display:flex;align-items:center;gap:12px;padding:var(--rowpad);border-bottom:1px solid var(--bd)"
				>
					<span
						style="flex:none;width:20px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;border:1px solid var(--bd);border-radius:4px;color:var(--muted)"
						>{b.tag}</span
					>
					<a
						href={b.href || undefined}
						style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec);text-decoration:none"
						>{b.release}</a
					>
					<span style="flex:none;font-size:12px;color:var(--muted)">{b.indexer}</span>
					<span
						style="flex:none;font-size:12px;color:var(--err);max-width:30ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
						>{b.reason}</span
					>
					<span
						style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
						>{b.ago}</span
					>
					<div style="flex:none"><ActionCluster actions={blocklistActions(b)} /></div>
				</div>
			{/each}
		</div>
	{:else if loadFailed('blocklist')}
		<div style="padding:24px;font-size:13px;color:var(--muted);text-align:center">
			Couldn't load the blocklist.
		</div>
	{:else}
		<div style="padding:24px;font-size:13px;color:var(--muted);text-align:center">
			Nothing blocklisted.
		</div>
	{/if}
{/if}
