<script lang="ts">
	import { api } from '$lib/api/client';
	import type { SonarrHistoryResource } from '$lib/api/sonarr';
	import { store } from '$lib/stores/store.svelte';
	import { relativeAge } from '$lib/view/format';
	import { eventColor, eventLabel } from '$lib/view/status';

	const target = $derived(store.epModal);

	let historyLoading = $state(false);
	let history = $state<SonarrHistoryResource[]>([]);
	let loadedFor: number | null = null;

	$effect(() => {
		const t = target;
		if (!t || store.epModalTab !== 'history') return;
		if (loadedFor === t.row.id) return;
		loadedFor = t.row.id;
		historyLoading = true;
		api
			.getEpisodeHistory(t.row.id)
			.then((h) => (history = h))
			.catch(() => (history = []))
			.finally(() => (historyLoading = false));
	});

	function openSearch() {
		if (!target) return;
		const t = target;
		store.closeEp();
		store.openSearch({
			kind: 'episode',
			seriesId: t.seriesId,
			episodeId: t.row.id,
			label: `${t.seriesTitle} ${t.row.code}`
		});
	}
</script>

{#if target}
	{@const e = target.row}
	<div
		onclick={() => store.closeEp()}
		onkeydown={(ev) => ev.key === 'Escape' && store.closeEp()}
		role="presentation"
		style="position:fixed;inset:0;z-index:97;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(ev) => ev.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:820px;max-height:100%;display:flex;flex-direction:column;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--bd)"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="currentColor"
					style="flex:none;color:var(--text)"><path d="M6 3h12v18l-6-4-6 4z" /></svg
				>
				<h2
					style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;letter-spacing:-.01em"
				>
					{target.seriesTitle} - {e.code} - {e.title}
				</h2>
				<button
					type="button"
					onclick={() => store.closeEp()}
					aria-label="Close"
					class="at-bdh-t"
					style="display:grid;place-items:center;width:30px;height:30px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--sec);cursor:pointer"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="M6 6l12 12M18 6L6 18" /></svg
					>
				</button>
			</div>

			<div style="display:flex;gap:2px;padding:10px 18px 0;border-bottom:1px solid var(--bd)">
				{#each [['details', 'Details'], ['history', 'History']] as [k, label] (k)}
					<button
						type="button"
						onclick={() => (store.epModalTab = k as 'details' | 'history')}
						style="padding:6px 12px;border:none;border-radius:6px 6px 0 0;font-size:13px;font-weight:500;cursor:pointer;background:{store.epModalTab ===
						k
							? 'var(--hover)'
							: 'transparent'};color:{store.epModalTab === k ? 'var(--text)' : 'var(--muted)'}"
						>{label}</button
					>
				{/each}
			</div>

			<div style="flex:1;overflow:auto;padding:18px">
				{#if store.epModalTab === 'details'}
					<div
						style="display:grid;grid-template-columns:auto 1fr;gap:10px 18px;align-items:center;margin-bottom:16px"
					>
						<span style="font-size:12px;font-weight:500;color:var(--muted)">Airs</span>
						<span style="font-size:13px;color:var(--sec)"
							>{e.air} at {e.airTime} on {target.network}</span
						>
						<span style="font-size:12px;font-weight:500;color:var(--muted)">Quality Profile</span>
						<span
							><span
								style="font-size:12px;font-weight:500;padding:3px 8px;border-radius:6px;background:rgba(0,112,243,.12);color:var(--accent)"
								>{target.qualityProfile}</span
							></span
						>
						<span style="font-size:12px;font-weight:500;color:var(--muted)">Monitored</span>
						<span style="font-size:13px;color:var(--sec)">{e.monitored ? 'Yes' : 'No'}</span>
					</div>
					<p
						style="margin:0 0 18px;font-size:13px;color:var(--sec);line-height:1.6;max-width:80ch;text-wrap:pretty"
					>
						{e.overview || 'No overview available.'}
					</p>
					{#if e.hasFile}
						<div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden">
							<div
								style="display:grid;grid-template-columns:minmax(0,2fr) 80px 120px 118px;gap:12px;padding:9px 14px;border-bottom:1px solid var(--bd);font-size:11px;font-weight:500;color:var(--muted)"
							>
								<span>Path</span><span style="text-align:right">Size</span><span>Languages</span
								><span>Quality</span>
							</div>
							<div
								style="display:grid;grid-template-columns:minmax(0,2fr) 80px 120px 118px;gap:12px;padding:12px 14px;align-items:start"
							>
								<span
									style="min-width:0;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec);word-break:break-all"
									>{e.path || e.code}</span
								>
								<span
									style="text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
									>{e.size}</span
								>
								<span style="font-size:12px;color:var(--sec)">{e.audio || '—'}</span>
								<span
									style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;border:1px solid var(--bd);color:var(--text);justify-self:start"
									>{e.quality}</span
								>
							</div>
							<div
								style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:0 14px 14px"
							>
								{#if e.group}
									<span
										style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;background:rgba(0,112,243,.12);color:var(--accent)"
										>{e.group}</span
									>
								{/if}
								{#if e.subs}
									<span
										style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;background:rgba(0,112,243,.12);color:var(--accent)"
										>Subs: {e.subs}</span
									>
								{/if}
								{#if e.score}
									<span
										style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec);margin-left:4px"
										>{e.score}</span
									>
								{/if}
							</div>
						</div>
					{:else}
						<div
							style="padding:14px;border:1px dashed var(--bd);border-radius:8px;text-align:center;color:var(--muted);font-size:13px"
						>
							No file downloaded for this episode.
						</div>
					{/if}
				{:else if historyLoading}
					<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
						Loading…
					</div>
				{:else if history.length === 0}
					<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
						No history yet.
					</div>
				{:else}
					<div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden">
						{#each history as h (h.id)}
							<div
								style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--bd)"
							>
								<span
									style="flex:none;width:6px;height:6px;border-radius:50%;background:{eventColor(
										h.eventType
									)}"
								></span>
								<span
									style="flex:none;width:130px;font-size:12px;font-weight:500;color:{eventColor(
										h.eventType
									)}">{eventLabel(h.eventType)}</span
								>
								<span
									style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--sec)"
									>{h.quality?.quality?.name ?? h.sourceTitle ?? '—'}</span
								>
								<span
									style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
									>{relativeAge(h.date)} ago</span
								>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div
				style="display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid var(--bd)"
			>
				<button
					type="button"
					onclick={openSearch}
					class="at-bdh"
					style="height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer"
					>Interactive Search</button
				>
				<button
					type="button"
					onclick={() => store.closeEp()}
					class="at-op"
					style="height:34px;padding:0 13px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer"
					>Close</button
				>
			</div>
		</div>
	</div>
{/if}
