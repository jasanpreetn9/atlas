<script lang="ts">
	// Shows which files the current naming format would rename, then renames
	// them on confirm. `GET /rename` returning nothing means every file already
	// matches the format.

	import { api } from '$lib/api/client';
	import { library } from '$lib/stores/library.svelte';
	import { store } from '$lib/stores/store.svelte';
	import { renameRows, type RenameRow } from '$lib/view/rename';

	const target = $derived(store.renameTarget);

	let loading = $state(false);
	let rows = $state<RenameRow[]>([]);
	let renaming = $state(false);
	let loadedFor: string | null = null;

	$effect(() => {
		const t = target;
		if (!t) {
			loadedFor = null;
			return;
		}
		const key = `${t.kind}:${t.id}`;
		if (loadedFor === key) return;
		loadedFor = key;
		rows = [];
		loading = true;
		api
			.getRenamePreview(t.kind, t.id)
			.then((items) => (rows = renameRows(items)))
			.catch(() => (rows = []))
			.finally(() => (loading = false));
	});

	function close() {
		if (renaming) return;
		store.closeRename();
	}

	async function doRename() {
		const t = target;
		if (!t || rows.length === 0 || renaming) return;
		renaming = true;
		try {
			await api.renameFiles(
				t.kind,
				t.id,
				rows.map((r) => r.fileId)
			);
			store.toast(`Renaming ${rows.length} file${rows.length === 1 ? '' : 's'}…`, 'var(--accent)');
			store.closeRename();
			library.refresh();
		} catch {
			store.toast('Rename failed to start', 'var(--err)');
		} finally {
			renaming = false;
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
			style="width:100%;max-width:700px;max-height:100%;display:flex;flex-direction:column;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--bd)"
			>
				<h2
					style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;letter-spacing:-.01em"
				>
					Preview Rename - {target.title}
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
				{#if loading}
					<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
						Loading…
					</div>
				{:else if rows.length === 0}
					<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
						Every file already matches the current naming format.
					</div>
				{:else}
					<div style="display:flex;flex-direction:column;gap:10px">
						{#each rows as r (r.key)}
							<div style="border:1px solid var(--bd);border-radius:8px;padding:10px 12px">
								{#if r.code}
									<span
										style="display:inline-block;margin-bottom:6px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;background:rgba(0,112,243,.12);color:var(--accent)"
										>{r.code}</span
									>
								{/if}
								<div
									style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted);word-break:break-all;text-decoration:line-through;text-decoration-color:var(--err)"
								>
									{r.from}
								</div>
								<div
									style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--text);word-break:break-all;margin-top:3px"
								>
									{r.to}
								</div>
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
					onclick={close}
					disabled={renaming}
					style="height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer"
					>Cancel</button
				>
				<button
					type="button"
					onclick={doRename}
					disabled={loading || rows.length === 0 || renaming}
					class="at-op"
					style="height:34px;padding:0 14px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;opacity:{loading ||
					rows.length === 0 ||
					renaming
						? '.5'
						: '1'}"
					>{renaming
						? 'Renaming…'
						: `Rename ${rows.length} file${rows.length === 1 ? '' : 's'}`}</button
				>
			</div>
		</div>
	</div>
{/if}
