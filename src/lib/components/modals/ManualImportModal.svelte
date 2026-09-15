<script lang="ts">
	// Scans a series' folder for files Sonarr hasn't imported yet, matched to
	// episodes by filename where possible, and imports the ones you pick as-is
	// (their auto-detected quality and language). Files Sonarr couldn't match
	// to an episode can't be submitted here - fix the filename or import them
	// from Sonarr directly.

	import { api } from '$lib/api/client';
	import type { ManualImportResource } from '$lib/api/sonarr';
	import { library } from '$lib/stores/library.svelte';
	import { store } from '$lib/stores/store.svelte';
	import { episodeCode, formatBytes } from '$lib/view/format';

	const target = $derived(store.manualImport);

	let loading = $state(false);
	let items = $state<ManualImportResource[]>([]);
	let selected = $state<Set<number>>(new Set());
	let importing = $state(false);
	let loadedFor: string | null = null;

	$effect(() => {
		const t = target;
		if (!t) {
			loadedFor = null;
			return;
		}
		const key = `${t.seriesId}:${t.folder}`;
		if (loadedFor === key) return;
		loadedFor = key;
		items = [];
		selected = new Set();
		loading = true;
		api
			.getManualImportCandidates(t.seriesId, t.folder)
			.then((xs) => {
				items = xs;
				selected = new Set(xs.filter((x) => (x.episodes?.length ?? 0) > 0).map((x) => x.id));
			})
			.catch(() => (items = []))
			.finally(() => (loading = false));
	});

	function label(it: ManualImportResource) {
		return it.relativePath || it.name || it.path || `File ${it.id}`;
	}

	function code(it: ManualImportResource) {
		const eps = it.episodes ?? [];
		return eps.map((e) => episodeCode(e.seasonNumber, e.episodeNumber)).join(', ');
	}

	function toggle(id: number) {
		const item = items.find((i) => i.id === id);
		if (!item || (item.episodes?.length ?? 0) === 0) return;
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function close() {
		if (importing) return;
		store.closeManualImport();
	}

	async function doImport() {
		const t = target;
		if (!t || selected.size === 0 || importing) return;
		importing = true;
		try {
			const files = items
				.filter((it) => selected.has(it.id) && it.path)
				.map((it) => ({
					path: it.path as string,
					folderName: it.folderName,
					seriesId: t.seriesId,
					episodeIds: (it.episodes ?? []).map((e) => e.id),
					quality: it.quality,
					languages: it.languages,
					releaseGroup: it.releaseGroup,
					downloadId: it.downloadId
				}));
			await api.importSeriesFiles(files);
			store.toast(
				`Importing ${files.length} file${files.length === 1 ? '' : 's'}…`,
				'var(--accent)'
			);
			store.closeManualImport();
			library.refresh();
		} catch {
			store.toast('Import failed to start', 'var(--err)');
		} finally {
			importing = false;
		}
	}
</script>

{#if target}
	<div
		onclick={close}
		onkeydown={(ev) => ev.key === 'Escape' && close()}
		role="presentation"
		style="position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(ev) => ev.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:760px;max-height:100%;display:flex;flex-direction:column;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--bd)"
			>
				<h2
					style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;letter-spacing:-.01em"
				>
					Manual Import - {target.seriesTitle}
				</h2>
				<button
					type="button"
					onclick={close}
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

			<div style="flex:1;overflow:auto;padding:18px">
				<p style="margin:0 0 14px;font-size:12px;color:var(--muted)">
					Quality and language are read from each filename. Files Sonarr couldn't match to an
					episode can't be imported here.
				</p>

				{#if loading}
					<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
						Scanning…
					</div>
				{:else if items.length === 0}
					<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
						Nothing new to import in {target.folder}.
					</div>
				{:else}
					<div style="display:flex;flex-direction:column;gap:8px">
						{#each items as it (it.id)}
							{@const importable = (it.episodes?.length ?? 0) > 0}
							{@const on = selected.has(it.id)}
							<button
								type="button"
								onclick={() => toggle(it.id)}
								disabled={!importable}
								style="display:flex;align-items:flex-start;gap:10px;text-align:left;border:1px solid {on
									? 'var(--accent)'
									: 'var(--bd)'};border-radius:8px;padding:10px 12px;background:{on
									? 'var(--sel)'
									: 'transparent'};cursor:{importable
									? 'pointer'
									: 'not-allowed'};opacity:{importable ? '1' : '.55'}"
							>
								<span
									style="flex:none;margin-top:2px;width:15px;height:15px;border-radius:4px;border:1px solid {on
										? 'var(--inv)'
										: 'var(--bd)'};background:{on
										? 'var(--inv)'
										: 'transparent'};color:var(--invfg);font-size:10px;text-align:center;line-height:13px"
									>{on ? '✓' : ''}</span
								>
								<span style="flex:1;min-width:0">
									<span
										style="display:block;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--text);word-break:break-all"
										>{label(it)}</span
									>
									<span
										style="display:flex;flex-wrap:wrap;gap:8px;margin-top:5px;font-size:11px;color:var(--sec)"
									>
										{#if code(it)}
											<span
												style="font-family:'Geist Mono',ui-monospace,monospace;font-weight:500;padding:1px 6px;border-radius:4px;background:rgba(0,112,243,.12);color:var(--accent)"
												>{code(it)}</span
											>
										{:else}
											<span style="color:var(--warn)">No episode match</span>
										{/if}
										<span>{it.quality?.quality?.name ?? '—'}</span>
										<span
											>{it.languages?.length
												? it.languages.map((l) => l.name).join(', ')
												: '—'}</span
										>
										<span style="margin-left:auto;font-family:'Geist Mono',ui-monospace,monospace"
											>{formatBytes(it.size)}</span
										>
									</span>
									{#if it.rejections.length}
										<span style="display:block;margin-top:4px;font-size:11px;color:var(--warn)">
											{it.rejections.map((r) => r.reason).join(' · ')}
										</span>
									{/if}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div
				style="display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid var(--bd)"
			>
				<span style="flex:1;font-size:12px;color:var(--muted)">{selected.size} selected</span>
				<button
					type="button"
					onclick={close}
					disabled={importing}
					style="height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer"
					>Cancel</button
				>
				<button
					type="button"
					onclick={doImport}
					disabled={loading || selected.size === 0 || importing}
					class="at-op"
					style="height:34px;padding:0 14px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;opacity:{loading ||
					selected.size === 0 ||
					importing
						? '.5'
						: '1'}"
					>{importing
						? 'Importing…'
						: `Import ${selected.size} file${selected.size === 1 ? '' : 's'}`}</button
				>
			</div>
		</div>
	</div>
{/if}
