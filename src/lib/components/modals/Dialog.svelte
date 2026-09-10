<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import type { QualityProfileResource, RootFolderResource } from '$lib/api/common';
	import { store } from '$lib/stores/store.svelte';
	import { library } from '$lib/stores/library.svelte';

	const kind = $derived(store.dlg);
	const target = $derived(store.dlgTarget);
	const open = $derived((kind === 'edit' || kind === 'delete') && !!target?.id);

	let saving = $state(false);
	let profiles = $state<QualityProfileResource[]>([]);
	let roots = $state<RootFolderResource[]>([]);

	// edit fields
	let fProfile = $state(0);
	let fRoot = $state('');
	let fMonitored = $state(true);
	// delete fields
	let fDeleteFiles = $state(false);
	let fExclude = $state(false);

	let loadedFor: string | null = null;
	$effect(() => {
		const t = target;
		const k = kind;
		if (!t?.id || (k !== 'edit' && k !== 'delete')) {
			loadedFor = null;
			return;
		}
		const sig = `${k}:${t.kind}:${t.id}`;
		if (sig === loadedFor) return;
		loadedFor = sig;
		saving = false;
		fDeleteFiles = false;
		fExclude = false;

		if (k === 'edit') {
			const res =
				t.kind === 'series'
					? library.series.find((x) => x.id === t.id)
					: library.movies.find((x) => x.id === t.id);
			fProfile = res?.qualityProfileId ?? 0;
			fRoot = res?.rootFolderPath ?? res?.path ?? '';
			fMonitored = res?.monitored ?? true;
			api
				.getQualityProfiles(t.kind)
				.then((p) => (profiles = p))
				.catch(() => (profiles = []));
			api
				.getRootFolders(t.kind)
				.then((rf) => (roots = rf))
				.catch(() => (roots = []));
		}
	});

	function close() {
		if (!saving) store.closeDialog();
	}

	async function save() {
		const t = target;
		if (!t?.id) return;
		saving = true;
		try {
			if (t.kind === 'series') {
				const res = library.series.find((x) => x.id === t.id);
				if (!res) throw new Error('not loaded');
				const saved = await api.updateSeries({
					...res,
					qualityProfileId: fProfile,
					rootFolderPath: fRoot,
					monitored: fMonitored
				});
				const i = library.series.findIndex((x) => x.id === saved.id);
				if (i >= 0) library.series[i] = saved;
			} else {
				const res = library.movies.find((x) => x.id === t.id);
				if (!res) throw new Error('not loaded');
				const saved = await api.updateMovie({
					...res,
					qualityProfileId: fProfile,
					rootFolderPath: fRoot,
					monitored: fMonitored
				});
				const i = library.movies.findIndex((x) => x.id === saved.id);
				if (i >= 0) library.movies[i] = saved;
			}
			store.toast(`Saved · ${t.title}`, 'var(--ok)');
			store.closeDialog();
		} catch {
			store.toast(`Couldn't save · ${t.title}`, 'var(--err)');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		const t = target;
		if (!t?.id) return;
		saving = true;
		const opts = { deleteFiles: fDeleteFiles, addImportExclusion: fExclude };
		try {
			if (t.kind === 'series') {
				await api.deleteSeries(t.id, opts);
				library.series = library.series.filter((x) => x.id !== t.id);
			} else {
				await api.deleteMovie(t.id, opts);
				library.movies = library.movies.filter((x) => x.id !== t.id);
			}
			store.toast(`Deleted · ${t.title}`, 'var(--err)');
			store.closeDialog();
			goto('/library');
		} catch {
			store.toast(`Couldn't delete · ${t.title}`, 'var(--err)');
		} finally {
			saving = false;
		}
	}

	const selectStyle =
		'width:100%;height:34px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:13px;outline:none;cursor:pointer';
	const labelStyle = 'font-size:12px;font-weight:500;color:var(--sec);margin-bottom:6px';
</script>

{#if open && target}
	{@const t = target}
	<div
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="presentation"
		style="position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(e) => e.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:520px;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div style="padding:16px 18px;border-bottom:1px solid var(--bd)">
				<h2 style="margin:0;font-size:15px;font-weight:600;letter-spacing:-.01em">
					{kind === 'delete' ? `Delete ${t.title}?` : `Edit ${t.title}`}
				</h2>
				<div style="font-size:12px;color:var(--sec);margin-top:2px">
					{kind === 'delete'
						? 'This removes the title from your library.'
						: `${t.kind === 'series' ? 'Series' : 'Movie'}${t.year ? ` · ${t.year}` : ''} · changes apply immediately`}
				</div>
			</div>

			<div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">
				{#if kind === 'edit'}
					<div>
						<div style={labelStyle}>Quality Profile</div>
						<select bind:value={fProfile} style={selectStyle}>
							{#each profiles as p (p.id)}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<div style={labelStyle}>Root Folder</div>
						{#if roots.length}
							<select
								bind:value={fRoot}
								style="{selectStyle};font-family:'Geist Mono',ui-monospace,monospace"
							>
								{#each roots as rf (rf.id)}
									<option value={rf.path}>{rf.path}</option>
								{/each}
								{#if fRoot && !roots.some((rf) => rf.path === fRoot)}
									<option value={fRoot}>{fRoot} (current)</option>
								{/if}
							</select>
						{:else}
							<div
								style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
							>
								{fRoot || '—'}
							</div>
						{/if}
					</div>
					<div>
						<div style={labelStyle}>Monitored</div>
						<button
							type="button"
							onclick={() => (fMonitored = !fMonitored)}
							style="display:flex;align-items:center;gap:10px;padding:0;border:none;background:transparent;color:var(--text);font-size:13px;cursor:pointer"
						>
							<span
								style="width:32px;height:18px;border-radius:10px;position:relative;transition:background 150ms ease-out;background:{fMonitored
									? 'var(--inv)'
									: 'var(--bd)'}"
							>
								<span
									style="position:absolute;top:2px;width:14px;height:14px;border-radius:50%;transition:left 150ms ease-out;left:{fMonitored
										? '16px'
										: '2px'};background:{fMonitored ? 'var(--invfg)' : 'var(--muted)'}"
								></span>
							</span>
							{fMonitored ? 'Yes' : 'No'}
						</button>
					</div>
				{:else}
					<p style="margin:0;font-size:13px;color:var(--sec);line-height:1.55">
						{t.kind === 'series' ? 'The series' : 'The movie'} and its metadata will be removed. By default
						the downloaded files are kept on disk.
					</p>
					<div>
						<div style={labelStyle}>Also delete files from disk</div>
						<button
							type="button"
							onclick={() => (fDeleteFiles = !fDeleteFiles)}
							style="display:flex;align-items:center;gap:10px;padding:0;border:none;background:transparent;color:var(--text);font-size:13px;cursor:pointer"
						>
							<span
								style="width:32px;height:18px;border-radius:10px;position:relative;transition:background 150ms ease-out;background:{fDeleteFiles
									? 'var(--err)'
									: 'var(--bd)'}"
							>
								<span
									style="position:absolute;top:2px;width:14px;height:14px;border-radius:50%;transition:left 150ms ease-out;left:{fDeleteFiles
										? '16px'
										: '2px'};background:{fDeleteFiles ? '#fff' : 'var(--muted)'}"
								></span>
							</span>
							{fDeleteFiles ? 'Yes, delete files too' : 'No, keep files'}
						</button>
					</div>
					<div>
						<div style={labelStyle}>Add import list exclusion</div>
						<button
							type="button"
							onclick={() => (fExclude = !fExclude)}
							style="display:flex;align-items:center;gap:10px;padding:0;border:none;background:transparent;color:var(--text);font-size:13px;cursor:pointer"
						>
							<span
								style="width:32px;height:18px;border-radius:10px;position:relative;transition:background 150ms ease-out;background:{fExclude
									? 'var(--inv)'
									: 'var(--bd)'}"
							>
								<span
									style="position:absolute;top:2px;width:14px;height:14px;border-radius:50%;transition:left 150ms ease-out;left:{fExclude
										? '16px'
										: '2px'};background:{fExclude ? 'var(--invfg)' : 'var(--muted)'}"
								></span>
							</span>
							{fExclude ? 'Yes, block re-adding' : 'No'}
						</button>
					</div>
				{/if}
			</div>

			<div
				style="display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid var(--bd)"
			>
				<button
					type="button"
					onclick={close}
					disabled={saving}
					class="at-bdh"
					style="height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
					>Cancel</button
				>
				{#if kind === 'delete'}
					<button
						type="button"
						onclick={remove}
						disabled={saving}
						class="at-op"
						style="height:34px;padding:0 13px;border-radius:6px;border:none;background:var(--err);color:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;opacity:{saving
							? '.6'
							: '1'}">{saving ? 'Deleting…' : 'Delete'}</button
					>
				{:else}
					<button
						type="button"
						onclick={save}
						disabled={saving || !fProfile}
						class="at-op"
						style="height:34px;padding:0 13px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;opacity:{saving ||
						!fProfile
							? '.6'
							: '1'}">{saving ? 'Saving…' : 'Save'}</button
					>
				{/if}
			</div>
		</div>
	</div>
{/if}
